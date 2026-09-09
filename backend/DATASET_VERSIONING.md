# Версионирование датасетов

Датасет — именованная коллекция данных владельца: документы для ответов,
пользовательские Source, train/validation/eval, индексы и артефакты моделей.
Версии создаются явно. Загрузка через /api/source автоматически версию не создаёт.

## Хранение и удаление

PostgreSQL хранит datasets, dataset_versions, dataset_version_files и
dataset_storage_lock. init_db создаёт новые таблицы через create_all; существующие
Source не мигрируют. Для rollout нужны DDL-права. Это первая схема фичи;
автоматического upgrade промежуточных прототипов нет.

Байты находятся в DATASET_STORAGE_PATH/blobs/<prefix>/<sha256>. Одинаковые байты
хранятся один раз, независимо от имени файла, версии и владельца. Доступ всегда
проверяется через владельца датасета; прямого API по хешу нет. Файл читается
порциями, публикуется атомарно, checksum проверяется перед чтением.

Версия содержит полный манифест ссылок на blobs. base_version_id наследует состав
и runtime базовой версии; новые файлы заменяют совпадающие пути, removed_paths
убирает пути только из новой версии. Базовую версию можно удалить: наследники
ссылаются непосредственно на blobs. base_version_id остаётся историческим числом
и может указывать на удалённую версию.

Удаление сначала коммитит удаление ссылок в БД, затем collect_garbage удаляет только
blobs, на которые не ссылается ни одна версия. Отмена создания может оставить
безопасный orphan blob; следующий GC его уберёт. Ошибка очистки не возвращает
удалённую версию: GC можно повторить. Python-клиент коммитит delete самостоятельно,
затем вызывает collect_garbage в новой транзакции и коммитит её.

Создание, скачивание, материализация и GC используют одну транзакционную блокировку
БД. Это ограничивает параллелизм, особенно при больших загрузках/скачиваниях;
при необходимости высокой пропускной способности потребуется более узкая блокировка.
После материализации обучение/ответы работают с отдельной копией без этой блокировки.
Все процессы должны использовать одну БД и одно общее хранилище. Резервируйте
БД и blobs согласованно; отдельного backup PostgreSQL больше недостаточно.

| Backend Settings/env | Default |
|---|---|
| DATASET_STORAGE_PATH | data/dataset-versions относительно корня проекта |
| DATASET_VERSION_MAX_BYTES | 107374182400 (100 GiB логического размера версии) |
| DATASET_VERSION_MAX_FILES | 10000 |
| DATASET_FILE_CHUNK_BYTES | 1048576 |

Лимит относится ко всему составу, включая унаследованные файлы. Рабочая копия
для RAG/обучения требует дополнительного места размером с версию.
Multipart временно буферизуется Starlette до сервисной проверки: HTTP body limits
и квоты временного диска задавайте на ingress. Лимит версии не заменяет ingress limit.

Содержимое версии неизменяемо; PATCH меняет только label/description.
Номер монотонный внутри датасета, удалённые номера не переиспользуются.
SHA-256 версии — UTF-8 JSON объекта с files (отсортированные тройки path/hash/size)
и runtime, sort_keys=True, ensure_ascii=True, separators=(",", ":").
Label, время и идентификаторы в checksum не входят.
Пути относительные POSIX, без .., пустых сегментов, управляющих символов и
конфликтов файла с каталогом. Source сохраняется как sources/{id}/{name};
изменение или удаление исходного Source не влияет на версию.

## Backend API для фронтенда

База /api/dataset, Authorization: Bearer token. OpenAPI: /api/docs и openapi.json/yaml.

| Метод | Суффикс | Действие |
|---|---|---|
| POST | пустой | JSON name, description; создание датасета |
| GET | пустой | Список своих датасетов |
| GET/PATCH/DELETE | /{dataset_id} | Чтение, изменение метаданных, удаление с версиями |
| POST | /{dataset_id}/versions | Создание версии, multipart |
| GET | /{dataset_id}/versions | Версии, новые первыми |
| GET/PATCH/DELETE | /{dataset_id}/versions/{version_id} | Метаданные, label/description, удаление |
| GET | /{dataset_id}/versions/{version_id}/files | Манифест файлов |
| GET | /{dataset_id}/versions/{version_id}/files/{file_id}/download | Исходные байты |

Создание: 201, чтение/PATCH: 200, DELETE: 204. Списки: items, total, offset, limit;
offset >= 0, limit 1..100 (default 20). Ошибки detail: 401/403 auth, 404 чужой или
отсутствующий ресурс, 413 лимит, 422 невалидные данные. null в PATCH запрещён.

Multipart-поля: label, description, повторяемые files и source_ids,
base_version_id, повторяемые removed_paths, runtime (JSON RuntimeManifest).
Нужен непустой итоговый состав. filename upload — путь внутри снимка.
HTTP не принимает пути к файлам сервера. Runtime и его пути валидируются,
но загрузка файлов через HTTP не доказывает согласованность переданного индекса.

    const body = new FormData();
    body.append("base_version_id", String(previousVersionId));
    body.append("label", "v2");
    body.append("files", changedFile, "train.jsonl");
    body.append("removed_paths", "obsolete.jsonl");

Отправьте body методом POST на путь создания версии с Bearer token.
Content-Type для FormData выставляет браузер. Версия возвращает id, dataset_id,
number, base_version_id, runtime, label, description, sha256, file_count,
size_bytes, created_at. Файл: id, path, sha256, size_bytes, source_id.
Download: application/octet-stream, attachment с UTF-8 filename.
Frontend этой задачей не менялся.

