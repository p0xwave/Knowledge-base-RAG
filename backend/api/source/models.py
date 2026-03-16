from enum import Enum

from pydantic import BaseModel


class SourceType(str, Enum):
    md = "md"
    txt = "txt"
    pdf = "pdf"
    docx = "docx"


class SourceForList(BaseModel):
    source_id: int
    name: str
    source_type: SourceType
    size_bytes: int
    created_at: str


class SourcesList(BaseModel):
    total_count: int
    total_size_bytes: int
    page: int
    limit: int
    total_pages: int
    sources: list[SourceForList]


class SourceContent(BaseModel):
    source_id: int
    name: str
    source_type: SourceType
    content: str
    size_bytes: int
    created_at: str


class ErrorMessage(BaseModel):
    detail: str
