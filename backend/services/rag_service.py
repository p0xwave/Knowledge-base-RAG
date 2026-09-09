"""RAG service for question answering with context retrieval."""

from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from chromadb.api.models.Collection import Collection
from loguru import logger
from outlier_detection import TopicClassifier
from prompt_contract import PromptContract
from rag import (
    ChatModel,
    answer,
    create_chat_model,
    create_embed_model,
    create_reranker,
)
from rag import (
    Settings as RagSettings,
)
from rag.chains import answer_stream
from rag.models import RetrievedChunk
from rag.retriever import retrieve, retrieve_with_query_transform, retrieve_with_rerank
from rag.vectorstore import create_collection


@dataclass
class RagResponse:
    """Response from RAG system."""

    answer: str
    chunks: list[RetrievedChunk]
    is_on_topic: bool = True
    topic_confidence: float = 1.0


@dataclass
class RagStreamResponse:
    """Streaming response from RAG system."""

    stream: Iterable[str]
    chunks: list[RetrievedChunk]
    is_on_topic: bool = True
    topic_confidence: float = 1.0


class RagService:
    """Service for RAG question answering with outlier detection."""

    def __init__(
        self,
        rag_settings: RagSettings,
        classifier_path: Optional[Path] = None,
        prompt_contract: PromptContract | None = None,
        collection: Collection | None = None,
    ) -> None:
        """Initialize RAG service.

        Args:
            rag_settings: RAG configuration settings
            classifier_path: Path to saved topic classifier model
        """
        self.settings = rag_settings
        self.prompt_contract = prompt_contract

        # Initialize models
        self.chat_model: Optional[ChatModel] = None
        self.embed_model = None
        self.reranker = None
        self.collection = collection
        self.topic_classifier: Optional[TopicClassifier] = None

        # Load models
        self._load_models(classifier_path)

    def _load_models(self, classifier_path: Optional[Path] = None):
        """Load all required models."""
        logger.info("Loading RAG models...")
        logger.info(f"Using device: {self.settings.device}")

        # Create LLM model
        self.chat_model = create_chat_model(self.settings)
        logger.info(f"✓ Loaded chat model: {self.settings.llm_model_generation}")

        # Create embedding model
        self.embed_model = create_embed_model(self.settings)
        logger.info(f"✓ Loaded embedding model: {self.settings.embedding_model}")

        # Create reranker
        self.reranker = create_reranker(self.settings)
        logger.info(f"✓ Loaded reranker: {self.settings.rerank_model}")

        # Create/load ChromaDB collection
        if self.collection is None:
            self.collection = create_collection(
                self.settings.chroma_path, self.settings.chroma_collection
            )
        logger.info(f"✓ Loaded ChromaDB collection: {self.settings.chroma_collection}")

        if classifier_path is not None:
            self.topic_classifier = TopicClassifier.load(classifier_path)
            logger.info(f"✓ Loaded topic classifier from: {classifier_path}")

    def check_topic(self, question: str) -> tuple[bool, float]:
        """Check if question is on-topic.

        Args:
            question: User question to check

        Returns:
            Tuple of (is_on_topic, confidence_score)
        """
        if not self.topic_classifier:
            return True, 1.0

        result = self.topic_classifier.predict(question)
        is_on_topic = result.labels[0] == 1
        confidence = abs(float(result.scores[0]))

        logger.debug(f"{is_on_topic=} {confidence=}")

        return is_on_topic, confidence

    def retrieve_chunks(
        self,
        question: str,
        strategy: str = "query_transform",
        n_results: int | None = None,
    ) -> list[RetrievedChunk]:
        """Retrieve relevant document chunks.

        Args:
            question: User question
            strategy: Retrieval strategy - "basic", "rerank", or "query_transform"
            n_results: Number of results to return (uses settings.top_k if None)

        Returns:
            List of retrieved chunks
        """
        if (
            self.collection is None
            or self.embed_model is None
            or self.reranker is None
            or self.chat_model is None
        ):
            raise RuntimeError("RAG models are not initialized")
        if n_results is None:
            n_results = self.settings.top_k

        if strategy == "query_transform":
            chunks = retrieve_with_query_transform(
                collection=self.collection,
                embed_model=self.embed_model,
                reranker=self.reranker,
                llm=self.chat_model,
                query=question,
                n_results=n_results,
            )
        elif strategy == "rerank":
            chunks = retrieve_with_rerank(
                collection=self.collection,
                embed_model=self.embed_model,
                reranker=self.reranker,
                query=question,
                n_results=n_results,
            )
        else:  # basic
            chunks = retrieve(
                collection=self.collection,
                embed_model=self.embed_model,
                query=question,
                n_results=n_results,
            )

        return chunks

    def answer_question(
        self,
        question: str,
        strategy: str = "rerank",
        check_topic: bool = True,
        reject_off_topic: bool = False,
        history: list[dict] | None = None,
    ) -> RagResponse:
        """Answer question using RAG.

        Args:
            question: User question
            strategy: Retrieval strategy - "basic", "rerank", or "query_transform"
            check_topic: Whether to check if question is on-topic
            reject_off_topic: Whether to reject off-topic questions
            history: Conversation history as list of message dicts

        Returns:
            RagResponse with answer, chunks, and topic information
        """
        # Check topic if enabled
        is_on_topic = True
        topic_confidence = 1.0

        if check_topic and self.topic_classifier:
            is_on_topic, topic_confidence = self.check_topic(question)

            if not is_on_topic and reject_off_topic:
                return RagResponse(
                    answer="I can only answer questions about PyTorch. Your question appears to be off-topic.",
                    chunks=[],
                    is_on_topic=False,
                    topic_confidence=topic_confidence,
                )

        # Retrieve relevant chunks
        if self.chat_model is None:
            raise RuntimeError("RAG chat model is not initialized")
        chunks = self.retrieve_chunks(question, strategy=strategy)

        # Generate answer with history
        answer_text = answer(
            self.chat_model,
            question,
            chunks,
            history=history,
            contract=self.prompt_contract,
        )

        return RagResponse(
            answer=answer_text,
            chunks=chunks,
            is_on_topic=is_on_topic,
            topic_confidence=topic_confidence,
        )

    def answer_question_stream(
        self,
        question: str,
        strategy: str = "rerank",
        check_topic: bool = True,
        reject_off_topic: bool = False,
        history: list[dict] | None = None,
    ) -> RagStreamResponse:
        """Answer question using RAG with token streaming."""
        is_on_topic = True
        topic_confidence = 1.0

        if check_topic and self.topic_classifier:
            is_on_topic, topic_confidence = self.check_topic(question)

            if not is_on_topic and reject_off_topic:
                return RagStreamResponse(
                    stream=iter(
                        [
                            "I can only answer questions about PyTorch. "
                            "Your question appears to be off-topic."
                        ]
                    ),
                    chunks=[],
                    is_on_topic=False,
                    topic_confidence=topic_confidence,
                )

        if self.chat_model is None:
            raise RuntimeError("RAG chat model is not initialized")
        chunks = self.retrieve_chunks(question, strategy=strategy)
        stream = answer_stream(
            self.chat_model,
            question,
            chunks,
            history=history,
            contract=self.prompt_contract,
        )

        return RagStreamResponse(
            stream=stream,
            chunks=chunks,
            is_on_topic=is_on_topic,
            topic_confidence=topic_confidence,
        )


# Global service instance (will be initialized in lifespan)
_rag_service: Optional[RagService] = None


def get_rag_service() -> RagService:
    """Get global RAG service instance.

    Returns:
        Initialized RagService

    Raises:
        RuntimeError: If service not initialized
    """
    if _rag_service is None:
        raise RuntimeError(
            "RAG service not initialized. Call init_rag_service() first."
        )
    return _rag_service


def init_rag_service(
    rag_settings: RagSettings,
    classifier_path: Optional[Path] = None,
) -> RagService:
    """Initialize global RAG service.

    Args:
        rag_settings: RAG configuration
        classifier_path: Path to topic classifier model

    Returns:
        Initialized RagService
    """
    global _rag_service
    _rag_service = RagService(
        rag_settings=rag_settings,
        classifier_path=classifier_path,
    )
    return _rag_service


def shutdown_rag_service():
    """Shutdown RAG service and cleanup resources."""
    global _rag_service
    if _rag_service:
        # Cleanup if needed
        _rag_service = None
        logger.info("✓ RAG service shutdown")
