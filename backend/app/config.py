"""应用配置 — 从环境变量读,带到各处用."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # DB
    database_url: str = "sqlite+aiosqlite:///./stocksense.db"
    redis_url: str = "memory://"

    # JWT
    jwt_secret: str = "dev_secret_change_me_in_prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 168

    # admin
    admin_username: str = "admin"
    admin_password: str = "change_me_on_first_login"

    # LLM
    llm_provider: str = "deepseek"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"
    llm_model: str = "deepseek-chat"

    # 通知
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # 应用
    app_env: str = "development"
    app_port: int = 8000
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173,http://localhost:8000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]