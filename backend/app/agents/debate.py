"""多空辩论 — 2 轮 LLM 调用,交换上下文."""

from __future__ import annotations

import logging
from typing import Any

from app.agents.base import AgentContext
from app.llm import LLMProvider

logger = logging.getLogger(__name__)


async def run_debate(
    ctx: AgentContext,
    agent_results: dict[str, Any],
    rounds: int = 2,
) -> dict[str, str]:
    """看多看空 2 轮辩论. agent_results 是 3 分析师的 to_dict()."""
    bull_prompt_template = AgentContext.__module__ and None  # 哨兵
    from app.agents.base import BaseAgent

    bull_tmpl = BaseAgent.load_prompt("bull")
    bear_tmpl = BaseAgent.load_prompt("bear")
    tech = agent_results.get("technical", {})
    fund = agent_results.get("fundamental", {})
    sent = agent_results.get("sentiment", {})

    bull_context = ""
    bear_context = ""

    for round_i in range(rounds):
        logger.info("辩论 第 %d/%d 轮", round_i + 1, rounds)
        bull_prompt = bull_tmpl.format(
            quote=ctx.fmt_quote(),
            klines=ctx.fmt_klines_summary(20),
            technical=tech.get("summary", ""),
            fundamental=fund.get("summary", ""),
            sentiment=sent.get("summary", ""),
            opponent=bear_context or "(无)",
        )
        bull_context = await ctx.llm.chat(prompt=bull_prompt)

        bear_prompt = bear_tmpl.format(
            quote=ctx.fmt_quote(),
            klines=ctx.fmt_klines_summary(20),
            technical=tech.get("summary", ""),
            fundamental=fund.get("summary", ""),
            sentiment=sent.get("summary", ""),
            opponent=bull_context or "(无)",
        )
        bear_context = await ctx.llm.chat(prompt=bear_prompt)

    return {"bull": bull_context, "bear": bear_context}