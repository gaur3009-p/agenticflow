"""
AgenticFlow — SQLAlchemy ORM Models
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Boolean, DateTime, Float, Integer,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class AgentStatus(str, enum.Enum):
    DRAFT = "draft"
    COMPILING = "compiling"
    LIVE = "live"
    TRAINING = "training"
    ERROR = "error"
    ARCHIVED = "archived"

class TrainingStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class TierEnum(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255))
    tier: Mapped[TierEnum] = mapped_column(SAEnum(TierEnum), default=TierEnum.FREE)
    credits: Mapped[int] = mapped_column(Integer, default=10)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    workspaces: Mapped[list["Workspace"]] = relationship("Workspace", back_populates="owner")


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped["User"] = relationship("User", back_populates="workspaces")
    agents: Mapped[list["Agent"]] = relationship("Agent", back_populates="workspace")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), index=True)
    goal: Mapped[str] = mapped_column(Text)
    base_model: Mapped[str] = mapped_column(String(100), default="llama3.1:8b")
    framework: Mapped[str] = mapped_column(String(50), default="langgraph")

    # Compiled config stored as JSON
    tools: Mapped[list] = mapped_column(JSON, default=list)
    guardrails: Mapped[list] = mapped_column(JSON, default=list)
    graph_config: Mapped[dict] = mapped_column(JSON, default=dict)
    system_prompt: Mapped[Optional[str]] = mapped_column(Text)

    # Runtime
    status: Mapped[AgentStatus] = mapped_column(SAEnum(AgentStatus), default=AgentStatus.DRAFT)
    container_id: Mapped[Optional[str]] = mapped_column(String(100))
    endpoint_url: Mapped[Optional[str]] = mapped_column(String(500))
    api_key: Mapped[Optional[str]] = mapped_column(String(100))

    # Metadata
    call_count: Mapped[int] = mapped_column(Integer, default=0)
    accuracy_score: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="agents")
    training_jobs: Mapped[list["TrainingJob"]] = relationship("TrainingJob", back_populates="agent")
    eval_runs: Mapped[list["EvalRun"]] = relationship("EvalRun", back_populates="agent")


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), nullable=False)
    dataset_s3_key: Mapped[str] = mapped_column(String(500))
    base_model: Mapped[str] = mapped_column(String(100))

    # LoRA hyperparams
    lora_r: Mapped[int] = mapped_column(Integer, default=16)
    lora_alpha: Mapped[int] = mapped_column(Integer, default=32)
    lora_dropout: Mapped[float] = mapped_column(Float, default=0.05)
    learning_rate: Mapped[float] = mapped_column(Float, default=2e-4)
    num_epochs: Mapped[int] = mapped_column(Integer, default=3)
    batch_size: Mapped[int] = mapped_column(Integer, default=4)

    status: Mapped[TrainingStatus] = mapped_column(SAEnum(TrainingStatus), default=TrainingStatus.QUEUED)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255))
    adapter_s3_key: Mapped[Optional[str]] = mapped_column(String(500))
    train_loss: Mapped[Optional[float]] = mapped_column(Float)
    logs: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="training_jobs")


class EvalRun(Base):
    __tablename__ = "eval_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), nullable=False)

    # LLM-as-a-Judge scores
    overall_score: Mapped[Optional[float]] = mapped_column(Float)
    faithfulness: Mapped[Optional[float]] = mapped_column(Float)
    relevance: Mapped[Optional[float]] = mapped_column(Float)
    tool_accuracy: Mapped[Optional[float]] = mapped_column(Float)
    hallucination_rate: Mapped[Optional[float]] = mapped_column(Float)
    latency_p50_ms: Mapped[Optional[float]] = mapped_column(Float)
    latency_p99_ms: Mapped[Optional[float]] = mapped_column(Float)

    test_cases_total: Mapped[int] = mapped_column(Integer, default=0)
    test_cases_passed: Mapped[int] = mapped_column(Integer, default=0)
    detailed_results: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="eval_runs")
