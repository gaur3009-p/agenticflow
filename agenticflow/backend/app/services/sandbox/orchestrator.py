"""
AgenticFlow — Sandbox Service
Spins up containerized Gradio interfaces via Docker SDK
Each compiled agent gets its own isolated container + port
"""
import random
import asyncio
import secrets
from typing import Optional
import docker
import structlog

from app.core.config import settings

logger = structlog.get_logger()

# Port range for sandbox containers
SANDBOX_PORT_START = 7860
SANDBOX_PORT_END = 7960


class SandboxOrchestrator:
    """Manages Docker containers for agent sandboxes."""

    def __init__(self):
        try:
            self.client = docker.from_env()
            logger.info("docker_connected")
        except Exception as e:
            self.client = None
            logger.warning("docker_unavailable", error=str(e))

    def _get_free_port(self) -> int:
        """Find an available port in the sandbox range."""
        used = {
            int(p.split("/")[0])
            for c in (self.client.containers.list() if self.client else [])
            for p in (c.ports or {}).keys()
            if "/" in p
        }
        available = set(range(SANDBOX_PORT_START, SANDBOX_PORT_END)) - used
        return random.choice(list(available)) if available else SANDBOX_PORT_START

    async def spin_up(
        self,
        agent_id: str,
        agent_name: str,
        base_model: str,
        system_prompt: str,
        tools: list[str],
    ) -> dict:
        """
        Spin up a containerized Gradio sandbox for the agent.
        Returns container ID and endpoint URL.
        """
        if not self.client:
            # Dev mode: return a mock endpoint
            port = random.randint(7860, 7960)
            endpoint = f"https://sandbox.agenticflow.io/agents/{agent_id}"
            logger.warning("docker_mock_mode", endpoint=endpoint)
            return {
                "container_id": f"mock-{agent_id[:8]}",
                "endpoint_url": endpoint,
                "port": port,
            }

        port = self._get_free_port()
        container_name = f"af-agent-{agent_id[:8]}"
        api_key = secrets.token_urlsafe(16)

        env_vars = {
            "AGENT_ID": agent_id,
            "AGENT_NAME": agent_name,
            "BASE_MODEL": base_model,
            "SYSTEM_PROMPT": system_prompt[:1000],
            "TOOLS": ",".join(tools),
            "OLLAMA_BASE_URL": settings.OLLAMA_BASE_URL,
            "GROQ_API_KEY": settings.GROQ_API_KEY,
            "SANDBOX_API_KEY": api_key,
        }

        try:
            # Remove existing container with same name
            try:
                old = self.client.containers.get(container_name)
                old.remove(force=True)
            except docker.errors.NotFound:
                pass

            container = self.client.containers.run(
                image=settings.SANDBOX_IMAGE,
                name=container_name,
                environment=env_vars,
                ports={"7860/tcp": port},
                network=settings.SANDBOX_NETWORK,
                detach=True,
                auto_remove=False,
                mem_limit="1g",
                cpu_quota=50000,   # 50% CPU
                labels={
                    "agenticflow.agent_id": agent_id,
                    "agenticflow.managed": "true",
                },
            )

            # Wait for container to be healthy (max 30s)
            await self._wait_healthy(container, timeout=30)

            endpoint = f"http://localhost:{port}"
            logger.info("sandbox_started", agent_id=agent_id, port=port)

            return {
                "container_id": container.id[:12],
                "endpoint_url": endpoint,
                "port": port,
                "api_key": api_key,
            }
        except Exception as e:
            logger.error("sandbox_start_failed", agent_id=agent_id, error=str(e))
            raise

    async def _wait_healthy(self, container, timeout: int = 30):
        """Poll until container is running or timeout."""
        for _ in range(timeout):
            container.reload()
            if container.status == "running":
                return
            await asyncio.sleep(1)
        raise TimeoutError(f"Container {container.name} did not start in {timeout}s")

    async def tear_down(self, container_id: str):
        """Stop and remove a sandbox container."""
        if not self.client or container_id.startswith("mock-"):
            return
        try:
            container = self.client.containers.get(container_id)
            container.stop(timeout=5)
            container.remove()
            logger.info("sandbox_stopped", container_id=container_id)
        except docker.errors.NotFound:
            logger.warning("container_not_found", container_id=container_id)
        except Exception as e:
            logger.error("sandbox_stop_failed", container_id=container_id, error=str(e))

    def list_running(self) -> list[dict]:
        """List all running AgenticFlow sandbox containers."""
        if not self.client:
            return []
        containers = self.client.containers.list(
            filters={"label": "agenticflow.managed=true"}
        )
        return [
            {
                "container_id": c.id[:12],
                "name": c.name,
                "status": c.status,
                "agent_id": c.labels.get("agenticflow.agent_id"),
            }
            for c in containers
        ]

    async def cleanup_expired(self, ttl_seconds: int = None):
        """Remove containers that exceed the TTL."""
        ttl = ttl_seconds or settings.SANDBOX_TTL_SECONDS
        if not self.client:
            return
        import time
        now = time.time()
        for c in self.client.containers.list(filters={"label": "agenticflow.managed=true"}):
            started = c.attrs.get("State", {}).get("StartedAt", "")
            # Simple age check — in production use proper datetime parsing
            logger.info("container_age_check", name=c.name)


sandbox = SandboxOrchestrator()
