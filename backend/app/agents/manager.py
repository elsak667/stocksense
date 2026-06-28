"""综合决策 PM."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.core.registry import agent_registry

logger = logging.getLogger(__name__)


@agent_registry.register("manager", version="1.0")
class ManagerAgent(BaseAgent):
    """最终决策者 — 综合所有输入输出 BUY/SELL/HOLD + 信心度."""

    name = "综合决策"
    description = "PM 综合 3 分析师 + 辩论 + 风控给出最终建议"

    async def analyze(self, ctx: AgentContext) -> AgentResult:
        raise NotImplementedError("ManagerAgent 不走标准 Agent.run, 用 decide() 替代")

    async def decide(
        self,
        ctx: AgentContext,
        agent_results: dict[str, Any],
        debate: dict[str, str],
        risk: dict[str, Any],
    ) -> dict[str, Any]:
        tmpl = self.load_prompt("manager")
        prompt = tmpl.format(
            technical_badge=agent_results["technical"]["badge"],
            technical_summary=agent_results["technical"]["summary"],
            fundamental_badge=agent_results["fundamental"]["badge"],
            fundamental_summary=agent_results["fundamental"]["summary"],
            sentiment_badge=agent_results["sentiment"]["badge"],
            sentiment_summary=agent_results["sentiment"]["summary"],
            bull=debate["bull"],
            bear=debate["bear"],
            risk_level=risk.get("risk_level", "unknown"),
            key_risks=json.dumps(risk.get("key_risks", []), ensure_ascii=False),
            position_suggestion_pct=risk.get("position_suggestion_pct", 0),
            risk_summary=risk.get("summary", ""),
            price=ctx.quote.get("price"),
            change_pct=ctx.quote.get("change_pct"),
        )
        out = await ctx.llm.chat_json(
            prompt=prompt,
            system="你是投资组合经理. 综合所有输入给出诚实的最终决策. 没把握就给 HOLD+低信心度. 不编造价格.",
        )
        logger.info("决策 %s %s%%", out.get("action"), out.get("confidence"))
        return out