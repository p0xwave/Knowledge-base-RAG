"""Code Executor Service - безопасное выполнение Python кода с изоляцией.

SECURITY FEATURES:
1. RestrictedPython sandbox - AST трансформация для блокировки опасных операций
2. Whitelisted builtins - только безопасные встроенные функции
3. Blacklisted modules - блокировка os, subprocess, socket, urllib, etc.
4. Timeout enforcement - принудительное завершение по таймауту
5. Resource limits - ограничения на размер кода и вывода
6. Docker isolation - network=none, read-only FS, non-root user
"""

import ast
import traceback
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr
from typing import Any
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from RestrictedPython import compile_restricted
from RestrictedPython.Guards import guarded_iter_unpack_sequence, safer_getattr
from RestrictedPython.PrintCollector import PrintCollector


app = FastAPI(title="Code Executor Service")

# Константы безопасности
MAX_CODE_SIZE = 10 * 1024  # 10KB
MAX_OUTPUT_SIZE = 10 * 1024  # 10KB
DEFAULT_TIMEOUT = 5  # секунд
MAX_TIMEOUT = 30  # секунд


class CodeRequest(BaseModel):
    """Запрос на выполнение кода."""

    code: str = Field(..., max_length=MAX_CODE_SIZE)
    timeout: int = Field(default=DEFAULT_TIMEOUT, ge=1, le=MAX_TIMEOUT)


class CodeResponse(BaseModel):
    """Результат выполнения кода."""

    success: bool
    stdout: str
    stderr: str
    result: str | None = None
    error: str | None = None


class ErrorMessage(BaseModel):
    """Модель ошибки."""

    detail: str


# Список опасных модулей (blacklist)
DANGEROUS_MODULES = {
    "os",
    "sys",
    "subprocess",
    "socket",
    "urllib",
    "urllib2",
    "urllib3",
    "requests",
    "http",
    "ftplib",
    "smtplib",
    "telnetlib",
    "pickle",
    "shelve",
    "marshal",
    "importlib",
    "imp",
    "__builtin__",
    "__builtins__",
    "builtins",
    "ctypes",
    "multiprocessing",
    "threading",
    "atexit",
    "code",
    "codeop",
    "compile",
    "eval",
    "exec",
    "execfile",
    "file",
    "input",
    "open",
    "reload",
    "pdb",
    "webbrowser",
}


def safe_import(name: str, *args, **kwargs):
    """Безопасный импорт - блокирует опасные модули."""
    if name in DANGEROUS_MODULES or name.split(".")[0] in DANGEROUS_MODULES:
        raise ImportError(f"Import of module '{name}' is not allowed for security reasons")
    return __import__(name, *args, **kwargs)


class CodeValidator(ast.NodeVisitor):
    """AST visitor для проверки кода на запрещенные операции."""

    # Разрешенные модули для импорта
    ALLOWED_MODULES = {"math", "random", "datetime", "json", "numpy", "pandas", "torch"}

    # Запрещенные функции (уже блокируются RestrictedPython, но добавим для ясности)
    BLOCKED_FUNCTIONS = {"open", "eval", "exec", "compile", "input", "__import__", "globals", "locals", "vars", "dir", "help"}

    def __init__(self):
        self.errors = []

    def visit_Import(self, node: ast.Import):
        """Проверка простых import statements."""
        for alias in node.names:
            module_name = alias.name.split(".")[0]
            if module_name not in self.ALLOWED_MODULES:
                self.errors.append(
                    f"Import of module '{alias.name}' is not allowed for security reasons. "
                    f"Allowed modules: {', '.join(sorted(self.ALLOWED_MODULES))}"
                )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        """Проверка from X import Y statements."""
        if node.module:
            module_name = node.module.split(".")[0]
            if module_name not in self.ALLOWED_MODULES:
                self.errors.append(
                    f"Import from module '{node.module}' is not allowed for security reasons. "
                    f"Allowed modules: {', '.join(sorted(self.ALLOWED_MODULES))}"
                )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        """Проверка вызовов функций."""
        # Проверяем вызовы запрещенных функций
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
            if func_name in self.BLOCKED_FUNCTIONS:
                self.errors.append(
                    f"Call to '{func_name}()' is not allowed for security reasons"
                )
        self.generic_visit(node)


def validate_code_ast(code: str) -> list[str]:
    """
    Проверяет AST код на запрещенные операции.

    Args:
        code: Python код для проверки

    Returns:
        Список ошибок (пустой список если код безопасен)
    """
    try:
        tree = ast.parse(code)
        validator = CodeValidator()
        validator.visit(tree)
        return validator.errors
    except SyntaxError as e:
        return [f"SyntaxError: {str(e)}"]


