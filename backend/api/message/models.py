from enum import Enum

from pydantic import BaseModel


class MessageFeedbackEnum(str, Enum):
    like = "like"
    dislike = "dislike"


class SendMessage(BaseModel):
    dialogue_id: int
    message: str


class CodeExecution(BaseModel):
    code: str
    success: bool
    stdout: str
    stderr: str
    result: str | None = None
    error: str | None = None


class MessageResponse(BaseModel):
    message_id: int
    user_message: str
    assistant_response: str
    sources: list[str]
    code_executions: list[CodeExecution] = []
    created_at: str


class MessageFeedback(BaseModel):
    message_id: int
    feedback: MessageFeedbackEnum


class ErrorMessage(BaseModel):
    detail: str
