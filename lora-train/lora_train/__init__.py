from importlib import import_module
from typing import TYPE_CHECKING

from lora_train.config import DataConfig, LoraTrainConfig, ModelConfig, TrainingConfig

if TYPE_CHECKING:
    from lora_train.data import build_datasets
    from lora_train.model import attach_lora, load_model_and_tokenizer
    from lora_train.train import run_training

__all__ = [
    "DataConfig",
    "LoraTrainConfig",
    "ModelConfig",
    "TrainingConfig",
    "attach_lora",
    "build_datasets",
    "load_model_and_tokenizer",
    "run_training",
]


def __getattr__(name: str) -> object:
    """Load training dependencies only when a training operation is requested."""
    modules = {
        "build_datasets": "data",
        "attach_lora": "model",
        "load_model_and_tokenizer": "model",
        "run_training": "train",
    }
    if name not in modules:
        raise AttributeError(name)
    return getattr(import_module(f"lora_train.{modules[name]}"), name)
