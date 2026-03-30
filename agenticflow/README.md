# 🤖 AgenticFlow — The Vercel for AI Agents

> Turn a job description into a high-performance, trained, and measurable AI Agent in under 5 minutes.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](https://docker.com)

---

## 🏗️ Architecture Overview

```
agenticflow/
├── backend/                  # FastAPI — Python 3.11
│   ├── app/
│   │   ├── api/v1/endpoints/ # REST + WebSocket routes
│   │   ├── core/             # Config, security, DB
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic v2 schemas
│   │   ├── services/
│   │   │   ├── agent/        # LangGraph / CrewAI compiler
│   │   │   ├── training/     # LoRA fine-tuning (PEFT)
│   │   │   ├── eval/         # LLM-as-a-Judge (DeepEval)
│   │   │   └── sandbox/      # Docker container orchestration
│   │   └── utils/
│   └── tests/
├── frontend/                 # Next.js 14 App Router + TypeScript
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── store/            # Zustand state management
├── infrastructure/
│   ├── docker/               # Dockerfiles + compose
│   ├── k8s/                  # Kubernetes manifests
│   └── terraform/            # AWS/GCP IaC
└── .github/workflows/        # CI/CD pipelines
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- Redis (via Docker)
- PostgreSQL (via Docker)

### 1. Clone & Setup

```bash
git clone https://github.com/your-org/agenticflow.git
cd agenticflow
cp .env.example .env          # fill in your keys
```

### 2. Start Infrastructure

```bash
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
# Starts: PostgreSQL, Redis, MinIO (S3-compatible storage)
```

### 3. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head           # run DB migrations
uvicorn app.main:app --reload --port 8000
# API docs → http://localhost:8000/docs
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# App → http://localhost:3000
```

---

## 🔑 Supported Free Models (No API Key Needed Locally)

| Model | Provider | Type | Size |
|-------|----------|------|------|
| DeepSeek-R1 | DeepSeek / Ollama | Reasoning | 671B / 7B distill |
| DeepSeek-R1 Distill 8B | DeepSeek / Groq | Fast Reasoning | 8B |
| Llama 3.1 8B | Meta / Ollama | General | 8B |
| Llama 3.1 70B | Meta / Groq API | General | 70B |
| Qwen3 32B | Alibaba / Ollama | Multilingual | 32B |
| Phi-4 | Microsoft / Ollama | Efficient | 14B |
| Gemma 2 9B | Google / Ollama | General | 9B |
| Mistral 7B | Mistral / Ollama | Lean/RAG | 7B |

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI + Python 3.11 |
| Agent Frameworks | LangGraph, CrewAI, AutoGen, Agno |
| LLM Inference (free) | Ollama (local), Groq API (free tier) |
| Fine-tuning | HuggingFace PEFT + LoRA + bitsandbytes |
| Evaluation | DeepEval + RAGAS + custom LLM-judge |
| Sandbox | Docker SDK + Gradio |
| Task Queue | Celery + Redis |
| Database | PostgreSQL + SQLAlchemy |
| Object Storage | MinIO / AWS S3 |
| Frontend | Next.js 14 + TypeScript + Tailwind |
| State | Zustand |
| Auth | NextAuth.js + JWT |
| Deployment | Docker Compose / Kubernetes / Terraform |

---

## 🌐 Environment Variables

See `.env.example` for all required variables. Key ones:

```bash
# Free inference (no cost)
GROQ_API_KEY=gsk_...          # groq.com — free tier, very fast
OLLAMA_BASE_URL=http://localhost:11434

# Optional paid models
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Infrastructure
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key-here
```

---

## 📄 License

MIT — free to use, modify, and deploy.
