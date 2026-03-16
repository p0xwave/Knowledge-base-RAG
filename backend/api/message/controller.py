import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import Dialogue, Message

from .code_parser import parse_and_execute_code
from .models import CodeExecution, MessageFeedback, MessageResponse, SendMessage

RAG_API_URL = "http://localhost:8000/forward"
CODE_EXECUTOR_URL = "http://localhost:8002/execute"


async def send_message(
    data: SendMessage, user_id: int, db: AsyncSession
) -> MessageResponse:
    result = await db.execute(
        select(Dialogue).where(
            Dialogue.id == data.dialogue_id, Dialogue.user_id == user_id
        )
    )
    dialogue = result.scalar_one_or_none()

    if not dialogue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dialogue not found"
        )

    new_message = Message(
        dialogue_id=data.dialogue_id, user_message=data.message, assistant_response=None
    )

    db.add(new_message)
    await db.flush()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            rag_response = await client.post(
                RAG_API_URL, json={"text": data.message, "tg_user_id": user_id}
            )
            rag_response.raise_for_status()
            rag_data = await rag_response.json()

            assistant_response = rag_data.get("response", "")

    except httpx.RequestError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"RAG API unavailable: {str(e)}",
        )
    except httpx.HTTPStatusError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG API error: {e.response.status_code}",
        )

    new_message.assistant_response = assistant_response

    await db.commit()
    await db.refresh(new_message)

    sources = extract_sources_from_response(assistant_response)

    code_results = await parse_and_execute_code(assistant_response, CODE_EXECUTOR_URL)
    code_executions = [CodeExecution(**result) for result in code_results]

    return MessageResponse(
        message_id=new_message.id,
        user_message=new_message.user_message,
        assistant_response=new_message.assistant_response,
        sources=sources,
        code_executions=code_executions,
        created_at=new_message.created_at.isoformat(),
    )


async def set_message_feedback(
    data: MessageFeedback, user_id: int, db: AsyncSession
) -> None:
    result = await db.execute(
        select(Message)
        .join(Dialogue, Message.dialogue_id == Dialogue.id)
        .where(Message.id == data.message_id, Dialogue.user_id == user_id)
    )
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found"
        )

    message.feedback = data.feedback.value

    await db.commit()


def extract_sources_from_response(response: str) -> list[str]:
    import re

    sources = []
    citation_pattern = r"\[§(\d+)\]"
    citations = re.findall(citation_pattern, response)

    if citations:
        sources = [
            f"https://pytorch.org/docs/stable/source_{n}.html" for n in set(citations)
        ]

    return sources
