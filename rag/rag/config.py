from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _get_default_device() -> str:
    """Auto-detect best available device."""
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="RAG_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    top_k: int = 5
    chunk_size: int = 1000
    chunk_overlap: int = 200

    embedding_model: str = "BAAI/bge-base-en-v1.5"
    embedding_revision: str | None = None
    eval_embedding_model: str = "Snowflake/snowflake-arctic-embed-m"
    rerank_model: str = "BAAI/bge-reranker-base"
    rerank_revision: str | None = None

    llm_model_generation: str = "Qwen/Qwen2.5-Coder-7B-Instruct"
    llm_api_url: str = ""
    llm_api_key: str = ""
    llm_timeout: float = 30.0
    llm_temperature: float = 0.1
    llm_max_output_tokens: int = 1024

    llm_model_judge: str = "Qwen/Qwen2.5-32B-Instruct-AWQ"
    judge_api_url: str = ""
    judge_api_key: str = ""
    judge_timeout: float = 30.0

    dataset_path: str = "./data/dataset"
    qa_dataset_path: str = "./data/stackoverflow-pytorch.csv"
    chroma_path: str = "./chroma_fast"
    chroma_collection: str = "docs_fast"

    wandb_project: str = "pytorch-rag-experiments"
    wandb_api_key: str = ""

    device: str = _get_default_device()

    @field_validator("device")
    @classmethod
    def validate_device(cls, v: str) -> str:
        """Validate and normalize device string."""
        v = v.lower()
        if v not in ("cpu", "cuda", "mps"):
            raise ValueError(f"Invalid device: {v}. Must be 'cpu', 'cuda', or 'mps'")

        # Check if requested device is available
        if v == "cuda":
            try:
                import torch
                if not torch.cuda.is_available():
                    import warnings
                    warnings.warn("CUDA requested but not available, falling back to CPU")
                    return "cpu"
            except ImportError:
                import warnings
                warnings.warn("torch not installed, falling back to CPU")
                return "cpu"

        return v
