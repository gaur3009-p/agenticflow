"""AgenticFlow — Training & Eval API Endpoints"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import Agent, AgentStatus, TrainingJob, EvalRun, TrainingStatus
from app.schemas.schemas import TrainingJobCreate, TrainingJobResponse, EvalRunResponse
from app.services.training.lora_trainer import run_lora_training, validate_golden_dataset
from app.services.eval.evaluator import run_eval

router = APIRouter()


# ─── Training ─────────────────────────────────────────────────────────────────

@router.post("/{agent_id}/jobs", response_model=TrainingJobResponse, status_code=201)
async def start_training(
    agent_id: uuid.UUID,
    config: TrainingJobCreate,
    dataset: UploadFile = File(..., description="JSONL golden dataset"),
    db: AsyncSession = Depends(get_db),
):
    """Upload a golden dataset and start LoRA fine-tuning as a background Celery task."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    # Validate dataset
    content = await dataset.read()
    validation = validate_golden_dataset(content)
    if validation["valid_count"] == 0:
        raise HTTPException(400, f"Dataset has no valid rows: {validation['errors']}")

    # Save dataset to S3
    import boto3, io
    from app.core.config import settings
    s3 = boto3.client(
        "s3", endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )
    s3_key = f"datasets/{agent_id}/{dataset.filename}"
    s3.upload_fileobj(io.BytesIO(content), settings.S3_BUCKET_DATASETS, s3_key)

    # Create DB record
    job = TrainingJob(
        agent_id=agent_id,
        dataset_s3_key=s3_key,
        base_model=agent.base_model,
        **config.model_dump(),
        status=TrainingStatus.QUEUED,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Dispatch Celery task
    task = run_lora_training.apply_async(
        kwargs={
            "job_id": str(job.id),
            "agent_id": str(agent_id),
            "dataset_path": s3_key,
            "base_model": agent.base_model,
            **config.model_dump(),
        }
    )
    job.celery_task_id = task.id
    job.status = TrainingStatus.RUNNING
    agent.status = AgentStatus.TRAINING
    await db.commit()
    await db.refresh(job)

    return job


@router.get("/{agent_id}/jobs", response_model=list[TrainingJobResponse])
async def list_training_jobs(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrainingJob).where(TrainingJob.agent_id == agent_id).order_by(TrainingJob.created_at.desc())
    )
    return result.scalars().all()


# ─── Eval ─────────────────────────────────────────────────────────────────────

eval_router = APIRouter()

@eval_router.post("/{agent_id}/runs", response_model=EvalRunResponse, status_code=201)
async def trigger_eval(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Trigger an auto-eval run for a compiled agent."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    if agent.status not in (AgentStatus.LIVE, AgentStatus.TRAINING):
        raise HTTPException(400, "Agent must be compiled before eval")

    eval_run = EvalRun(agent_id=agent_id)
    db.add(eval_run)
    await db.commit()
    await db.refresh(eval_run)

    # Dispatch Celery task
    run_eval.apply_async(
        kwargs={
            "eval_run_id": str(eval_run.id),
            "agent_id": str(agent_id),
            "compiled_graph_config": {
                "goal": agent.goal,
                "base_model": agent.base_model,
                "tools": agent.tools,
                "guardrails": agent.guardrails,
            },
        }
    )
    return eval_run


@eval_router.get("/{agent_id}/runs", response_model=list[EvalRunResponse])
async def list_eval_runs(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EvalRun).where(EvalRun.agent_id == agent_id).order_by(EvalRun.created_at.desc())
    )
    return result.scalars().all()


@eval_router.get("/{agent_id}/runs/latest", response_model=EvalRunResponse)
async def get_latest_eval(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EvalRun).where(EvalRun.agent_id == agent_id)
        .order_by(EvalRun.created_at.desc()).limit(1)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "No eval runs found")
    return run
