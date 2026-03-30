"""AgenticFlow — Celery Worker"""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "agenticflow",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.services.training.lora_trainer", "app.services.eval.evaluator"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.services.training.lora_trainer.run_lora_training": {"queue": "training"},
        "app.services.eval.evaluator.run_eval": {"queue": "eval"},
    },
)
