"""风控审查员 — 在辩论和 PM 决策之间跑."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.base import AgentContext, BaseAgent
from app.core.registry import agent_registry

logger = logging.getLogger(__name__)


@agent_registry.register("risk", version="1.0")
class RiskAgent(BaseAgent):
    name = "风控审查"
    description = "看多看空辩论完了,做风险等级判断"

    async def analyze(self, ctx: AgentContext) -> Any:
        raise NotImplementedError("RiskAgent 走 review() 而非 analyze()")

    async def review(
        self,
        ctx: AgentContext,
        debate: dict[str, str],
    ) -> dict[str, Any]:
        tmpl = self.load_prompt("risk")
        prompt = tmpl.format(
            quote=ctx.fmt_quote(),
            klines=ctx.fmt_klines_summary(20),
            bull=debate["bull"],
            bear=debate["bear"],
        )
        out = await ctx.llm.chat_json(
            prompt=prompt,
            system="你是风控审查员. 识别关键风险, 不夸大不漏报.",
        )
        logger.info("风控等级 %s", out.get("risk_level"))
        return out