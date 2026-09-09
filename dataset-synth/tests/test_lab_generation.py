import json

import pytest
from dataset_synth.chunks import Chunk
from dataset_synth.config import SynthConfig
from dataset_synth.pipeline import Record, _dedup, _write_context_holdout
from dataset_synth.teacher import _parse_pairs


def test_cyrillic_questions_are_preserved_and_deduplicated():
    records = [
        Record(q, "ответ", "контекст", False, "test")
        for q in [
            "Как работает модель?",
            "КАК работает модель!",
            "Как загрузить данные?",
        ]
    ]
    assert len(_dedup(records)) == 2


@pytest.mark.parametrize(
    "pairs",
    [
        None,
        "bad",
        {},
        [{"question": None, "answer": "text"}],
        [{"question": "q", "answer": ["bad"]}],
    ],
)
def test_teacher_rejects_non_text_pairs(pairs):
    assert _parse_pairs(json.dumps({"pairs": pairs})) == []


def test_holdout_keeps_all_gold_and_distractor_contexts_separate(tmp_path):
    chunks = [Chunk(text=f"unique body {i}", source=f"file{i}.txt") for i in range(20)]
    records = [
        Record(f"Question {i} variant {j}", "answer", c.text, False, c.source)
        for i, c in enumerate(chunks)
        for j in range(3)
    ]
    cfg = SynthConfig(
        output_dir=str(tmp_path),
        context_chunks=3,
        val_fraction=0.2,
        adversarial_fraction=0.2,
        split_by_context=True,
    )
    summary = _write_context_holdout(records, chunks, cfg)
    splits = {
        split: [
            json.loads(line)
            for line in (tmp_path / f"{split}.jsonl").read_text().splitlines()
        ]
        for split in ("train", "val")
    }
    texts = {
        split: {c["text"] for row in rows for c in row["chunks"]}
        for split, rows in splits.items()
    }
    assert texts["train"].isdisjoint(texts["val"])
    assert summary["train"] and summary["val"]
    assert any(row["is_adversarial"] for row in splits["val"])
    before = (tmp_path / "train.jsonl").read_bytes()
    _write_context_holdout(records, chunks, cfg)
    assert before == (tmp_path / "train.jsonl").read_bytes()


def test_holdout_fails_if_only_one_context_generated(tmp_path):
    with pytest.raises(RuntimeError, match="at least two"):
        _write_context_holdout(
            [Record("q", "a", "same", False, "f")],
            [Chunk("same", "f")],
            SynthConfig(output_dir=str(tmp_path)),
        )
