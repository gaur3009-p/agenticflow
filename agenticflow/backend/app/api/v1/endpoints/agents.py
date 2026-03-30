"""
AgenticFlow — Agents API Endpoints
POST /agents          → create agent
GET  /agents          → list agents
GET  /agents/{id}     → get agent
PUT  /agents/{id}     → update agent
DELETE /agents/{id}   → delete agent
POST /agents/{id}/compile → compile agent (spin up sandbox)
POST /agents/{id}/run    → run agent (send message)
WS   /agents/{id}/stream → streaming run via WebSocket
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.websockets import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import structlog

from app.core.database import get_db
from app.models.models import Agent, AgentStatus, Workspace
from app.schemas.schemas import (
    AgentCreate, AgentUpdate, AgentResponse,
    AgentRunRequest, AgentRunResponse, MessageResponse,
)
from app.services.agent.compiler import compiler
from app.services.sandbox.orchestrator import sandbox

logger = structlog.get_logger()
router = APIRouter()

# In-memory store for compiled graph objects (keyed by agent_id)
# In production: use Redis pickle or re-compile on demand
_COMPILED_GRAPHS: dict = {}


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    payload: AgentCreate,
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent (draft state)."""
    # Verify workspace exists
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")

    agent = Agent(
        workspace_id=workspace_id,
        name=payload.name,
        slug=payload.name.lower().replace(" ", "-"),
        goal=payload.goal,
        base_model=payload.base_model,
        framework=payload.framework,
        tools=payload.tools,
        guardrails=payload.guardrails,
        system_prompt=payload.system_prompt,
        status=AgentStatus.DRAFT,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    logger.info("agent_created", agent_id=str(agent.id))
    return agent


@router.get("", response_model=list[AgentResponse])
async def list_agents(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.workspace_id == workspace_id).order_by(Agent.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: uuid.UUID,
    payload: AgentUpdate,
    db: AsyncSession = Depends(get_db),
):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(agent, field, value)
    agent.status = AgentStatus.DRAFT  # Reset to draft on update
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", response_model=MessageResponse)
async def delete_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    if agent.container_id:
        await sandbox.tear_down(agent.container_id)
    _COMPILED_GRAPHS.pop(str(agent_id), None)
    await db.delete(agent)
    await db.commit()
    return {"message": f"Agent {agent.name} deleted"}


# ─── Compile ──────────────────────────────────────────────────────────────────

@router.post("/{agent_id}/compile", response_model=AgentResponse)
async def compile_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Compile agent config → reasoning graph + spin up sandbox container.
    This is the core 'Build' action.
    """
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    agent.status = AgentStatus.COMPILING
    await db.commit()

    try:
        # 1. Compile LangGraph reasoning graph
        compiled = compiler.compile(
            name=agent.name,
            goal=agent.goal,
            base_model=agent.base_model,
            framework=agent.framework,
            tools=agent.tools,
            guardrails=agent.guardrails,
            system_prompt=agent.system_prompt,
        )

        # Store compiled graph in memory (keyed by agent_id)
        _COMPILED_GRAPHS[str(agent_id)] = compiled["_compiled_graph"]

        # 2. Spin up Docker sandbox
        sandbox_result = await sandbox.spin_up(
            agent_id=str(agent_id),
            agent_name=agent.name,
            base_model=agent.base_model,
            system_prompt=agent.system_prompt or agent.goal,
            tools=agent.tools,
        )

        # 3. Update DB
        agent.status = AgentStatus.LIVE
        agent.slug = compiled["slug"]
        agent.api_key = compiled["api_key"]
        agent.container_id = sandbox_result["container_id"]
        agent.endpoint_url = sandbox_result["endpoint_url"]
        agent.graph_config = compiled["graph_config"]
        await db.commit()
        await db.refresh(agent)

        logger.info("agent_compiled", agent_id=str(agent_id), endpoint=agent.endpoint_url)
        return agent

    except Exception as e:
        agent.status = AgentStatus.ERROR
        await db.commit()
        logger.error("compile_failed", agent_id=str(agent_id), error=str(e))
        raise HTTPException(500, f"Compilation failed: {str(e)}")


# ─── Run ──────────────────────────────────────────────────────────────────────

@router.post("/{agent_id}/run", response_model=AgentRunResponse)
async def run_agent(
    agent_id: uuid.UUID,
    payload: AgentRunRequest,
    db: AsyncSession = Depends(get_db),
):
    """Run the compiled agent on a message. Returns output + reasoning trace."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    if agent.status != AgentStatus.LIVE:
        raise HTTPException(400, f"Agent is not live (status={agent.status}). Compile first.")

    compiled_graph = _COMPILED_GRAPHS.get(str(agent_id))
    if not compiled_graph:
        # Re-compile on cold start
        compiled = compiler.compile(
            name=agent.name, goal=agent.goal, base_model=agent.base_model,
            framework=agent.framework, tools=agent.tools, guardrails=agent.guardrails,
            system_prompt=agent.system_prompt,
        )
        compiled_graph = compiled["_compiled_graph"]
        _COMPILED_GRAPHS[str(agent_id)] = compiled_graph

    result = await compiler.run(compiled_graph, payload.message, payload.session_id)

    # Increment call counter
    agent.call_count += 1
    await db.commit()

    return AgentRunResponse(
        output=result["output"],
        reasoning_trace=result.get("reasoning_trace"),
        tool_calls=result.get("tool_calls"),
        latency_ms=result["latency_ms"],
        model_used=agent.base_model,
    )


# ─── WebSocket Streaming ──────────────────────────────────────────────────────

@router.websocket("/{agent_id}/stream")
async def stream_agent(agent_id: uuid.UUID, websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    """WebSocket endpoint for streaming agent responses token by token."""
    await websocket.accept()
    agent = await db.get(Agent, agent_id)
    if not agent or agent.status != AgentStatus.LIVE:
        await websocket.send_json({"error": "Agent not live"})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            if not message:
                continue

            await websocket.send_json({"type": "start", "agent": agent.name})

            # Stream reasoning trace steps
            trace_steps = [
                "Parsing your request...",
                f"Reasoning with {agent.base_model}...",
                "Applying guardrails...",
                "Generating response...",
            ]
            for step in trace_steps:
                await websocket.send_json({"type": "trace", "content": step})
                import asyncio; await asyncio.sleep(0.3)

            # Run agent
            compiled_graph = _COMPILED_GRAPHS.get(str(agent_id))
            if compiled_graph:
                result = await compiler.run(compiled_graph, message)
                output = result["output"]
            else:
                output = "Agent not compiled in this session. Please recompile."

            # Stream output tokens (simulate streaming)
            words = output.split()
            for i, word in enumerate(words):
                await websocket.send_json({
                    "type": "token",
                    "content": word + (" " if i < len(words) - 1 else ""),
                })
                await asyncio.sleep(0.02)

            await websocket.send_json({"type": "done", "latency_ms": result.get("latency_ms", 0)})

    except WebSocketDisconnect:
        logger.info("websocket_disconnected", agent_id=str(agent_id))
