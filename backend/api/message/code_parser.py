"""Парсинг и выполнение кода из ответов RAG."""

import re
from typing import Optional

import httpx


async def extract_python_code(text: str) -> list[str]:
    """
    Извлечение Python кода из markdown текста.

    Ищет блоки ```python ... ``` и ```py ... ```

    Args:
        text: Текст с markdown

    Returns:
        list[str]: Список блоков кода
    """
    # Паттерн для блоков кода
    pattern = r"```(?:python|py)\n(.*?)```"
    matches = re.findall(pattern, text, re.DOTALL)

    return [match.strip() for match in matches if match.strip()]


async def execute_code_block(code: str, executor_url: str, timeout: int = 10) -> dict:
    """
    Выполнение блока кода через code-executor сервис.

    Args:
        code: Python код для выполнения
        executor_url: URL code-executor API
        timeout: Таймаут выполнения

    Returns:
        dict: Результат выполнения {"success", "stdout", "stderr", "result", "error"}
    """
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                executor_url,
                json={"code": code, "timeout": 5}
            )
            response.raise_for_status()
            return await response.json()

    except httpx.RequestError as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": "",
            "result": None,
            "error": f"Code executor unavailable: {str(e)}"
        }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": "",
            "result": None,
            "error": f"Code executor error: {e.response.status_code}"
        }


async def parse_and_execute_code(
    text: str,
    executor_url: str
) -> list[dict]:
    """
    Парсинг и выполнение всех блоков кода из текста.

    Args:
        text: Текст с markdown кодом
        executor_url: URL code-executor API

    Returns:
        list[dict]: Список результатов выполнения
    """
    code_blocks = await extract_python_code(text)

    if not code_blocks:
        return []

    # Выполнение каждого блока кода
    results = []
    for code in code_blocks:
        result = await execute_code_block(code, executor_url)
        results.append({
            "code": code,
            **result
        })

    return results
