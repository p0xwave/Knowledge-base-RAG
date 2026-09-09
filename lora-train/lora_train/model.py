"""Load the base model with optional 4-bit quantization and attach a LoRA adapter.

QLoRA path (enabled explicitly): the base weights are loaded in nf4 and frozen;
only the small LoRA matrices are trained. This reduces base-model memory use.

Plain LoRA path (current default): base weights stay in bf16. It generally needs
more accelerator memory than QLoRA; the actual requirement depends on the model,
optimizer, sequence length and runtime.
"""

from __future__ import annotations

import torch
from loguru import logger
from peft import LoraConfig as PeftLoraConfig
from peft import PeftModel, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    PreTrainedModel,
    PreTrainedTokenizerBase,
)

from lora_train.config import LoraConfig, ModelConfig


def _build_bnb_config(model_cfg: ModelConfig) -> BitsAndBytesConfig:
    return BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type=model_cfg.bnb_4bit_quant_type,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=model_cfg.bnb_4bit_use_double_quant,
    )


def load_model_and_tokenizer(
    config: ModelConfig,
) -> tuple[PreTrainedModel, PreTrainedTokenizerBase]:
    """Load base model + tokenizer. Applies QLoRA quantization if enabled."""
    logger.info("loading tokenizer for {name}", name=config.name)
    tokenizer = AutoTokenizer.from_pretrained(
        config.name,
        revision=config.revision,
        trust_remote_code=config.trust_remote_code,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    logger.info(
        "loading model {name} (qlora={qlora})",
        name=config.name,
        qlora=config.use_qlora,
    )
    load_kwargs: dict = {
        "revision": config.revision,
        "dtype": torch.bfloat16,
        "device_map": "auto",
        "trust_remote_code": config.trust_remote_code,
    }
    if config.use_qlora:
        load_kwargs["quantization_config"] = _build_bnb_config(config)

    model = AutoModelForCausalLM.from_pretrained(config.name, **load_kwargs)
    model.config.use_cache = False  # incompatible with gradient checkpointing

    if config.use_qlora:
        model = prepare_model_for_kbit_training(
            model,
            use_gradient_checkpointing=True,
            gradient_checkpointing_kwargs={"use_reentrant": False},
        )

    return model, tokenizer


def attach_lora(model: PreTrainedModel, lora_cfg: LoraConfig) -> PeftModel:
    """Attach a fresh LoRA adapter to the base model and return the PEFT-wrapped model."""
    # "all-linear" must stay a string — PEFT treats it as a directive to
    # resolve every linear layer itself; listing it would target characters.
    targets = (
        lora_cfg.target_modules
        if isinstance(lora_cfg.target_modules, str)
        else list(lora_cfg.target_modules)
    )
    peft_config = PeftLoraConfig(
        r=lora_cfg.r,
        lora_alpha=lora_cfg.alpha,
        lora_dropout=lora_cfg.dropout,
        target_modules=targets,
        bias=lora_cfg.bias,
        task_type="CAUSAL_LM",
    )
    peft_model = get_peft_model(model, peft_config)

    trainable, total = peft_model.get_nb_trainable_parameters()
    logger.info(
        "lora attached: trainable={trainable:,} ({pct:.4f}% of {total:,})",
        trainable=trainable,
        pct=100 * trainable / total,
        total=total,
    )
    return peft_model
