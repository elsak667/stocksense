"""LLM 统一接口 + DeepSeek/OpenAI 兼容实现.

任何新 LLM provider 都注册到 llm_registry, 实现 chat() + chat_json() 即可.
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

from openai import AsyncOpenAI

from app.config import get_settings
from app.core.registry import llm_registry

logger = logging.getLogger(__name__)
settings = get_settings()


class LLMProvider(ABC):
    """LLM 提供方统一接口."""

    name: str = ""

    @abstractmethod
    async def chat(self, prompt: str, system: str = "") -> str:
        """普通对话, 返回纯文本."""

    async def chat_json(self, prompt: str, system: str = "") -> dict[str, Any]:
        """要求 LLM 返回 JSON, 自动解析."""
        raw = await self.chat(prompt=prompt, system=system)
        # 容忍 JSON 前后多余文字
        s = raw.strip()
        if "```" in s:
            s = s.split("```")[1]
            if s.startswith("json"):
                s = s[4:]
        start = s.find("{")
        end = s.rfind("}")
        if start == -1 or end == -1:
            logger.warning("LLM 返回无法解析为 JSON: %s", s[:200])
            return {"_raw": s}
        try:
            return json.loads(s[start : end + 1])
        except Exception as e:
            logger.warning("JSON 解析失败 err=%s raw=%s", e, s[:200])
            return {"_raw": s}


@llm_registry.register("openai_compat")
class OpenAICompatProvider(LLMProvider):
    """所有 OpenAI 兼容服务: DeepSeek/智谱/通义/OpenRouter/vLLM 等."""

    name = "openai_compat"

    def __init__(self, base_url: str | None = None, api_key: str | None = None, model: str | None = None):
        self.client = AsyncOpenAI(
            base_url=base_url or settings.llm_base_url,
            api_key=api_key or settings.llm_api_key,
        )
        self.model = model or settings.llm_model

    async def chat(self, prompt: str, system: str = "") -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        try:
            resp = await self.client.chat.completions.create(
                model=self.model, messages=messages, temperature=0.3,
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            logger.error("LLM 调用失败 model=%s err=%s", self.model, e)
            raise


@llm_registry.register("deepseek")
class DeepSeekProvider(OpenAICompatProvider):
    """DeepSeek — 就是 OpenAI 兼容协议, 用 settings 里的 base_url/model."""

    name = "deepseek"

    def __init__(self):
        super().__init__()


def get_llm(provider_name: str | None = None) -> LLMProvider:
    """根据 settings.llm_provider 实例化一个 provider."""
    name = provider_name or settings.llm_provider
    cls = llm_registry.get(name)
    return cls()