## Python: создание и использование

Сервисы используют переданную AsyncSession, делают flush, но не commit.
Ошибки CRUD — HTTPException. Файловые ошибки и повреждение снимка не скрываются.

    from api.dataset.models import LocalSnapshotFile, VersionCreate
    from services.dataset_service import create_version

    async with session.begin():
        version = await create_version(
            session, user_id, dataset_id,
            VersionCreate(
                base_version_id=previous_version_id,
                local_files=[LocalSnapshotFile(path="train.jsonl", local_path=train_path)],
            ),
        )

Для небольших данных есть SnapshotFile(path, content=bytes), для Source — source_ids.
read_version_file возвращает байты в памяти; для больших артефактов используйте
materialize_version. Запоминайте dataset_id, version_id, sha256 в manifest эксперимента.

services.dataset_runtime предоставляет:

- capture_rag_version(session, user_id, dataset_id, rag_settings, prompt_contract,
  index_is_quiescent=True): документы, закрытый Chroma целиком (включая эмбеддинги),
  локальные каталоги embedding/reranker/generator, их revision, prompt и параметры
  retrieval/generation.
- capture_training_version(session, user_id, dataset_id, training_config):
  train/validation, prompt, конфигурация обучения, локальная base model,
  готовый adapter из output_dir/final, если он существует.
- capture_runtime_version: явный RuntimeManifest, отдельные файлы и каталоги
  LocalSnapshotFile для доверенного Python-кода.

Перед capture_rag_version остановите всех писателей и закройте Chroma-клиенты.
Флаг — подтверждение вызывающего кода, а не механизм остановки.
Изменение состава/статистик файлов во время захвата отменяет версию.
Shared bundled Chroma не является tenant-isolated: не передавайте его снимок
произвольному пользователю. В HTTP автоматического чтения этого индекса нет.

Локальные веса/tokenizer копируются как файлы и дедуплицируются. Если модель задана
удалённым ID, сохраняются ID/revision, а не недоступные веса. Для воспроизводимости
фиксируйте immutable revision либо передавайте готовый локальный каталог.
API generator должен быть отдельно развёрнут под сохранённым ID: этот код
не поднимает сервер модели. Optimizer/resume state автоматически не сохраняется.
Пакет lora-train нужен для training helpers; установите его в окружение запуска
обучения. Его конфигурация импортируется без загрузки GPU-training зависимостей.

Runtime не хранит API keys/endpoint. RAG принимает их через текущие RagSettings.
Автосбор каталогов отвергает .env и .env.*; произвольное содержимое пользовательских
файлов не проходит универсальную redaction — не передавайте файлы с секретами.

    import asyncio
    from services.dataset_runtime import materialize_version

    # session должна быть без активной транзакции.
    async with materialize_version(session, user_id, dataset_id, version_id) as snapshot:
        rag = await asyncio.to_thread(snapshot.rag_service, connection_settings)
        strategy = snapshot.version.runtime.rag.strategy
        response = await asyncio.to_thread(rag.answer_question, question, strategy=strategy)

Восстановление проверяет checksum каждого файла, копирует их в временный каталог
и удаляет его после выхода. Мутация рабочей копии не портит версию.
Для индекса требуется точная версия chromadb из manifest, чтобы не запускать
неявную миграцию. Остальные package versions записываются для provenance.
Восстановленный сервис использует сохранённый prompt; top_k должен совпадать с
context_chunks. Topic classifier не включён автоматически.
Текущий chat endpoint не переключается на версию сам.

    from lora_train.train import run_training

    async with materialize_version(session, user_id, dataset_id, version_id) as snapshot:
        config = await asyncio.to_thread(snapshot.training_config, new_output_directory)
        # Только в явно запущенном training job с нужными зависимостями/GPU:
        await asyncio.to_thread(run_training, config)

Конфигурация с trust_remote_code=True отвергается при восстановлении.
report_to и остальные настройки обучения сохраняются: запуск job может включать
W&B, если он был включён в исходной конфигурации. Helper не запускает обучение сам.

## Проверки

Из подготовленного окружения, из корня:

    PYTHONPATH=backend:prompt-contract:lora-train HF_HUB_OFFLINE=1 .venv/bin/python -m pytest backend/tests/api/test_dataset.py -q

Тесты используют временные SQLite/файлы/Chroma, fake модели, без LLM и GPU jobs.
PostgreSQL startup/idempotence и конкуренцию отдельных соединений нужно отдельно
проверить на одноразовой PostgreSQL БД; SQLite не является доказательством этих свойств.

Локальная проверка 2026-09-06: 46 dataset-тестов и 10 prompt-contract-тестов
прошли вместе с явным `-c backend/pyproject.toml`. Ruff проверен на изменённых
Python-файлах, кроме существующего ARG001 в app.py. Pyright прошёл для новых
модулей, тестов, ORM/settings, RagService/factory/config и LoRA config/package;
отдельный lora_train/model.py упирается в отсутствующий в этом окружении peft.
Black проверен для новых модулей и форматируемых изменённых файлов, без массового
переформатирования старых ORM/ML-файлов. Lock check, git diff --check и равенство
обоих OpenAPI snapshot с app.openapi() прошли. Реальные PostgreSQL startup/
конкуренция, GPU training и внешняя LLM не запускались.
