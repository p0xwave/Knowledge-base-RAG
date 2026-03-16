import math

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import Source

from .models import SourceContent, SourceForList, SourcesList, SourceType

MAX_FILE_SIZE = 10 * 1024 * 1024


async def upload_source(
    file: UploadFile, user_id: int, db: AsyncSession
) -> SourceForList:
    content = await file.read()
    size_bytes = len(content)

    if size_bytes > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024} MB",
        )

    if size_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty"
        )

    filename = file.filename or "unknown.txt"
    file_extension = filename.split(".")[-1].lower() if "." in filename else "txt"

    try:
        source_type = SourceType(file_extension)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file_extension}. Supported: {[t.value for t in SourceType]}",
        )

    try:
        content_str = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 encoded text",
        )

    new_source = Source(
        user_id=user_id,
        name=filename,
        source_type=source_type.value,
        content=content_str,
        size_bytes=size_bytes,
    )

    db.add(new_source)
    await db.commit()
    await db.refresh(new_source)

    return SourceForList(
        source_id=new_source.id,
        name=new_source.name,
        source_type=SourceType(new_source.source_type),
        size_bytes=new_source.size_bytes,
        created_at=new_source.created_at.isoformat(),
    )


async def get_sources_list(
    user_id: int, query: str | None, page: int, limit: int, db: AsyncSession
) -> SourcesList:
    stmt = select(Source).where(Source.user_id == user_id)

    if query:
        stmt = stmt.where(Source.name.ilike(f"%{query}%"))

    count_stmt = select(func.count(Source.id)).where(Source.user_id == user_id)
    if query:
        count_stmt = count_stmt.where(Source.name.ilike(f"%{query}%"))
    total_count_result = await db.execute(count_stmt)
    total_count = total_count_result.scalar() or 0

    size_stmt = select(func.sum(Source.size_bytes)).where(Source.user_id == user_id)
    if query:
        size_stmt = size_stmt.where(Source.name.ilike(f"%{query}%"))
    total_size_result = await db.execute(size_stmt)
    total_size_bytes = total_size_result.scalar() or 0

    offset = (page - 1) * limit
    stmt = stmt.order_by(Source.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(stmt)
    sources = result.scalars().all()

    total_pages = math.ceil(total_count / limit) if limit > 0 else 0

    return SourcesList(
        total_count=total_count,
        total_size_bytes=total_size_bytes,
        page=page,
        limit=limit,
        total_pages=total_pages,
        sources=[
            SourceForList(
                source_id=source.id,
                name=source.name,
                source_type=SourceType(source.source_type),
                size_bytes=source.size_bytes,
                created_at=source.created_at.isoformat(),
            )
            for source in sources
        ],
    )


async def get_source(source_id: int, user_id: int, db: AsyncSession) -> SourceContent:
    result = await db.execute(
        select(Source).where(Source.id == source_id, Source.user_id == user_id)
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source not found"
        )

    return SourceContent(
        source_id=source.id,
        name=source.name,
        source_type=SourceType(source.source_type),
        content=source.content,
        size_bytes=source.size_bytes,
        created_at=source.created_at.isoformat(),
    )


async def delete_source(source_id: int, user_id: int, db: AsyncSession) -> None:
    result = await db.execute(
        select(Source).where(Source.id == source_id, Source.user_id == user_id)
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source not found"
        )

    await db.delete(source)
    await db.commit()


async def download_source(
    source_id: int, user_id: int, db: AsyncSession
) -> tuple[str, str, str]:
    result = await db.execute(
        select(Source).where(Source.id == source_id, Source.user_id == user_id)
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source not found"
        )

    media_type_map = {
        "txt": "text/plain",
        "md": "text/markdown",
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    media_type = media_type_map.get(source.source_type, "text/plain")

    return source.name, source.content, media_type
