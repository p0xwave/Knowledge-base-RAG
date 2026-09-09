"""Load and filter documentation chunks from ChromaDB."""

from __future__ import annotations

import re
from dataclasses import dataclass

from loguru import logger

from dataset_synth.config import SynthConfig

# A chunk that is mostly a markdown table or code with little prose makes
# poor Q&A material. Heuristic: ratio of table/pipe lines to total lines.
TABLE_LINE_RE = re.compile(r"^\s*\|")


@dataclass
class Chunk:
    text: str
    source: str


def _looks_table_heavy(text: str, threshold: float = 0.5) -> bool:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return True
    table_lines = sum(1 for ln in lines if TABLE_LINE_RE.match(ln))
    return (table_lines / len(lines)) >= threshold


def load_chunks(config: SynthConfig) -> list[Chunk]:
    """Pull document chunks + their source from ChromaDB, applying filters.

    Filters out: chunks shorter than `min_chunk_chars`, longer than
    `max_chunk_chars`, and table-heavy chunks (poor Q&A source).
    """
    import chromadb

    client = chromadb.PersistentClient(path=config.chroma_path)
    collection = client.get_collection(config.collection_name)
    total = collection.count()
    logger.info("collection {c}: {n} chunks", c=config.collection_name, n=total)

    got = collection.get(include=["documents", "metadatas"])
    docs = got["documents"]
    metas = got["metadatas"] or [{} for _ in docs]

    kept: list[Chunk] = []
    dropped_short = dropped_long = dropped_table = 0
    for text, meta in zip(docs, metas, strict=True):
        if text is None:
            continue
        n = len(text)
        if n < config.min_chunk_chars:
            dropped_short += 1
            continue
        if n > config.max_chunk_chars:
            dropped_long += 1
            continue
        if _looks_table_heavy(text):
            dropped_table += 1
            continue
        kept.append(Chunk(text=text, source=str((meta or {}).get("source", "N/A"))))

    logger.info(
        "chunk filter: kept={kept} dropped(short<{mn}={ds}, long>{mx}={dl}, table={dt})",
        kept=len(kept),
        mn=config.min_chunk_chars,
        ds=dropped_short,
        mx=config.max_chunk_chars,
        dl=dropped_long,
        dt=dropped_table,
    )

    if config.max_chunks and config.max_chunks < len(kept):
        kept = kept[: config.max_chunks]
        logger.info("capped to first {n} chunks (max_chunks)", n=len(kept))

    return kept
