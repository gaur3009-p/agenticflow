# 🚀 AgenticFlow — Full Execution Guide
## From Zero to Running Agent in 15 Minutes

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | python.org |
| Node.js | 20+ | nodejs.org |
| Docker | 24+ | docker.com |
| Git | any | git-scm.com |
| Ollama (optional) | latest | ollama.com |

---

## Step 1 — Clone & Configure

```bash
git clone https://github.com/your-org/agenticflow.git
cd agenticflow

# Copy environment template
cp .env.example .env
```

### Minimum .env required to run (FREE — no paid keys):

```bash
# .env — minimum viable config
SECRET_KEY=your-random-64-char-string-here-change-this
DATABASE_URL=postgresql+asyncpg://agenticflow:password@localhost:5432/agenticflow
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.1:8b

# Optional but recommended (free at groq.com):
GROQ_API_KEY=gsk_your_key_here
```

---

## Step 2 — Start Infrastructure (Docker)

```bash
# Start PostgreSQL + Redis + MinIO
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d

# Verify all containers are healthy
docker compose -f infrastructure/docker/docker-compose.dev.yml ps
```

Expected output:
```
NAME          STATUS
af_postgres   Up (healthy)
af_redis      Up (healthy)
af_minio      Up (healthy)
```

---

## Step 3 — Set Up Free LLM Inference

### Option A: Ollama (Fully Local — Recommended)

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama server
ollama serve &

# Pull free models (pick at least one)
ollama pull llama3.1:8b          # 4.7GB — best balance
ollama pull deepseek-r1:7b       # 4.1GB — best reasoning
ollama pull mistral:7b           # 4.1GB — lean, fast
ollama pull phi4                 # 8.5GB — efficient
```

### Option B: Groq API (Free Tier — No GPU Needed)

1. Go to [groq.com](https://groq.com) → sign up free
2. Create API key
3. Add to `.env`: `GROQ_API_KEY=gsk_...`

Groq gives you free access to: `llama-3.1-8b-instant`, `llama-3.1-70b-versatile`, `gemma2-9b-it`, `mixtral-8x7b`

---

## Step 4 — Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate
source venv/bin/activate          # macOS/Linux
# OR: venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI
uvicorn app.main:app --reload --port 8000
```

**Verify:** Open http://localhost:8000/docs — you should see the Swagger UI.

---

## Step 5 — Frontend Setup

```bash
# Open new terminal
cd frontend

# Install deps
npm install

# Start dev server
npm run dev
```

**Verify:** Open http://localhost:3000 — you should see the AgenticFlow landing page.

---

## Step 6 — Start Celery Worker (Training + Eval)

```bash
# Open new terminal
cd backend
source venv/bin/activate

# Start worker with training and eval queues
celery -A app.worker worker \
  -Q training,eval,default \
  --concurrency=2 \
  --loglevel=info
```

---

## Step 7 — Build Your First Agent

1. Go to http://localhost:3000/builder
2. Fill in:
   - **Name**: `MyFirstAgent`
   - **Goal**: `Answer questions about our product and route support tickets`
   - **Model**: `Llama 3.1 8B (Free · Groq)` or your Ollama model
   - **Framework**: `LangGraph`
   - **Tools**: check `Web Search`
   - **Guardrails**: check `No PII output`
3. Click **Compile Agent**
4. Watch the terminal log — it will:
   - Parse your form → build reasoning graph
   - Spin up sandbox container
   - Generate API endpoint
5. Test in the **Sandbox** tab chat
6. View **Eval** tab → click Run Eval to score it

---

## Step 8 — Test the API Directly

```bash
# After compiling an agent, test via curl
AGENT_ID="your-agent-id-from-dashboard"
API_KEY="af-your-api-key-from-compile"

curl -X POST http://localhost:8000/api/v1/agents/$AGENT_ID/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"message": "Hello! What can you help me with?"}'
```

---

## Step 9 — Fine-tune with LoRA (Optional)

Prepare a golden dataset in JSONL format:

```jsonl
{"messages": [{"role": "user", "content": "Classify this lead: Company=Acme, revenue=500k"}, {"role": "assistant", "content": "Score: 8/10. High intent. Recommended action: Schedule demo."}]}
{"messages": [{"role": "user", "content": "Classify this lead: Company=Unknown, revenue=10k"}, {"role": "assistant", "content": "Score: 3/10. Low fit. Recommended action: Add to nurture sequence."}]}
```

Upload via API:

```bash
curl -X POST http://localhost:8000/api/v1/training/$AGENT_ID/jobs \
  -F "dataset=@./golden_dataset.jsonl" \
  -F "lora_r=16" \
  -F "num_epochs=3" \
  -F "batch_size=4"
```

Training runs async in Celery. Monitor via Flower: http://localhost:5555

> **GPU note:** Training runs on CPU by default (slow but works).
> Set `TRAINING_GPU_ENABLED=true` in `.env` if you have a CUDA GPU.

---

## Step 10 — Run Tests

```bash
cd backend
source venv/bin/activate

# Install test deps
pip install pytest pytest-asyncio httpx aiosqlite

# Run all tests
pytest tests/ -v

# Expected output:
# test_health                         PASSED
# test_register_and_login             PASSED
# test_compiler_basic                 PASSED
# test_compiler_with_tools            PASSED
# test_validate_golden_dataset_*      PASSED
# test_pii_guardrail                  PASSED
```

---

## Common Issues

### "Connection refused" to PostgreSQL
```bash
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d postgres
sleep 5 && alembic upgrade head
```

### Ollama model not found
```bash
ollama list           # check installed models
ollama pull llama3.1:8b
```

### Groq rate limit
Switch to Ollama local inference in `.env`:
```bash
OLLAMA_DEFAULT_MODEL=llama3.1:8b
# and leave GROQ_API_KEY empty
```

### Port 8000 already in use
```bash
lsof -i :8000 | awk 'NR>1 {print $2}' | xargs kill -9
```

### Training OOM (out of memory)
Reduce batch size in training request:
```bash
"batch_size": 1, "lora_r": 8
```

---

## Production Deployment

```bash
# Build and push Docker images
make docker-build

# Start full production stack (includes Nginx reverse proxy)
make docker-up

# Run DB migrations in prod
docker exec af_backend alembic upgrade head
```

For cloud deployment (AWS/GCP), Terraform configs are in `infrastructure/terraform/`.

---

## Architecture Quick Reference

```
User Browser (localhost:3000)
    ↓ REST/WebSocket
Next.js Frontend (port 3000)
    ↓ /api/backend/* proxy
FastAPI Backend (port 8000)
    ├── PostgreSQL (port 5432)  — agent configs, eval results
    ├── Redis (port 6379)       — Celery queue, cache
    ├── MinIO (port 9000)       — datasets, LoRA adapters
    ├── Celery Worker           — async training + eval
    └── Docker SDK              — sandbox container orchestration
         └── Sandbox Container (port 7860) — Gradio UI per agent
              └── Ollama / Groq — LLM inference (FREE)
```
