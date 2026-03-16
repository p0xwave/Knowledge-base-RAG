"""Pydantic модели для Dialogue API."""

from enum import Enum

from pydantic import BaseModel


class IconsEnum(str, Enum):
    """Иконки для pre-generated queries."""

    database = "database"
    doc = "doc"
    browser = "browser"


class PreGeneratedQuery(BaseModel):
    """Pre-generated query с иконкой."""

    query: str
    icon: IconsEnum


class CreateDialogue(BaseModel):
    """Модель для создания диалога."""

    name: str = "New conversation"


class UpdateDialogue(BaseModel):
    """Модель для обновления диалога."""

    name: str | None = None


class DialogueResponse(BaseModel):
    """Полная информация о диалоге."""

    dialogue_id: int
    name: str
    created_at: str  # ISO format datetime
    updated_at: str  # ISO format datetime
    pre_generated_queries: list[PreGeneratedQuery]


class ShortDialogue(BaseModel):
    """Краткая информация о диалоге (для списка)."""

    dialogue_id: int
    name: str
    created_at: str
    updated_at: str


class ErrorMessage(BaseModel):
    """Модель ошибки."""

    detail: str
