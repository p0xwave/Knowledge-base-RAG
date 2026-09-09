from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from rag import Settings as RagSettings

from api.code import router as code_router
from api.dataset import router as dataset_router
from api.dialogue import router as dialogue_router
from api.folder import router as folder_router
from api.message import router as message_router
from api.source import router as source_router
from api.user import router as user_router
from db import close_db, init_db
from services.rag_service import init_rag_service, shutdown_rag_service
from settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    # Startup
    logger.info("Starting Knowledge Base RAG Backend...")

    # Validate JWT secret key
    known_bad_secrets = [
        "super-secret-key",
        "your-super-secret-key-change-this-in-production",
    ]
    if settings.JWT_SECRET_KEY in known_bad_secrets:
        logger.error("❌ FATAL: Using default/insecure JWT_SECRET_KEY")
        logger.error("   Please set a secure JWT_SECRET_KEY in your .env file")
        raise ValueError("Insecure JWT_SECRET_KEY detected. Application will not start.")

    # Initialize database
    await init_db()
    logger.info("✓ Database initialized")

    # Initialize RAG service if enabled
    if settings.RAG_ENABLED:
        try:
            # Create RAG settings
            rag_settings = RagSettings(
                embedding_model=settings.RAG_EMBEDDING_MODEL,
                rerank_model=settings.RAG_RERANK_MODEL,
                llm_model_generation=settings.RAG_LLM_MODEL,
                llm_api_url=settings.RAG_LLM_API_URL,
                llm_api_key=settings.RAG_LLM_API_KEY,
                llm_timeout=settings.RAG_LLM_TIMEOUT,
                top_k=settings.RAG_TOP_K,
                chunk_size=settings.RAG_CHUNK_SIZE,
                chunk_overlap=settings.RAG_CHUNK_OVERLAP,
                chroma_path=settings.RAG_CHROMA_PATH,
                chroma_collection=settings.RAG_CHROMA_COLLECTION,
            )

            # Initialize RAG service
            classifier_path = (
                Path(settings.OUTLIER_CLASSIFIER_PATH)
                if settings.OUTLIER_DETECTION_ENABLED
                else None
            )
            init_rag_service(
                rag_settings=rag_settings,
                classifier_path=classifier_path,
            )
            logger.info("✓ RAG service initialized")
        except Exception as e:
            logger.warning(f"⚠ Failed to initialize RAG service: {e}")
            logger.warning("  RAG will not be available")

    logger.info("✓ Backend started successfully")

    yield

    # Shutdown
    logger.info("Shutting down Knowledge Base RAG Backend...")
    await close_db()
    if settings.RAG_ENABLED:
        shutdown_rag_service()
    logger.info("✓ Backend shutdown complete")


app = FastAPI(
    docs_url="/api/docs", title="Knowledge Base RAG Backend API", lifespan=lifespan
)

# Configure CORS - must use explicit origins with credentials (cannot use "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Authorization", "Content-Type"],
)

app.include_router(user_router)
app.include_router(dialogue_router)
app.include_router(message_router)
app.include_router(source_router)
app.include_router(folder_router)
app.include_router(code_router)
app.include_router(dataset_router)
