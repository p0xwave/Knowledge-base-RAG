import io

from fastapi import APIRouter, Depends, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from db import get_db

from . import controller
from .models import ErrorMessage, SourceContent, SourceForList, SourcesList

router = APIRouter(tags=["Source"], prefix="/api/source")


@router.post(
    "",
    response_model=SourceForList,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorMessage, "description": "Invalid file or file too large"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Загрузить источник",
    description="Загрузка нового источника документа. Поддерживаемые форматы: md, txt, pdf, docx. Максимальный размер: 10 MB. Требует JWT токен.",
)
async def upload_source(
    file: UploadFile,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SourceForList:
    return await controller.upload_source(file, user_id, db)


@router.get(
    "",
    response_model=SourcesList,
    responses={
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Получить список источников",
    description="Возвращает список всех источников пользователя с пагинацией. Поддерживает фильтрацию по имени. Требует JWT токен.",
)
async def get_sources_list(
    query: str | None = Query(
        None, description="Поисковый запрос для фильтрации по имени"
    ),
    page: int = Query(1, ge=1, description="Номер страницы"),
    limit: int = Query(
        10, ge=1, le=100, description="Количество элементов на странице"
    ),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SourcesList:
    return await controller.get_sources_list(user_id, query, page, limit, db)


@router.get(
    "/{source_id}",
    response_model=SourceContent,
    responses={
        404: {"model": ErrorMessage, "description": "Source not found"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Получить содержимое источника",
    description="Возвращает полное содержимое источника по ID. Требует JWT токен.",
)
async def get_source(
    source_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SourceContent:
    return await controller.get_source(source_id, user_id, db)


@router.get(
    "/{source_id}/download",
    responses={
        404: {"model": ErrorMessage, "description": "Source not found"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Скачать источник",
    description="Скачивание файла источника. Требует JWT токен.",
)
async def download_source(
    source_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    filename, content, media_type = await controller.download_source(
        source_id, user_id, db
    )

    return StreamingResponse(
        content=io.BytesIO(content.encode("utf-8")),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete(
    "/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorMessage, "description": "Source not found"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Удалить источник",
    description="Удаление источника документа. Требует JWT токен.",
)
async def delete_source(
    source_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    await controller.delete_source(source_id, user_id, db)
