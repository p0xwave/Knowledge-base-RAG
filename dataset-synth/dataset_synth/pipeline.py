"""End-to-end synthetic dataset pipeline.

chunks → teacher Q&A (concurrent) → dedup → context assembly → adversarial
→ optional SO mix → train/val split → JSONL.

Output schema (consumed by lora-train):
    {
        "question": ...,
        "answer": ...,
        "chunks": [{"id": 1, "source": ..., "text": ...}],
        "is_adversarial": bool,
        "source": ...,
    }

`chunks` is stored structurally rather than pre-rendered, so one dataset can
be trained under any prompt contract without being regenerated.
"""

from __future__ import annotations

import json
import random
import re
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, replace
from pathlib import Path

from loguru import logger
from prompt_contract import DEFAULT_REFUSALS
from tqdm import tqdm

from dataset_synth.chunks import Chunk, load_chunks
from dataset_synth.config import SynthConfig
from dataset_synth.teacher import Teacher

# Refusal text is sourced from the versioned prompt-contract package.
ADVERSARIAL_ANSWERS = DEFAULT_REFUSALS

_NORM_RE = re.compile(r"[^\w\s]+", re.UNICODE)
_WS_RE = re.compile(r"\s+")


@dataclass
class Record:
    question: str
    answer: str
    context: str
    is_adversarial: bool
    source: str
    #: The context as a list of chunks, in the order the model will see them.
    #: Kept structured rather than pre-rendered so the same dataset can be
    #: trained under any prompt contract without regenerating it.
    chunks: list[dict] = field(default_factory=list)

    def to_json(self) -> dict:
        return {
            "question": self.question,
            "answer": self.answer,
            "chunks": self.chunks,
            "is_adversarial": self.is_adversarial,
            "source": self.source,
        }


def _normalize_q(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).lower()
    text = _NORM_RE.sub(" ", text)
    return _WS_RE.sub(" ", text).strip()


def _generate_all(
    chunks: list[Chunk], teacher: Teacher, max_workers: int
) -> list[Record]:
    """Concurrent teacher generation over all chunks."""
    records: list[Record] = []

    def _work(chunk: Chunk) -> list[Record]:
        pairs = teacher.generate(chunk.text)
        return [
            Record(
                question=p.question,
                answer=p.answer,
                context=chunk.text,
                is_adversarial=False,
                source=chunk.source,
            )
            for p in pairs
        ]

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_work, c): i for i, c in enumerate(chunks)}
        ordered: dict[int, list[Record]] = {}
        for fut in tqdm(as_completed(futures), total=len(futures), desc="teacher gen"):
            ordered[futures[fut]] = fut.result()
        for index in range(len(chunks)):
            records.extend(ordered[index])

    logger.info(
        "generated {n} raw pairs from {c} chunks", n=len(records), c=len(chunks)
    )
    return records


def _dedup(records: list[Record]) -> list[Record]:
    seen: set[str] = set()
    out: list[Record] = []
    for r in records:
        key = _normalize_q(r.question)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(r)
    logger.info("dedup: {a} → {b} unique questions", a=len(records), b=len(out))
    return out


def _chunk_dict(chunk_id: int, text: str, source: str) -> dict:
    return {"id": chunk_id, "source": source, "text": text}


class _DistractorPool:
    """Samples wrong-but-plausible chunks to pad a training context.

    Prefers chunks from the same directory as the gold chunk: a distractor
    pulled from an unrelated section of the docs is trivially ignorable, so
    training against those teaches the model far less than near-misses do.
    """

    def __init__(self, chunks: list[Chunk], rng: random.Random) -> None:
        self._all = chunks
        self._rng = rng
        self._by_group: dict[str, list[Chunk]] = defaultdict(list)
        for c in chunks:
            self._by_group[self._group_of(c.source)].append(c)

    @staticmethod
    def _group_of(source: str) -> str:
        parent = Path(source).parent
        return parent.name or str(parent)

    def sample_for(self, n: int, gold: Chunk, near_fraction: float) -> list[Chunk]:
        """Distractors for a gold chunk, grouped by the gold chunk's folder."""
        near_pool = self._by_group.get(self._group_of(gold.source), [])
        picked: list[Chunk] = []
        seen = {gold.text}
        attempts = 0
        while len(picked) < n and attempts < max(n, 1) * 20:
            attempts += 1
            use_near = near_pool and self._rng.random() < near_fraction  # noqa: S311
            pool = near_pool if use_near else self._all
            cand = self._rng.choice(pool)  # noqa: S311
            if cand.text in seen:
                continue
            seen.add(cand.text)
            picked.append(cand)
        return picked


