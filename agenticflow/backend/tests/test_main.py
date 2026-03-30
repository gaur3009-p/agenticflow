"""
AgenticFlow — Backend Tests
Run: pytest backend/tests/ -v
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.services.agent.compiler import AgentCompiler
from app.services.training.lora_trainer import validate_golden_dataset


# ─── Test DB Setup ─────────────────────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(test_engine):
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ─── Health ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ─── Auth ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_and_login(client):
    # Register
    resp = await client.post("/api/v1/auth/register", json={
        "email": "test@agenticflow.io",
        "name": "Test User",
        "password": "securepass123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "test@agenticflow.io"

    # Login
    resp = await client.post("/api/v1/auth/login", data={
        "username": "test@agenticflow.io",
        "password": "securepass123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


# ─── Compiler Unit Tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_compiler_basic():
    """Test that the compiler returns a valid graph config."""
    c = AgentCompiler()
    result = c.compile(
        name="TestAgent",
        goal="Qualify sales leads and score them 1-10",
        base_model="llama3.1:8b",
        framework="langgraph",
        tools=[],
        guardrails=["No PII output"],
    )
    assert result["slug"] == "testagent"
    assert "api_key" in result
    assert result["api_key"].startswith("af-")
    assert "_compiled_graph" in result
    assert result["graph_config"]["framework"] == "langgraph"


@pytest.mark.asyncio
async def test_compiler_with_tools():
    c = AgentCompiler()
    result = c.compile(
        name="ToolAgent",
        goal="Search and summarize information",
        base_model="llama3.1:8b",
        framework="langgraph",
        tools=["Web Search", "Code Exec"],
        guardrails=[],
    )
    assert result["graph_config"]["tool_count"] == 2


# ─── Dataset Validation ───────────────────────────────────────────────────────

def test_validate_golden_dataset_chat_format():
    content = b'\n'.join([
        b'{"messages": [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi there!"}]}',
        b'{"messages": [{"role": "user", "content": "What can you do?"}, {"role": "assistant", "content": "I can help with many tasks."}]}',
    ])
    result = validate_golden_dataset(content)
    assert result["valid_count"] == 2
    assert result["error_count"] == 0


def test_validate_golden_dataset_instruction_format():
    content = b'\n'.join([
        b'{"instruction": "Classify this lead", "input": "Company: Acme Corp", "output": "Score: 8/10"}',
        b'{"instruction": "Draft follow-up", "input": "Lead: John Doe", "output": "Hi John..."}',
    ])
    result = validate_golden_dataset(content)
    assert result["valid_count"] == 2


def test_validate_golden_dataset_invalid():
    content = b"not json at all\nalso bad"
    result = validate_golden_dataset(content)
    assert result["error_count"] == 2
    assert result["valid_count"] == 0


# ─── Guardrails ───────────────────────────────────────────────────────────────

def test_pii_guardrail():
    from app.services.agent.compiler import apply_guardrails
    raw = "Contact john@example.com or call 555-123-4567"
    result = apply_guardrails(raw, ["No PII output"])
    assert "john@example.com" not in result
    assert "[EMAIL REDACTED]" in result
    assert "555-123-4567" not in result
    assert "[PHONE REDACTED]" in result


def test_no_guardrail():
    from app.services.agent.compiler import apply_guardrails
    raw = "Contact john@example.com"
    result = apply_guardrails(raw, [])
    assert "john@example.com" in result  # not redacted
