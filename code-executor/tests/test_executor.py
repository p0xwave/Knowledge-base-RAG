import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_execute_simple_code_success(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "result = 2 + 2", "timeout": 5}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["result"] == "4"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_execute_code_with_print(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "print('Hello, World!')\nresult = 42", "timeout": 5}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "Hello, World!" in data["stdout"]
    assert data["result"] == "42"


@pytest.mark.asyncio
async def test_execute_code_with_imports(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "import math\nresult = math.sqrt(16)", "timeout": 5}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["result"] == "4.0"


@pytest.mark.asyncio
async def test_execute_numpy_code(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "result = np.array([1, 2, 3]).sum()", "timeout": 5}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "6" in data["result"]


@pytest.mark.asyncio
async def test_execute_pandas_code(client: AsyncClient):
    response = await client.post(
        "/execute",
        json={
            "code": "df = pd.DataFrame({'a': [1, 2, 3]})\nresult = df['a'].sum()",
            "timeout": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "6" in data["result"]


@pytest.mark.asyncio
async def test_execute_torch_code(client: AsyncClient):
    response = await client.post(
        "/execute",
        json={
            "code": "x = torch.tensor([1, 2, 3])\nresult = x.sum().item()",
            "timeout": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "6" in data["result"]


@pytest.mark.asyncio
async def test_execute_code_with_error(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "result = 1 / 0", "timeout": 5}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert "ZeroDivisionError" in data["error"]


@pytest.mark.asyncio
async def test_execute_code_syntax_error(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "if True\n    print('error')", "timeout": 5}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert "SyntaxError" in data["error"]


@pytest.mark.asyncio
async def test_execute_code_without_result(client: AsyncClient):
    response = await client.post("/execute", json={"code": "x = 5", "timeout": 5})

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["result"] is None


@pytest.mark.asyncio
async def test_execute_empty_code(client: AsyncClient):
    response = await client.post("/execute", json={"code": "", "timeout": 5})

    assert response.status_code == 400
    data = response.json()
    assert "empty" in data["detail"].lower()


@pytest.mark.asyncio
async def test_block_import_os(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "import os\nresult = os.getcwd()", "timeout": 5}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert "not allowed" in data["error"].lower() or "ImportError" in data["error"]


@pytest.mark.asyncio
async def test_block_import_subprocess(client: AsyncClient):
    response = await client.post(
        "/execute",
        json={
            "code": "import subprocess\nresult = subprocess.run(['ls'], capture_output=True)",
            "timeout": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert "not allowed" in data["error"].lower() or "ImportError" in data["error"]


@pytest.mark.asyncio
async def test_block_import_socket(client: AsyncClient):
    response = await client.post(
        "/execute",
        json={"code": "import socket\nresult = socket.socket()", "timeout": 5},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert "not allowed" in data["error"].lower() or "ImportError" in data["error"]


@pytest.mark.asyncio
async def test_block_import_urllib(client: AsyncClient):
    response = await client.post(
        "/execute",
        json={
            "code": "import urllib.request\nresult = urllib.request.urlopen('http://example.com')",
            "timeout": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert "not allowed" in data["error"].lower() or "ImportError" in data["error"]


@pytest.mark.asyncio
async def test_block_import_requests(client: AsyncClient):
    response = await client.post(
        "/execute",
        json={
            "code": "import requests\nresult = requests.get('http://example.com')",
            "timeout": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert (
        "not allowed" in data["error"].lower()
        or "ImportError" in data["error"]
        or "ModuleNotFoundError" in data["error"]
    )


@pytest.mark.asyncio
async def test_block_eval(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "result = eval('2 + 2')", "timeout": 5}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert "SyntaxError" in data["error"] or "not allowed" in data["error"]


@pytest.mark.asyncio
async def test_block_exec(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "exec('result = 42')", "timeout": 5}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert "SyntaxError" in data["error"] or "not allowed" in data["error"]


@pytest.mark.asyncio
async def test_block_open_file(client: AsyncClient):
    response = await client.post(
        "/execute",
        json={
            "code": "with open('/etc/passwd', 'r') as f:\n    result = f.read()",
            "timeout": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert (
        "not allowed" in data["error"] or "Security validation failed" in data["error"]
    )


@pytest.mark.asyncio
async def test_timeout_infinite_loop(client: AsyncClient):
    response = await client.post(
        "/execute", json={"code": "while True:\n    pass", "timeout": 2}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is False
    assert data["error"] is not None
    assert "timeout" in data["error"].lower() or "TimeoutError" in data["error"]


@pytest.mark.asyncio
async def test_max_code_size_limit(client: AsyncClient):
    large_code = "x = 1\n" * 1000  # ~6KB
    large_code += "y = 2\n" * 1000  # ~12KB total

    response = await client.post("/execute", json={"code": large_code, "timeout": 5})

    assert response.status_code == 422
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_output_truncation(client: AsyncClient):
    response = await client.post(
        "/execute",
        json={"code": "for i in range(1000):\n    print('x' * 100)", "timeout": 5},
    )

    assert response.status_code == 200
    data = response.json()

    if data["success"]:
        assert (
            len(data["stdout"]) <= 10240 + 100
        )  # MAX_OUTPUT_SIZE + buffer for truncation message


@pytest.mark.asyncio
async def test_allowed_modules_still_work(client: AsyncClient):
    response = await client.post(
        "/execute",
        json={
            "code": """
import math
import random
import datetime
import json

random.seed(42)
result = {
    'sqrt': math.sqrt(16),
    'random': random.randint(1, 10),
    'now': datetime.datetime.now().year,
    'json': json.dumps({'test': 123})
}
""",
            "timeout": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["result"] is not None
    assert "sqrt" in data["result"]