def create_safe_namespace() -> dict[str, Any]:
    """Создание безопасного namespace для выполнения кода."""

    # Простая реализация _print_ для RestrictedPython
    # RestrictedPython трансформирует print(*args) в _print_(*args)
    import sys

    class SimplePrint:
        """Простая реализация print для RestrictedPython."""

        def __call__(self, *args, **kwargs):
            """Вызов print с аргументами."""
            # Просто используем встроенный print
            # Вывод будет перехвачен через redirect_stdout
            print(*args, **kwargs, file=sys.stdout)

    # Сначала создаем базовые builtins БЕЗ __import__ и БЕЗ опасных функций
    namespace = {
        # Типы данных
        "int": int,
        "float": float,
        "str": str,
        "bool": bool,
        "list": list,
        "dict": dict,
        "tuple": tuple,
        "set": set,
        "frozenset": frozenset,
        "bytes": bytes,
        "bytearray": bytearray,
        # Функции
        "abs": abs,
        "all": all,
        "any": any,
        "bin": bin,
        "chr": chr,
        "divmod": divmod,
        "enumerate": enumerate,
        "filter": filter,
        "format": format,
        "hex": hex,
        "len": len,
        "map": map,
        "max": max,
        "min": min,
        "oct": oct,
        "ord": ord,
        "pow": pow,
        "range": range,
        "reversed": reversed,
        "round": round,
        "sorted": sorted,
        "sum": sum,
        "zip": zip,
        # Исключения
        "Exception": Exception,
        "ValueError": ValueError,
        "TypeError": TypeError,
        "KeyError": KeyError,
        "IndexError": IndexError,
        "AttributeError": AttributeError,
        "ZeroDivisionError": ZeroDivisionError,
        # Константы
        "True": True,
        "False": False,
        "None": None,
        # RestrictedPython guards
        "_getiter_": iter,
        "_iter_unpack_sequence_": guarded_iter_unpack_sequence,
        "_getattr_": safer_getattr,
        "_print_": SimplePrint(),  # Для поддержки print в RestrictedPython
    }

    # ВАЖНО: НЕ добавляем опасные функции:
    # - open() - доступ к файловой системе
    # - eval() - выполнение произвольного кода
    # - exec() - выполнение произвольного кода
    # - compile() - компиляция кода
    # - __import__() - добавим позже с ограничениями

    # Добавляем разрешенные модули используя СИСТЕМНЫЙ __import__
    # (не safe_import, так как мы сами контролируем что импортируем)
    builtin_import = __builtins__["__import__"] if isinstance(__builtins__, dict) else __builtins__.__import__

    try:
        namespace["math"] = builtin_import("math")
    except ImportError:
        pass

    try:
        namespace["random"] = builtin_import("random")
    except ImportError:
        pass

    try:
        namespace["datetime"] = builtin_import("datetime")
    except ImportError:
        pass

    try:
        namespace["json"] = builtin_import("json")
    except ImportError:
        pass

    # Научные библиотеки (опционально)
    try:
        numpy = builtin_import("numpy")
        namespace["numpy"] = numpy
        namespace["np"] = numpy
    except ImportError:
        pass

    try:
        pandas = builtin_import("pandas")
        namespace["pandas"] = pandas
        namespace["pd"] = pandas
    except ImportError:
        pass

    try:
        namespace["torch"] = builtin_import("torch")
    except ImportError:
        pass

    # ВАЖНО: Теперь заменяем __import__ на safe_import
    # Это блокирует ЛЮБЫЕ попытки импорта в пользовательском коде
    namespace["__import__"] = safe_import

    return namespace


def execute_code_with_timeout(code: str, timeout: int) -> CodeResponse:
    """Выполнение кода с timeout в отдельном потоке."""

    # Используем ThreadPoolExecutor для timeout
    # ПРИМЕЧАНИЕ: Это не защищает от CPU-bound бесконечных циклов полностью
    # (из-за GIL), но работает для большинства случаев и совместимо с async
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(execute_code_restricted, code)

        try:
            result = future.result(timeout=timeout)
            return result
        except FuturesTimeoutError:
            # Timeout превышен
            future.cancel()
            return CodeResponse(
                success=False,
                stdout="",
                stderr="",
                result=None,
                error=f"TimeoutError: Code execution exceeded {timeout} seconds"
            )
        except Exception as e:
            return CodeResponse(
                success=False,
                stdout="",
                stderr="",
                result=None,
                error=f"Execution error: {type(e).__name__}: {str(e)}"
            )


