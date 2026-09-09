"""Configuration dataclasses for LoRA training.

Training knobs live here so they can be logged to W&B or serialized to
disk. Dataset/model revisions, environment details and Git state still
need separate provenance.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from prompt_contract import GROUNDED_CONTRACT, PromptContract

#: Attach LoRA to every linear layer, whatever the architecture names them.
#: The explicit tuple below only covers Llama/Qwen-style naming and silently
#: matches nothing on e.g. Phi (`qkv_proj`) or GPT-NeoX (`query_key_value`).
ALL_LINEAR = "all-linear"

DEFAULT_LORA_TARGETS = (
    "q_proj",
    "k_proj",
    "v_proj",
    "o_proj",
    "gate_proj",
    "up_proj",
    "down_proj",
)


@dataclass
class ModelConfig:
    name: str = "Qwen/Qwen2.5-Coder-7B-Instruct"
    use_qlora: bool = False
    bnb_4bit_quant_type: str = "nf4"
    bnb_4bit_use_double_quant: bool = True
    trust_remote_code: bool = False
    revision: str | None = None


@dataclass
class LoraConfig:
    r: int = 16
    alpha: int = 32
    dropout: float = 0.05
    #: Either an explicit tuple of module names or the string "all-linear",
    #: which lets PEFT resolve the right modules for any architecture.
    target_modules: tuple[str, ...] | str = ALL_LINEAR
    bias: str = "none"


@dataclass
class DataConfig:
    train_jsonl: Path
    val_jsonl: Path
    #: The prompt format this adapter is being trained under. Saved next to
    #: the adapter so serving can verify it is using the same one.
    contract: PromptContract = GROUNDED_CONTRACT
    max_seq_length: int = 4096


@dataclass
class TrainingConfig:
    output_dir: Path
    num_train_epochs: float = 2.0
    per_device_train_batch_size: int = 1
    per_device_eval_batch_size: int = 1
    gradient_accumulation_steps: int = 16
    learning_rate: float = 2e-4
    warmup_ratio: float = 0.03
    lr_scheduler_type: str = "cosine"
    weight_decay: float = 0.0
    max_grad_norm: float = 1.0
    logging_steps: int = 10
    eval_steps: int = 100
    save_steps: int = 200
    save_total_limit: int = 3
    seed: int = 42
    bf16: bool = True
    gradient_checkpointing: bool = True
    optim: str = "paged_adamw_8bit"
    report_to: str = "wandb"
    run_name: str | None = None


@dataclass
class LoraTrainConfig:
    """Top-level container — what gets serialized as the experiment record."""

    model: ModelConfig = field(default_factory=ModelConfig)
    lora: LoraConfig = field(default_factory=LoraConfig)
    data: DataConfig = field(default_factory=lambda: DataConfig(  # type: ignore[call-arg]
        train_jsonl=Path("data/sft/train.jsonl"),
        val_jsonl=Path("data/sft/val.jsonl"),
    ))
    training: TrainingConfig = field(default_factory=lambda: TrainingConfig(
        output_dir=Path("lora-train/runs/default"),
    ))
