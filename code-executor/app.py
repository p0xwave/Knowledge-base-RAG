import ast
import traceback
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from typing import Any

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from RestrictedPython import compile_restricted
from RestrictedPython.Guards import guarded_iter_unpack_sequence, safer_getattr

app = FastAPI(title="Code Executor Service")

MAX_CODE_SIZE = 10 * 1024  # 10KB
MAX_OUTPUT_SIZE = 10 * 1024  # 10KB
DEFAULT_TIMEOUT = 5  # секунд
MAX_TIMEOUT = 30  # секунд


class CodeRequest(BaseModel):
    code: str = Field(..., max_length=MAX_CODE_SIZE)
    timeout: int = Field(default=DEFAULT_TIMEOUT, ge=1, le=MAX_TIMEOUT)


class CodeResponse(BaseModel):
    success: bool
    stdout: str
    stderr: str
    result: str | None = None
    error: str | None = None


class ErrorMessage(BaseModel):
    detail: str


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
    if name in DANGEROUS_MODULES or name.split(".")[0] in DANGEROUS_MODULES:
        raise ImportError(
            f"Import of module '{name}' is not allowed for security reasons"
        )
    return __import__(name, *args, **kwargs)


class CodeValidator(ast.NodeVisitor):
    ALLOWED_MODULES = {"math", "random", "datetime", "json", "numpy", "pandas", "torch"}

    BLOCKED_FUNCTIONS = {
        "open",
        "eval",
        "exec",
        "compile",
        "input",
        "__import__",
        "globals",
        "locals",
        "vars",
        "dir",
        "help",
    }

    def __init__(self):
        self.errors = []

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            module_name = alias.name.split(".")[0]
            if module_name not in self.ALLOWED_MODULES:
                self.errors.append(
                    f"Import of module '{alias.name}' is not allowed for security reasons. "
                    f"Allowed modules: {', '.join(sorted(self.ALLOWED_MODULES))}"
                )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            module_name = node.module.split(".")[0]
            if module_name not in self.ALLOWED_MODULES:
                self.errors.append(
                    f"Import from module '{node.module}' is not allowed for security reasons. "
                    f"Allowed modules: {', '.join(sorted(self.ALLOWED_MODULES))}"
                )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
            if func_name in self.BLOCKED_FUNCTIONS:
                self.errors.append(
                    f"Call to '{func_name}()' is not allowed for security reasons"
                )
        self.generic_visit(node)


def validate_code_ast(code: str) -> list[str]:
    try:
        tree = ast.parse(code)
        validator = CodeValidator()
        validator.visit(tree)
        return validator.errors
    except SyntaxError as e:
        return [f"SyntaxError: {str(e)}"]


def create_safe_namespace() -> dict[str, Any]:
    import sys

    class SimplePrint:
        def __call__(self, *args, **kwargs):
            print(*args, **kwargs, file=sys.stdout)

    namespace = {
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
        "Exception": Exception,
        "ValueError": ValueError,
        "TypeError": TypeError,
        "KeyError": KeyError,
        "IndexError": IndexError,
        "AttributeError": AttributeError,
        "ZeroDivisionError": ZeroDivisionError,
        "True": True,
        "False": False,
        "None": None,
        "_getiter_": iter,
        "_iter_unpack_sequence_": guarded_iter_unpack_sequence,
        "_getattr_": safer_getattr,
        "_print_": SimplePrint(),
    }

    builtin_import = (
        __builtins__["__import__"]
        if isinstance(__builtins__, dict)
        else __builtins__.__import__
    )

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

    namespace["__import__"] = safe_import

    return namespace


def execute_code_with_timeout(code: str, timeout: int) -> CodeResponse:
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(execute_code_restricted, code)

        try:
            result = future.result(timeout=timeout)
            return result
        except FuturesTimeoutError:
            future.cancel()
            return CodeResponse(
                success=False,
                stdout="",
                stderr="",
                result=None,
                error=f"TimeoutError: Code execution exceeded {timeout} seconds",
            )
        except Exception as e:
            return CodeResponse(
                success=False,
                stdout="",
                stderr="",
                result=None,
                error=f"Execution error: {type(e).__name__}: {str(e)}",
            )


def execute_code_restricted(code: str) -> CodeResponse:
    stdout_capture = StringIO()
    stderr_capture = StringIO()

    try:
        validation_errors = validate_code_ast(code)
        if validation_errors:
            error_msg = "\n".join(validation_errors)
            return CodeResponse(
                success=False,
                stdout="",
                stderr="",
                result=None,
                error=f"Security validation failed:\n{error_msg}",
            )

        byte_code = compile_restricted(code, filename="<user_code>", mode="exec")

        namespace = create_safe_namespace()

        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(byte_code, namespace)
            result = namespace.get("result", None)

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
            error=None,
        )

    except ImportError as e:
        return CodeResponse(
            success=False,
            stdout=stdout_capture.getvalue(),
            stderr=stderr_capture.getvalue(),
            result=None,
            error=f"ImportError: {str(e)}",
        )

    except SyntaxError as e:
        return CodeResponse(
            success=False,
            stdout=stdout_capture.getvalue(),
            stderr=stderr_capture.getvalue(),
            result=None,
            error=f"SyntaxError: {str(e)}",
        )

    except Exception as e:
        tb = traceback.format_exc()

        return CodeResponse(
            success=False,
            stdout=stdout_capture.getvalue(),
            stderr=stderr_capture.getvalue(),
            result=None,
            error=f"{type(e).__name__}: {str(e)}\n{tb}",
        )


@app.post(
    "/execute",
    response_model=CodeResponse,
    responses={
        400: {"model": ErrorMessage, "description": "Invalid code"},
    },
    summary="Выполнить Python код",
    description="""Безопасное выполнение Python кода в изолированной среде.""",
)
async def execute(request: CodeRequest) -> CodeResponse:
    if not request.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Code cannot be empty"
        )

    if len(request.code) > MAX_CODE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Code size exceeds maximum allowed size of {MAX_CODE_SIZE} bytes",
        )

    return execute_code_with_timeout(request.code, request.timeout)


@app.get("/health")
async def health():
    return {"status": "ok", "security": "enabled"}
