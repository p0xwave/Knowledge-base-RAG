import re

import httpx


async def extract_python_code(text: str) -> list[str]:
    pattern = r"```(?:python|py)\n(.*?)```"
    matches = re.findall(pattern, text, re.DOTALL)

    return [match.strip() for match in matches if match.strip()]


async def execute_code_block(code: str, executor_url: str, timeout: int = 10) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                executor_url, json={"code": code, "timeout": 5}
            )
            response.raise_for_status()
            return await response.json()

    except httpx.RequestError as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": "",
            "result": None,
            "error": f"Code executor unavailable: {str(e)}",
        }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": "",
            "result": None,
            "error": f"Code executor error: {e.response.status_code}",
        }


async def parse_and_execute_code(text: str, executor_url: str) -> list[dict]:
    code_blocks = await extract_python_code(text)

    if not code_blocks:
        return []

    results = []
    for code in code_blocks:
        result = await execute_code_block(code, executor_url)
        results.append({"code": code, **result})

    return results