def _assemble_contexts(
    records: list[Record], chunks: list[Chunk], cfg: SynthConfig
) -> None:
    """Fill each record's `chunks` with the gold chunk plus distractors.

    The gold chunk lands at a random position, so the model cannot learn
    "the answer is always in the first snippet" — a shortcut that evaporates
    the moment a real reranker reorders the context.
    """
    rng = random.Random(cfg.seed + 1)  # noqa: S311 - dataset shuffling, not crypto
    pool = _DistractorPool(chunks, rng)
    by_text = {c.text: c for c in chunks}
    n_extra = max(0, cfg.context_chunks - 1)

    for r in records:
        gold = by_text.get(r.context) or Chunk(text=r.context, source=r.source)
        distractors = pool.sample_for(n_extra, gold, cfg.near_distractor_fraction)
        window = [*distractors, gold]
        rng.shuffle(window)
        r.chunks = [
            _chunk_dict(i, c.text, c.source) for i, c in enumerate(window, start=1)
        ]

    logger.info(
        "assembled contexts: {k} chunk(s) per example ({e} distractor(s))",
        k=cfg.context_chunks,
        e=n_extra,
    )


def _add_adversarial(
    records: list[Record], chunks: list[Chunk], cfg: SynthConfig
) -> list[Record]:
    rng = random.Random(cfg.seed)  # noqa: S311 - dataset shuffling, not crypto
    n_adv = int(len(records) * cfg.adversarial_fraction)
    if n_adv <= 0 or len(chunks) < 2:
        return records

    pool = _DistractorPool(chunks, rng)
    sampled = rng.sample(records, n_adv)
    adversarial: list[Record] = []
    for r in sampled:
        # every chunk in the window is wrong — the gold one is deliberately absent
        gold = Chunk(text=r.context, source=r.source)
        wrong = pool.sample_for(cfg.context_chunks, gold, cfg.near_distractor_fraction)
        if not wrong:
            continue
        adversarial.append(
            Record(
                question=r.question,
                answer=rng.choice(ADVERSARIAL_ANSWERS),  # noqa: S311
                context=wrong[0].text,
                is_adversarial=True,
                source="adversarial",
                chunks=[
                    _chunk_dict(i, c.text, c.source)
                    for i, c in enumerate(wrong, start=1)
                ],
            )
        )

    combined = records + adversarial
    rng.shuffle(combined)
    logger.info(
        "added {n} adversarial ({p:.0f}%); total={t}",
        n=len(adversarial),
        p=100 * len(adversarial) / len(combined),
        t=len(combined),
    )
    return combined


def _load_mix(cfg: SynthConfig, synth_count: int) -> list[Record]:
    """Optionally blend in prepared StackOverflow rows for a hybrid dataset."""
    if not cfg.mix_jsonl or cfg.mix_fraction <= 0:
        return []
    path = Path(cfg.mix_jsonl)
    if not path.exists():
        logger.warning("mix_jsonl not found, skipping: {p}", p=path)
        return []

    rows: list[Record] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            source = d.get("source", "stackoverflow")
            context = d.get("context", "")
            # Rows from dataset-prep carry a flat context string; wrap it as a
            # single chunk so mixed datasets stay uniform downstream.
            mix_chunks = d.get("chunks") or [_chunk_dict(1, context, source)]
            rows.append(
                Record(
                    question=d.get("question", ""),
                    answer=d.get("answer", ""),
                    context=context,
                    is_adversarial=bool(d.get("is_adversarial", False)),
                    source=source,
                    chunks=mix_chunks,
                )
            )

    n_take = int(synth_count * cfg.mix_fraction)
    rng = random.Random(cfg.seed)  # noqa: S311 - dataset shuffling, not crypto
    if n_take < len(rows):
        rows = rng.sample(rows, n_take)
    logger.info("mixing in {n} StackOverflow rows from {p}", n=len(rows), p=path)
    return rows


