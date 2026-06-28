"""BaseAgent + AgentContext — 所有分析师的抽象."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

from app.llm import LLMProvider

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


@dataclass
class AgentContext:
    """分析师共享的上下文 — 一次分析的所有输入."""

    stock_code: str
    stock_name: str
    market: str
    analysis_date: date
    llm: LLMProvider
    # 各数据源拿到的原始数据, 由 pipeline 在 collect 阶段填好
    quote: dict[str, Any] = field(default_factory=dict)
    klines: list[dict[str, Any]] = field(default_factory=list)
    finance: dict[str, Any] = field(default_factory=dict)

    def fmt_klines_summary(self, n: int = 20) -> str:
        """返回最近 n 日 K 线的简洁文本, 给 prompt 用."""
        if not self.klines:
            return "无 K 线数据"
        rows = self.klines[-n:]
        header = "日期 | 开 | 收 | 高 | 低 | 量 | 涨跌幅%"
        lines = [header]
        for k in rows:
            lines.append(
                f"{k['date']} | {k['open']:.2f} | {k['close']:.2f} | {k['high']:.2f} | "
                f"{k['low']:.2f} | {k['volume']} | {k['change_pct']:.2f}"
            )
        return "\n".join(lines)

    def fmt_quote(self) -> str:
        if not self.quote:
            return "无行情数据"
        q = self.quote
        return (
            f"{q.get('name')} ({q.get('code')}) 市场:{q.get('market')}\n"
            f"现价 {q.get('price')}  涨跌 {q.get('change_pct')}%  开 {q.get('open')}  "
            f"高 {q.get('high')}  低 {q.get('low')}  昨收 {q.get('prev_close')}"
        )


@dataclass
class AgentResult:
    """单个分析师的输出."""

    name: str
    badge: str                          # 简短标签, 如"技术面:中性偏多"
    summary: str                        # 一段话总结
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "badge": self.badge,
            "summary": self.summary,
            "details": self.details,
        }


class BaseAgent(ABC):
    """分析师抽象 — 加新分析师: 新建一文件 + @agent_registry.register 即可."""

    name: str = ""
    description: str = ""

    @abstractmethod
    async def analyze(self, ctx: AgentContext) -> AgentResult:
        ...

    # ---- helpers ----

    @staticmethod
    def load_prompt(name: str) -> str:
        path = PROMPTS_DIR / f"{name}.md"
        if not path.exists():
            logger.warning("prompt 文件不存在: %s", path)
            return ""
        return path.read_text(encoding="utf-8")

    @staticmethod
    def dump_json_or_text(v: Any) -> str:
        if isinstance(v, (dict, list)):
            return json.dumps(v, ensure_ascii=False, indent=2, default=str)
        return str(v)