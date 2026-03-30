"""
AgenticFlow — Pydantic v2 Schemas
"""
import uuid
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field


# ─── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=8)

class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: Optional[str]
    tier: str
    credits: int
    created_at: datetime
    model_config = {"from_attributes": True}

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── Agent ────────────────────────────────────────────────────────────────────

class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    goal: str = Field(min_length=10, max_length=2000)
    base_model: str = "llama3.1:8b"
    framework: str = "langgraph"
    tools: List[str] = []
    guardrails: List[str] = []
    system_prompt: Optional[str] = None

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    base_model: Optional[str] = None
    tools: Optional[List[str]] = None
    guardrails: Optional[List[str]] = None
    system_prompt: Optional[str] = None

class AgentResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    goal: str
    base_model: str
    framework: str
    tools: List[str]
    guardrails: List[str]
    status: str
    endpoint_url: Optional[str]
    call_count: int
    accuracy_score: Optional[float]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class AgentRunRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    context: Optional[dict] = None

class AgentRunResponse(BaseModel):
    output: str
    reasoning_trace: Optional[List[str]] = None
    tool_calls: Optional[List[dict]] = None
    latency_ms: float
    model_used: str


# ─── Training ─────────────────────────────────────────────────────────────────

class TrainingJobCreate(BaseModel):
    lora_r: int = Field(default=16, ge=4, le=64)
    lora_alpha: int = Field(default=32, ge=8, le=128)
    lora_dropout: float = Field(default=0.05, ge=0.0, le=0.5)
    learning_rate: float = Field(default=2e-4)
    num_epochs: int = Field(default=3, ge=1, le=10)
    batch_size: int = Field(default=4, ge=1, le=32)

class TrainingJobResponse(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    status: str
    train_loss: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]
    model_config = {"from_attributes": True}


# ─── Eval ─────────────────────────────────────────────────────────────────────

class EvalRunResponse(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    overall_score: Optional[float]
    faithfulness: Optional[float]
    relevance: Optional[float]
    tool_accuracy: Optional[float]
    hallucination_rate: Optional[float]
    latency_p50_ms: Optional[float]
    latency_p99_ms: Optional[float]
    test_cases_total: int
    test_cases_passed: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Generic ──────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    per_page: int
    pages: int
