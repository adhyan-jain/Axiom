"""Configuration for apps/agent-service, loaded from environment variables.

See docs/SDD.md and the root .env.example for the full list of env vars introduced
across slices. Slice 0 only needs AGENT_SERVICE_SHARED_SECRET.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Shared secret validated on every internal request from apps/web. Sent as the
    # `X-Axiom-Internal-Secret` header. See app/auth.py.
    agent_service_shared_secret: str = "dev-shared-secret-change-me"


settings = Settings()
