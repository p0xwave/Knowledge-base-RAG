from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class PostgresSettings(BaseModel):
    USER: str
    PASSWORD: str
    HOST: str
    PORT: int = 5432
    DATABASE: str


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="_",
        extra="ignore",
        case_sensitive=False,
    )

    POSTGRES: PostgresSettings

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    DATASET_STORAGE_PATH: Path = (
        Path(__file__).resolve().parents[1] / "data/dataset-versions"
    )
    DATASET_VERSION_MAX_BYTES: int = Field(default=100 * 1024**3, gt=0)
    DATASET_VERSION_MAX_FILES: int = Field(default=10000, gt=0)
    DATASET_FILE_CHUNK_BYTES: int = Field(default=1024 * 1024, gt=0)

    # CORS Settings
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # RAG Settings
    RAG_ENABLED: bool = True
    RAG_EMBEDDING_MODEL: str = "BAAI/bge-base-en-v1.5"
    RAG_RERANK_MODEL: str = "BAAI/bge-reranker-base"
    RAG_LLM_MODEL: str = "Qwen/Qwen2.5-Coder-7B-Instruct"
    RAG_LLM_API_URL: str = ""
    RAG_LLM_API_KEY: str = ""
    RAG_LLM_TIMEOUT: float = 30.0
    RAG_TOP_K: int = 5
    RAG_CHUNK_SIZE: int = 1000
    RAG_CHUNK_OVERLAP: int = 200
    RAG_CHROMA_PATH: str = "./data/chromadb"
    RAG_CHROMA_COLLECTION: str = "docs_fast"
    RAG_SOURCE_PATH_PREFIXES: list[str] = ["drive/MyDrive/dataset/", "dataset/"]

    # Outlier Detection Settings
    OUTLIER_DETECTION_ENABLED: bool = True
    OUTLIER_CLASSIFIER_PATH: str = "./models/pytorch_topic_classifier.joblib"
    OUTLIER_REJECT_OFF_TOPIC: bool = (
        True  # Set to True to auto-reject off-topic questions
    )

    # Code Executor Settings
    CODE_EXECUTOR_URL: str = "http://localhost:8002/execute"
    # Лимит исполнения кода в песочнице (сек). Холодный импорт torch ~3с,
    # поэтому держим запас; code-executor допускает максимум 30.
    CODE_EXECUTOR_TIMEOUT: int = 15
    CODE_EXECUTOR_MAX_CODE_LENGTH: int = 10000

    # Conversation History Settings
    CONVERSATION_HISTORY_ENABLED: bool = True
    CONVERSATION_MAX_HISTORY_MESSAGES: int = 10  # Max messages to include (5 turns)


settings = Settings()  # type: ignore[call-arg]