def _split_and_write(records: list[Record], cfg: SynthConfig) -> dict[str, int]:
    rng = random.Random(cfg.seed)  # noqa: S311 - dataset shuffling, not crypto
    rng.shuffle(records)
    n_val = max(1, int(len(records) * cfg.val_fraction))
    val, train = records[:n_val], records[n_val:]

    out_dir = Path(cfg.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in (("train", train), ("val", val)):
        path = out_dir / f"{name}.jsonl"
        with path.open("w", encoding="utf-8") as f:
            for r in rows:
                json.dump(r.to_json(), f, ensure_ascii=False)
                f.write("\n")
        logger.info("wrote {n} rows → {p}", n=len(rows), p=path)

    return {"train": len(train), "val": len(val)}


def run_synth(cfg: SynthConfig) -> dict[str, int]:
    """Run the full synthetic-generation pipeline. Returns summary counts."""
    return run_synth_from_chunks(cfg, load_chunks(cfg))


def run_synth_from_chunks(cfg: SynthConfig, chunks: list[Chunk]) -> dict[str, int]:
    """Generate from supplied chunks without opening or mutating Chroma."""
    if not chunks:
        raise RuntimeError("no chunks after filtering — check chroma_path / filters")

    if cfg.max_chunks:
        chunks = chunks[: cfg.max_chunks]
    # Exact duplicate contexts must not cross the holdout boundary.
    if cfg.split_by_context:
        chunks = list({chunk.text: chunk for chunk in chunks}.values())
    teacher = Teacher(cfg)
    records = _generate_all(chunks, teacher, cfg.max_workers)
    if not records:
        raise RuntimeError("teacher produced 0 pairs — check teacher endpoint / model")

    records = _dedup(records)
    if cfg.split_by_context:
        return _write_context_holdout(records, chunks, cfg)
    synth_count = len(records)
    _assemble_contexts(records, chunks, cfg)
    records = _add_adversarial(records, chunks, cfg)
    records.extend(_load_mix(cfg, synth_count))

    summary = _split_and_write(records, cfg)
    summary.update(
        {
            "chunks_used": len(chunks),
            "synth_pairs": synth_count,
            "context_chunks": cfg.context_chunks,
            "total_rows": summary["train"] + summary["val"],
        }
    )
    logger.info("synth pipeline done: {s}", s=summary)
    return summary


def _write_context_holdout(
    records: list[Record], chunks: list[Chunk], cfg: SynthConfig
) -> dict[str, int]:
    """Split gold contexts BEFORE adding distractors/refusals to prevent leakage.

    Chunk-level holdout: chunks of the same document can be in both splits.
    The lab records this limitation in the manifest.
    """
    contexts = sorted({record.context for record in records})
    if len(contexts) < 2:
        raise RuntimeError("Need generated pairs from at least two distinct chunks")
    rng = random.Random(cfg.seed)  # noqa: S311 - reproducible dataset split
    rng.shuffle(contexts)
    n_val = max(1, int(len(contexts) * cfg.val_fraction))
    holdout = set(contexts[:n_val])
    out = Path(cfg.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    counts = {}
    for split, is_val in (("train", False), ("val", True)):
        rows = [r for r in records if (r.context in holdout) == is_val]
        pool = [c for c in chunks if (c.text in holdout) == is_val]
        _assemble_contexts(rows, pool, cfg)
        rows = _add_adversarial(
            rows, pool, replace(cfg, context_chunks=min(cfg.context_chunks, len(pool)))
        )
        rng.shuffle(rows)
        with (out / f"{split}.jsonl").open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row.to_json(), ensure_ascii=False) + "\n")
        counts[split] = len(rows)
    return {
        **counts,
        "chunks_used": len(chunks),
        "synth_pairs": len(records),
        "total_rows": sum(counts.values()),
        "context_chunks": cfg.context_chunks,
    }
