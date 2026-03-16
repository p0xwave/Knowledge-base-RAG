from enum import Enum

from pydantic import BaseModel


class IconsEnum(str, Enum):
    database = "database"
    doc = "doc"
    browser = "browser"


class PreGeneratedQuery(BaseModel):
    query: str
    icon: IconsEnum


class CreateDialogue(BaseModel):
    name: str = "New conversation"


class UpdateDialogue(BaseModel):
    name: str | None = None


class DialogueResponse(BaseModel):
    dialogue_id: int
    name: str
    created_at: str
    updated_at: str
    pre_generated_queries: list[PreGeneratedQuery]


class ShortDialogue(BaseModel):
    dialogue_id: int
    name: str
    created_at: str
    updated_at: str


class ErrorMessage(BaseModel):
    detail: str
