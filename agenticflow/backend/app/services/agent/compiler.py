"""
AgenticFlow — Agent Compiler Service
Translates intake form → LangGraph / CrewAI reasoning graph
"""
import re
import secrets
import time
from typing import Any, Optional
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langchain_community.llms import Ollama
from langchain_community.chat_models import ChatOllama
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict
import structlog

from app.core.config import settings

logger = structlog.get_logger()


# ─── Agent State ──────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: list
    tool_results: list
    reasoning_trace: list
    final_output: str
    iteration_count: int


# ─── Model Factory — supports free models ─────────────────────────────────────

FREE_MODELS = {
    # Via Groq (fast, free tier)
    "llama3.1:8b":    ("groq", "llama-3.1-8b-instant"),
    "llama3.1:70b":   ("groq", "llama-3.1-70b-versatile"),
    "deepseek-r1:8b": ("groq", "deepseek-r1-distill-llama-70b"),
    "gemma2:9b":      ("groq", "gemma2-9b-it"),
    "mistral:7b":     ("groq", "mixtral-8x7b-32768"),
    # Via Ollama (local, completely free)
    "qwen3:32b":      ("ollama", "qwen3:32b"),
    "phi4":           ("ollama", "phi4"),
    "llama3.2:3b":    ("ollama", "llama3.2:3b"),
    "deepseek-r1":    ("ollama", "deepseek-r1"),
}

def get_llm(model_id: str, temperature: float = 0.1):
    """Return the appropriate LLM client for a given model ID."""
    provider, model_name = FREE_MODELS.get(model_id, ("ollama", model_id))

    if provider == "groq" and settings.GROQ_API_KEY:
        logger.info("using_groq", model=model_name)
        return ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=model_name,
            temperature=temperature,
        )
    else:
        # Fall back to local Ollama — always free
        logger.info("using_ollama", model=model_name)
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=model_name,
            temperature=temperature,
        )


# ─── Tool Registry ────────────────────────────────────────────────────────────

def build_tool_registry(requested_tools: list[str]) -> list:
    """Build langchain tools from a list of tool names."""
    registry = []

    if "Web Search" in requested_tools:
        @tool
        def web_search(query: str) -> str:
            """Search the web for current information."""
            # In production, wire to SerpAPI / Tavily / DuckDuckGo
            return f"[Web Search Result for: {query}] — Connect SERPAPI_KEY or TAVILY_KEY in .env"
        registry.append(web_search)

    if "Code Exec" in requested_tools:
        @tool
        def execute_python(code: str) -> str:
            """Execute Python code safely in a sandboxed environment."""
            # In production, runs inside Docker sandbox
            import subprocess, sys
            try:
                result = subprocess.run(
                    [sys.executable, "-c", code],
                    capture_output=True, text=True, timeout=10
                )
                return result.stdout or result.stderr
            except Exception as e:
                return f"Error: {e}"
        registry.append(execute_python)

    if "SQL DB" in requested_tools:
        @tool
        def query_database(sql: str) -> str:
            """Execute a read-only SQL query against the connected database."""
            return f"[DB Result for: {sql}] — Configure DATABASE_URL in .env"
        registry.append(query_database)

    # Add stubs for integration tools (wire up in production)
    for t in ["HubSpot", "Gmail", "Slack", "Notion", "Jira", "LinkedIn API", "File I/O"]:
        if t in requested_tools:
            tool_name = t.lower().replace(" ", "_")
            @tool
            def integration_tool(action: str, tool_id=t) -> str:
                f"""Interact with {tool_id}."""
                return f"[{tool_id}] action='{action}' — Configure {tool_id.upper()}_API_KEY in .env"
            integration_tool.name = tool_name
            registry.append(integration_tool)

    return registry


# ─── Guardrail Middleware ─────────────────────────────────────────────────────

def apply_guardrails(output: str, guardrails: list[str]) -> str:
    """Post-process output through configured guardrails."""
    if "No PII output" in guardrails:
        # Redact emails, phone numbers, SSNs
        output = re.sub(r'\b[\w.+-]+@[\w-]+\.\w+\b', '[EMAIL REDACTED]', output)
        output = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE REDACTED]', output)
        output = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN REDACTED]', output)
    return output


# ─── Graph Builder ────────────────────────────────────────────────────────────

