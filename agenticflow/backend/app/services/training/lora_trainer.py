"""
AgenticFlow — LoRA Fine-tuning Service
Uses HuggingFace PEFT + bitsandbytes for 4-bit QLoRA
Runs as a Celery background task
"""
import os
import json
import time
from pathlib import Path
from typing import Optional
import structlog

from app.core.config import settings
from app.worker import celery_app

logger = structlog.get_logger()


# ─── Celery Task ──────────────────────────────────────────────────────────────

@celery_app.task(bind=True, max_retries=2, time_limit=3600 * 4)
def run_lora_training(
    self,
    job_id: str,
    agent_id: str,
    dataset_path: str,
    base_model: str,
    lora_r: int = 16,
    lora_alpha: int = 32,
    lora_dropout: float = 0.05,
    learning_rate: float = 2e-4,
    num_epochs: int = 3,
    batch_size: int = 4,
):
    """
    Celery task: runs LoRA fine-tuning in background.
    Updates job status in DB as it progresses.
    """
    logger.info("lora_training_start", job_id=job_id, base_model=base_model)

    try:
        from transformers import (
            AutoTokenizer, AutoModelForCausalLM,
            TrainingArguments, DataCollatorForSeq2Seq
        )
        from peft import LoraConfig, get_peft_model, TaskType
        from trl import SFTTrainer
        from datasets import load_dataset
        import torch

        # ── 1. Load dataset from S3/local ─────────────────────────────────────
        logger.info("loading_dataset", path=dataset_path)
        if dataset_path.endswith(".jsonl"):
            dataset = load_dataset("json", data_files=dataset_path, split="train")
        else:
            dataset = load_dataset(dataset_path, split="train")

        # ── 2. Load base model ────────────────────────────────────────────────
        # Map AgenticFlow model IDs to HuggingFace model names
        HF_MODEL_MAP = {
            "llama3.1:8b":    "meta-llama/Meta-Llama-3.1-8B-Instruct",
            "mistral:7b":     "mistralai/Mistral-7B-Instruct-v0.3",
            "phi4":           "microsoft/phi-4",
            "gemma2:9b":      "google/gemma-2-9b-it",
            "qwen3:32b":      "Qwen/Qwen3-32B",
            "deepseek-r1:8b": "deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
        }
        hf_model_name = HF_MODEL_MAP.get(base_model, base_model)

        load_kwargs = {
            "pretrained_model_name_or_path": hf_model_name,
            "trust_remote_code": True,
            "cache_dir": settings.HF_CACHE_DIR,
        }

        if settings.TRAINING_GPU_ENABLED and __import__("torch").cuda.is_available():
            from transformers import BitsAndBytesConfig
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=__import__("torch").bfloat16,
            )
            load_kwargs["quantization_config"] = bnb_config
            load_kwargs["device_map"] = "auto"
        else:
            load_kwargs["device_map"] = "cpu"
            load_kwargs["torch_dtype"] = __import__("torch").float32

        logger.info("loading_base_model", hf_name=hf_model_name)
        tokenizer = AutoTokenizer.from_pretrained(hf_model_name, cache_dir=settings.HF_CACHE_DIR)
        tokenizer.pad_token = tokenizer.eos_token
        model = AutoModelForCausalLM.from_pretrained(**load_kwargs)

        # ── 3. Apply LoRA config ──────────────────────────────────────────────
        lora_config = LoraConfig(
            r=lora_r,
            lora_alpha=lora_alpha,
            lora_dropout=lora_dropout,
            bias="none",
            task_type=TaskType.CAUSAL_LM,
            target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        )
        model = get_peft_model(model, lora_config)
        model.print_trainable_parameters()

        # ── 4. Training arguments ─────────────────────────────────────────────
        output_dir = f"./lora_outputs/{job_id}"
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=4,
            learning_rate=learning_rate,
            fp16=settings.TRAINING_GPU_ENABLED,
            bf16=False,
            logging_steps=10,
            save_strategy="epoch",
            warmup_ratio=0.05,
            lr_scheduler_type="cosine",
            report_to="none",
        )

        # ── 5. SFT Trainer ────────────────────────────────────────────────────
        trainer = SFTTrainer(
            model=model,
            train_dataset=dataset,
            args=training_args,
            tokenizer=tokenizer,
            dataset_text_field="text",
            max_seq_length=2048,
        )

        logger.info("training_started", epochs=num_epochs)
        train_result = trainer.train()
        trainer.save_model(output_dir)

        # ── 6. Upload adapter to S3 ───────────────────────────────────────────
        adapter_key = f"adapters/{agent_id}/{job_id}/adapter"
        _upload_adapter_to_s3(output_dir, adapter_key)

        logger.info("lora_training_complete", job_id=job_id, loss=train_result.training_loss)
        return {
            "status": "completed",
            "train_loss": train_result.training_loss,
            "adapter_s3_key": adapter_key,
        }

    except Exception as exc:
        logger.error("lora_training_failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60)


def _upload_adapter_to_s3(local_dir: str, s3_key: str):
    """Upload LoRA adapter files to S3/MinIO."""
    import boto3
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )
    for file_path in Path(local_dir).rglob("*"):
        if file_path.is_file():
            key = f"{s3_key}/{file_path.relative_to(local_dir)}"
            s3.upload_file(str(file_path), settings.S3_BUCKET_MODELS, key)


# ─── Dataset Format Helper ────────────────────────────────────────────────────

def validate_golden_dataset(file_content: bytes) -> dict:
    """
    Validate and convert uploaded dataset to SFT format.
    Accepts JSONL with {instruction, input, output} or {messages: [...]}
    """
    lines = file_content.decode("utf-8").strip().split("\n")
    validated = []
    errors = []

    for i, line in enumerate(lines):
        try:
            row = json.loads(line)
            if "messages" in row:
                # Chat format — convert to text
                text = "\n".join(
                    f"<|{m['role']}|>\n{m['content']}" for m in row["messages"]
                )
                validated.append({"text": text})
            elif "instruction" in row and "output" in row:
                inp = row.get("input", "")
                text = f"<|user|>\n{row['instruction']}\n{inp}\n<|assistant|>\n{row['output']}"
                validated.append({"text": text})
            else:
                errors.append(f"Line {i+1}: missing required fields")
        except json.JSONDecodeError as e:
            errors.append(f"Line {i+1}: invalid JSON — {e}")

    return {
        "valid_count": len(validated),
        "error_count": len(errors),
        "errors": errors[:10],
        "sample": validated[:3],
    }
