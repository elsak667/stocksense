"""基本面分析师."""

from __future__ import annotations

import json

from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.core.registry import agent_registry


@agent_registry.register("fundamental", version="1.0")
class FundamentalAgent(BaseAgent):
    name = "基本面"
    description = "估值/质量/基本面评分"

    async def analyze(self, ctx: AgentContext) -> AgentResult:
        prompt = self.load_prompt("fundamental").format(
            finance=json.dumps(ctx.finance, ensure_ascii=False, indent=2, default=str),
            quote=ctx.fmt_quote(),
        )
        out = await ctx.llm.chat_json(
            prompt=prompt,
            system="你是严格的 A 股基本面分析师, 数字以原始数据为准, 不编造.",
        )
        badge = f"基本面:{out.get('valuation', '?')} {out.get('quality', '?')}"
        return AgentResult(
            name=self.name,
            badge=badge,
            summary=out.get("summary", ""),
            details=out,
        )