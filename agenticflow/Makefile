# AgenticFlow — Makefile
# Usage: make <target>

.PHONY: help dev-infra backend frontend celery test lint migrate clean

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Infrastructure ────────────────────────────────────────────────────────────
dev-infra:  ## Start PostgreSQL, Redis, MinIO via Docker
	docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
	@echo "✓ Infrastructure running"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  Redis:      localhost:6379"
	@echo "  MinIO:      localhost:9000 (console: localhost:9001)"

dev-infra-down:  ## Stop dev infrastructure
	docker compose -f infrastructure/docker/docker-compose.dev.yml down

dev-infra-logs:  ## Tail dev infrastructure logs
	docker compose -f infrastructure/docker/docker-compose.dev.yml logs -f

# ── Backend ───────────────────────────────────────────────────────────────────
backend-setup:  ## Install backend dependencies
	cd backend && python -m venv venv && . venv/bin/activate && pip install -r requirements.txt

backend:  ## Start FastAPI backend
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --port 8000

migrate:  ## Run Alembic DB migrations
	cd backend && . venv/bin/activate && alembic upgrade head

migrate-new:  ## Create a new Alembic migration (use: make migrate-new MSG="add users table")
	cd backend && . venv/bin/activate && alembic revision --autogenerate -m "$(MSG)"

celery:  ## Start Celery worker (training + eval queues)
	cd backend && . venv/bin/activate && celery -A app.worker worker -Q training,eval,default --concurrency=2 --loglevel=info

celery-flower:  ## Start Celery Flower monitoring UI (http://localhost:5555)
	cd backend && . venv/bin/activate && celery -A app.worker flower --port=5555

# ── Frontend ──────────────────────────────────────────────────────────────────
frontend-setup:  ## Install frontend dependencies
	cd frontend && npm install

frontend:  ## Start Next.js dev server
	cd frontend && npm run dev

frontend-build:  ## Build frontend for production
	cd frontend && npm run build

# ── Ollama (Local Free LLM) ──────────────────────────────────────────────────
ollama-setup:  ## Download recommended free models via Ollama
	ollama pull llama3.1:8b
	ollama pull deepseek-r1:7b
	ollama pull mistral:7b
	@echo "✓ Free models downloaded. Start Ollama: ollama serve"

# ── Testing ───────────────────────────────────────────────────────────────────
test:  ## Run all backend tests
	cd backend && . venv/bin/activate && pytest tests/ -v

test-coverage:  ## Run tests with coverage report
	cd backend && . venv/bin/activate && pytest tests/ -v --cov=app --cov-report=html
	@echo "Coverage report: backend/htmlcov/index.html"

lint:  ## Lint and format backend (ruff + black)
	cd backend && . venv/bin/activate && ruff check app/ tests/ && black app/ tests/

# ── Docker ────────────────────────────────────────────────────────────────────
docker-build:  ## Build all Docker images
	docker compose -f infrastructure/docker/docker-compose.prod.yml build

docker-up:  ## Start full production stack
	docker compose -f infrastructure/docker/docker-compose.prod.yml up -d

docker-down:  ## Stop production stack
	docker compose -f infrastructure/docker/docker-compose.prod.yml down

docker-logs:  ## Tail production logs
	docker compose -f infrastructure/docker/docker-compose.prod.yml logs -f

# ── Dev (all services) ────────────────────────────────────────────────────────
dev: ## Start everything (infra + backend + frontend) in parallel
	$(MAKE) dev-infra
	@sleep 3
	$(MAKE) migrate
	@echo "Starting backend and frontend..."
	@trap 'kill 0' SIGINT; \
	(cd backend && . venv/bin/activate && uvicorn app.main:app --reload --port 8000) & \
	(cd frontend && npm run dev) & \
	wait

clean:  ## Clean up generated files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	cd frontend && rm -rf .next node_modules 2>/dev/null || true
	@echo "✓ Cleaned"
