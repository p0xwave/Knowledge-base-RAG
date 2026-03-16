"""Pydantic модели для Source API."""

from enum import Enum

from pydantic import BaseModel


class SourceType(str, Enum):
    """Тип источника."""

    md = "md"
    txt = "txt"
    pdf = "pdf"
    docx = "docx"


class SourceForList(BaseModel):
    """Источник в списке."""

    source_id: int
    name: str
    source_type: SourceType
    size_bytes: int
    created_at: str


class SourcesList(BaseModel):
    """Список источников с пагинацией."""

    total_count: int
    total_size_bytes: int
    page: int
    limit: int
    total_pages: int
    sources: list[SourceForList]


class SourceContent(BaseModel):
    """Содержимое источника."""

    source_id: int
    name: str
    source_type: SourceType
    content: str
    size_bytes: int
    created_at: str


class ErrorMessage(BaseModel):
    """Модель ошибки."""

    detail: str
