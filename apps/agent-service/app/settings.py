"""Configuration for apps/agent-service, loaded from environment variables.

See docs/SDD.md and the root .env.example for the full list of env vars introduced
across slices. Slice 0 only needs AGENT_SERVICE_SHARED_SECRET.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULT = "dev-shared-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Shared secret validated on every internal request from apps/web. Sent as the
    # `X-Axiom-Internal-Secret` header. See app/auth.py.
    agent_service_shared_secret: str = _INSECURE_DEFAULT
    environment: str = "development"

    @field_validator("agent_service_shared_secret")
    @classmethod
    def _reject_default_secret_outside_dev(cls, value: str, info) -> str:
        env = (info.data.get("environment") or "development").lower()
        if value == _INSECURE_DEFAULT and env != "development":
            raise ValueError(
                "AGENT_SERVICE_SHARED_SECRET must be set to a real secret when "
                f"ENVIRONMENT={env!r}; refusing to start with the known dev default."
            )
        return value


settings = Settings()
