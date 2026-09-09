from sentence_transformers import CrossEncoder, SentenceTransformer

from rag.config import Settings
from rag.llm import ChatModel


def create_embed_model(settings: Settings) -> SentenceTransformer:
    return SentenceTransformer(
        settings.embedding_model,
        device=settings.device,
        revision=settings.embedding_revision,
    )


def create_eval_embed_model(settings: Settings) -> SentenceTransformer:
    return SentenceTransformer(settings.eval_embedding_model, device=settings.device)


def create_reranker(settings: Settings) -> CrossEncoder:
    return CrossEncoder(
        settings.rerank_model, device=settings.device, revision=settings.rerank_revision
    )


def create_chat_model(settings: Settings) -> ChatModel:
    return ChatModel(
        model_name=settings.llm_model_generation,
        api_url=settings.llm_api_url,
        api_key=settings.llm_api_key,
        timeout=settings.llm_timeout,
        temperature=settings.llm_temperature,
        max_output_tokens=settings.llm_max_output_tokens,
    )


def create_judge_model(settings: Settings) -> ChatModel:
    return ChatModel(
        model_name=settings.llm_model_judge,
        api_url=settings.judge_api_url or settings.llm_api_url,
        api_key=settings.judge_api_key or settings.llm_api_key,
        timeout=settings.judge_timeout,
    )
