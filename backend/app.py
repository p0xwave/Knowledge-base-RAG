"""Backend API сервис - определение схем и API контрактов."""

from db import close_db, init_db
from fastapi import FastAPI

# Импорт роутеров из модульной структуры
from api.dialogue import router as dialogue_router
from api.message import router as message_router
from api.source import router as source_router
from api.user import router as user_router

app = FastAPI(docs_url="/api/docs", title="Knowledge Base RAG Backend API")

# Lifecycle events
app.add_event_handler("startup", init_db)
app.add_event_handler("shutdown", close_db)

# Подключение роутеров
app.include_router(user_router)
app.include_router(dialogue_router)
app.include_router(message_router)
app.include_router(source_router)
