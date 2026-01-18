import io
from datetime import datetime
from enum import Enum

from fastapi import APIRouter, FastAPI, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(docs_url="/api/docs")

user_router = APIRouter(tags=["User"], prefix="/api/user")


class NewMessage(BaseModel):
    dialogue_id: int
    message: str
    edited_message_id: str | None = None


class MessageResponse(BaseModel):
    message_id: int
    response_id: int
    content: str
    sources: list[int]


class MessageFeedbackEnum(Enum):
    like = "like"
    dislike = "dislike"


class ErrorMessage(BaseModel):
    detail: str


class UserAuth(BaseModel):
    email: str
    password: str


class UserChanges(BaseModel):
    email: str | None = None
    username: str | None = None
    old_password: str | None = None
    new_password: str | None = None


class User(BaseModel):
    user_id: int
    email: str
    username: str


class IconsEnum(Enum):
    database = "database"
    doc = "doc"
    browser = "browser"


class PreGeneratedQuery(BaseModel):
    query: str
    icon: IconsEnum


class DialogueMessageResponse(BaseModel):
    message_id: int
    response_id: int
    content: str
    sources: list[int]


class DialogueMessageContent(BaseModel):
    message_id: int
    content: str


class DialogueMessage(BaseModel):
    messages: list[DialogueMessageContent]
    responses: list[DialogueMessageResponse]


class Dialogue(BaseModel):
    dialogue_id: int
    dialogue_name: str = "New conversation"
    pre_generated_queries: list[PreGeneratedQuery]
    messages: list[DialogueMessage] | None = None


class ShortDialogue(BaseModel):
    dialogue_id: int
    dialogue_name: str


class ChangeDialogue(BaseModel):
    dialogue_name: str | None = None


@user_router.post(
    "/auth",
    responses={
        "404": {"model": ErrorMessage},
        "400": {"model": ErrorMessage},
    },
)
async def user_auth(_: UserAuth) -> User:
    return User(user_id=1, email="example@mail.ru", username="example")


@user_router.put(
    "",
    status_code=204,
    responses={
        "404": {"model": ErrorMessage},
        "400": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def user_update(_: UserChanges) -> None:
    return


@user_router.delete(
    "",
    status_code=204,
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def user_delete() -> None:
    return


app.include_router(user_router)


dialogue_router = APIRouter(tags=["Dialogue"], prefix="/api/dialogue")


@dialogue_router.post(
    "",
    responses={
        "401": {"model": ErrorMessage},
    },
)
async def create_dialogue() -> Dialogue:
    return Dialogue(
        dialogue_id=1,
        pre_generated_queries=[PreGeneratedQuery(query="a", icon=IconsEnum.database)],
        messages=[],
    )


@dialogue_router.delete(
    "",
    status_code=204,
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def delete_dialogue(dialogue_id: int) -> None:
    return


@dialogue_router.put(
    "",
    status_code=204,
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def change_dialogue(dialogue_id: int, changes: ChangeDialogue) -> None:
    return


@dialogue_router.get(
    "",
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def get_dialogue(dialogue_id: int) -> Dialogue:
    return Dialogue(
        dialogue_id=1,
        pre_generated_queries=[PreGeneratedQuery(query="a", icon=IconsEnum.database)],
        messages=[],
    )


@dialogue_router.get(
    "/list",
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def get_dialogues(query: str | None = None) -> list[ShortDialogue]:
    return [ShortDialogue(dialogue_id=1, dialogue_name="new")]


app.include_router(dialogue_router)


messages_router = APIRouter(prefix="/api/message", tags=["Message"])


@messages_router.post(
    "",
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def new_message(message: NewMessage) -> MessageResponse:
    return MessageResponse(message_id=1, response_id=1, content="", sources=[1, 2, 3])


@messages_router.post(
    "/feedback",
    status_code=204,
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def message_feedback(message_id: int, feedback: MessageFeedbackEnum) -> None:
    return


app.include_router(messages_router)


sources_router = APIRouter(prefix="/api/source", tags=["Source"])


class SourceType(Enum):
    md = "md"
    txt = "txt"


class SourceForList(BaseModel):
    source_id: int
    name: str
    source_type: SourceType
    size_bytes: int
    load_timestamp: int


class SourcesList(BaseModel):
    total_count: int
    total_size_bytes: int
    last_update_timestamp: float

    page: int
    limit: int
    total_pages: int

    sources: list[SourceForList]


class SourceContent(BaseModel):
    content: str


@sources_router.get(
    "/list",
    responses={
        "401": {"model": ErrorMessage},
    },
)
async def sources_list(
    query: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
) -> SourcesList:
    return SourcesList(
        total_count=0,
        total_size_bytes=0,
        last_update_timestamp=datetime.now().timestamp(),
        page=1,
        limit=1,
        total_pages=1,
        sources=[],
    )


@sources_router.post(
    "",
    responses={
        "400": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def upload_source(file: UploadFile) -> SourceForList:
    return SourceForList(
        source_id=1,
        name="a",
        source_type=SourceType.md,
        size_bytes=123,
        load_timestamp=123,
    )


@sources_router.get(
    "/download",
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def download_file(source_id: int) -> StreamingResponse:
    return StreamingResponse(
        content=io.BytesIO("".encode()),
        media_type="txt",
        headers={"Content-Disposition": "attachment; filename=data.csv"},
    )


@sources_router.get(
    "",
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
)
async def get_source(source_id: int) -> SourceContent:
    return SourceContent(content="")


@sources_router.delete(
    "",
    responses={
        "404": {"model": ErrorMessage},
        "401": {"model": ErrorMessage},
    },
    status_code=204,
)
async def delete_source(source_id: int) -> None:
    return


app.include_router(sources_router)


class CodeExecute(BaseModel):
    response_id: int
    code: str


class CodeExecuteResult(BaseModel):
    executed: bool
    output: str


@app.post("/api/code-executor", tags=["Code executor"])
async def execute_code(code: CodeExecute) -> CodeExecuteResult:
    return CodeExecuteResult(executed=True, output="")
