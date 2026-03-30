"""
AgenticFlow — Core Configuration
All settings loaded from environment variables / .env file
"""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    APP_ENV: str = "development"
    APP_NAME: str = "AgenticFlow"
    APP_VERSION: str = "2.4.0"
    DEBUG: bool = False
    SECRET_KEY: str = "changeme"
    API_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://agenticflow:password@localhost:5432/agenticflow"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Object Storage
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_DATASETS: str = "agenticflow-datasets"
    S3_BUCKET_MODELS: str = "agenticflow-models"

    # FREE LLM inference
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_DEFAULT_MODEL: str = "llama3.1:8b"
    TOGETHER_API_KEY: str = ""

    # Optional paid
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # Auth
    NEXTAUTH_SECRET: str = "changeme"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Docker sandbox
    DOCKER_HOST: str = "unix:///var/run/docker.sock"
    SANDBOX_IMAGE: str = "agenticflow/sandbox:latest"
    SANDBOX_NETWORK: str = "agenticflow_sandbox"
    SANDBOX_MAX_CONTAINERS: int = 50
    SANDBOX_TTL_SECONDS: int = 3600

    # Training
    HF_TOKEN: str = ""
    HF_CACHE_DIR: str = "/tmp/hf_cache"
    TRAINING_GPU_ENABLED: bool = False
    TRAINING_MAX_JOBS: int = 3

    # Eval
    EVAL_JUDGE_MODEL: str = "llama3.1:70b"
    EVAL_BATCH_SIZE: int = 10


settings = Settings()
