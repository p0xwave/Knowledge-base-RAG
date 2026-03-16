"""Настройки backend сервиса."""

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class PostgresSettings(BaseModel):
    """Настройки подключения к PostgreSQL."""

    USER: str
    PASSWORD: str
    HOST: str
    PORT: int = 5432
    DATABASE: str


class Settings(BaseSettings):
    """Главные настройки приложения."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="_",
        extra="ignore",
        case_sensitive=False,
    )

    POSTGRES: PostgresSettings

    JWT_SECRET_KEY: str = "super-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours


settings = Settings()  # type: ignore