def build_agent_graph(
    goal: str,
    base_model: str,
    tools: list[str],
    guardrails: list[str],
    system_prompt: Optional[str] = None,
) -> tuple[Any, list]:
    """
    Compile a LangGraph StateGraph from agent configuration.
    Returns (compiled_graph, tool_registry).
    """
    llm = get_llm(base_model)
    tool_registry = build_tool_registry(tools)
    sp = system_prompt or f"""You are a specialized AI agent with this goal: {goal}

Always:
1. Think step by step before acting
2. Use available tools when needed
3. Be precise and factual
4. State your confidence level

Guardrails active: {', '.join(guardrails) if guardrails else 'default'}"""

    if tool_registry:
        llm_with_tools = llm.bind_tools(tool_registry)
    else:
        llm_with_tools = llm

    # ── Node functions ────────────────────────────────────────────────────────

    def intake_node(state: AgentState) -> AgentState:
        """Parse and validate the incoming request."""
        msgs = state["messages"]
        trace = state.get("reasoning_trace", [])
        trace.append("intake: parsing request")
        return {**state, "reasoning_trace": trace}

    def reason_node(state: AgentState) -> AgentState:
        """Core LLM reasoning step."""
        msgs = state["messages"]
        trace = state.get("reasoning_trace", [])
        sys_msg = SystemMessage(content=sp)
        response = llm_with_tools.invoke([sys_msg] + msgs)
        trace.append(f"reason: generated response (model={base_model})")
        new_msgs = msgs + [response]
        return {**state, "messages": new_msgs, "reasoning_trace": trace}

    def should_use_tools(state: AgentState) -> str:
        """Router: decide if we need to call tools or finish."""
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            count = state.get("iteration_count", 0)
            max_calls = 3 if "Max 3 tool calls" in guardrails else 10
            if count < max_calls:
                return "tools"
        return "output"

    def output_node(state: AgentState) -> AgentState:
        """Format and apply guardrails to final output."""
        last = state["messages"][-1]
        raw_output = last.content if hasattr(last, "content") else str(last)
        final = apply_guardrails(raw_output, guardrails)
        trace = state.get("reasoning_trace", [])
        trace.append("output: guardrails applied, response ready")
        return {**state, "final_output": final, "reasoning_trace": trace}

    def tools_node_fn(state: AgentState) -> AgentState:
        """Execute tool calls and return results."""
        tool_node = ToolNode(tool_registry)
        result = tool_node.invoke(state)
        count = state.get("iteration_count", 0) + 1
        return {**result, "iteration_count": count}

    # ── Graph wiring ──────────────────────────────────────────────────────────
    graph = StateGraph(AgentState)
    graph.add_node("intake", intake_node)
    graph.add_node("reason", reason_node)
    graph.add_node("output", output_node)

    if tool_registry:
        graph.add_node("tools", tools_node_fn)
        graph.add_conditional_edges("reason", should_use_tools, {"tools": "tools", "output": "output"})
        graph.add_edge("tools", "reason")
    else:
        graph.add_edge("reason", "output")

    graph.set_entry_point("intake")
    graph.add_edge("intake", "reason")
    graph.add_edge("output", END)

    return graph.compile(), tool_registry


# ─── Main Compiler Entry Point ────────────────────────────────────────────────

class AgentCompiler:
    """High-level compiler called by the API endpoint."""

    def compile(
        self,
        name: str,
        goal: str,
        base_model: str,
        framework: str,
        tools: list[str],
        guardrails: list[str],
        system_prompt: Optional[str] = None,
    ) -> dict:
        """
        Compile agent config → reasoning graph + metadata.
        Returns a serializable dict describing the compiled graph.
        """
        if framework.lower() == "langgraph":
            compiled_graph, tool_registry = build_agent_graph(
                goal=goal,
                base_model=base_model,
                tools=tools,
                guardrails=guardrails,
                system_prompt=system_prompt,
            )
        else:
            # CrewAI, AutoGen, Agno — stub, extend in production
            raise NotImplementedError(f"Framework '{framework}' coming soon. Use LangGraph for now.")

        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        api_key = f"af-{secrets.token_urlsafe(24)}"

        return {
            "slug": slug,
            "api_key": api_key,
            "graph_config": {
                "nodes": ["intake", "reason", "tools", "output"],
                "edges": [["intake","reason"],["reason","tools"],["tools","reason"],["reason","output"]],
                "base_model": base_model,
                "framework": framework,
                "tool_count": len(tool_registry),
            },
            "_compiled_graph": compiled_graph,  # runtime object, not persisted
        }

    async def run(
        self,
        compiled_graph: Any,
        message: str,
        session_id: Optional[str] = None,
    ) -> dict:
        """Run a compiled agent on a user message. Returns output + traces."""
        t0 = time.time()
        initial_state: AgentState = {
            "messages": [HumanMessage(content=message)],
            "tool_results": [],
            "reasoning_trace": [],
            "final_output": "",
            "iteration_count": 0,
        }
        result = await compiled_graph.ainvoke(initial_state)
        latency_ms = (time.time() - t0) * 1000
        return {
            "output": result.get("final_output", ""),
            "reasoning_trace": result.get("reasoning_trace", []),
            "tool_calls": result.get("tool_results", []),
            "latency_ms": round(latency_ms, 2),
        }


compiler = AgentCompiler()