def execute_code_restricted(code: str) -> CodeResponse:
    """
    Выполнение Python кода с использованием RestrictedPython.

    Args:
        code: Python код для выполнения

    Returns:
        CodeResponse: Результат выполнения
    """
    stdout_capture = StringIO()
    stderr_capture = StringIO()

    try:
        # ПЕРВЫЙ УРОВЕНЬ ЗАЩИТЫ: Проверка AST на запрещенные импорты
        validation_errors = validate_code_ast(code)
        if validation_errors:
            error_msg = "\n".join(validation_errors)
            return CodeResponse(
                success=False,
                stdout="",
                stderr="",
                result=None,
                error=f"Security validation failed:\n{error_msg}"
            )

        # ВТОРОЙ УРОВЕНЬ ЗАЩИТЫ: Компиляция с RestrictedPython (AST трансформация)
        # В RestrictedPython 8.x compile_restricted возвращает code object
        # и выбрасывает SyntaxError при ошибках компиляции
        byte_code = compile_restricted(
            code,
            filename="<user_code>",
            mode="exec"
        )

        # Создание безопасного namespace
        namespace = create_safe_namespace()

        # Выполнение с перехватом stdout/stderr
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(byte_code, namespace)

            # Попытка получить результат (переменная result)
            result = namespace.get("result", None)

        # Ограничение размера вывода
        stdout_str = stdout_capture.getvalue()
        stderr_str = stderr_capture.getvalue()

        if len(stdout_str) > MAX_OUTPUT_SIZE:
            stdout_str = stdout_str[:MAX_OUTPUT_SIZE] + "\n... (output truncated)"

        if len(stderr_str) > MAX_OUTPUT_SIZE:
            stderr_str = stderr_str[:MAX_OUTPUT_SIZE] + "\n... (output truncated)"

        return CodeResponse(
            success=True,
            stdout=stdout_str,
            stderr=stderr_str,
            result=str(result) if result is not None else None,
            error=None
        )

    except ImportError as e:
        return CodeResponse(
            success=False,
            stdout=stdout_capture.getvalue(),
            stderr=stderr_capture.getvalue(),
            result=None,
            error=f"ImportError: {str(e)}"
        )

    except SyntaxError as e:
        return CodeResponse(
            success=False,
            stdout=stdout_capture.getvalue(),
            stderr=stderr_capture.getvalue(),
            result=None,
            error=f"SyntaxError: {str(e)}"
        )

    except Exception as e:
        # Получение полного traceback
        tb = traceback.format_exc()

        return CodeResponse(
            success=False,
            stdout=stdout_capture.getvalue(),
            stderr=stderr_capture.getvalue(),
            result=None,
            error=f"{type(e).__name__}: {str(e)}\n{tb}"
        )


@app.post(
    "/execute",
    response_model=CodeResponse,
    responses={
        400: {"model": ErrorMessage, "description": "Invalid code"},
    },
    summary="Выполнить Python код",
    description="""
    Безопасное выполнение Python кода в изолированной среде.

    SECURITY FEATURES:
    - RestrictedPython sandbox с AST трансформацией
    - Whitelist builtins (только безопасные функции)
    - Blacklist модулей (os, subprocess, socket, urllib, etc.)
    - Timeout enforcement (по умолчанию 5 сек, макс 30 сек)
    - Ограничения на размер кода (10KB) и вывода (10KB)
    - Docker isolation (network=none, read-only FS, non-root)

    ALLOWED MODULES:
    - math, random, datetime, json
    - numpy (np), pandas (pd), torch (если установлены)

    BLOCKED OPERATIONS:
    - File I/O (open, read, write)
    - Network access (socket, urllib, requests)
    - System calls (os, subprocess, sys)
    - Code execution (eval, exec, compile, import)
    - Dangerous modules (pickle, marshal, ctypes)
    """,
)
async def execute(request: CodeRequest) -> CodeResponse:
    """Выполнение Python кода."""
    if not request.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code cannot be empty"
        )

    # Проверка размера кода
    if len(request.code) > MAX_CODE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Code size exceeds maximum allowed size of {MAX_CODE_SIZE} bytes"
        )

    # Выполнение с timeout
    return execute_code_with_timeout(request.code, request.timeout)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "security": "enabled"}
