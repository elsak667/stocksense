"""技术分析师."""

from __future__ import annotations

from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.core.registry import agent_registry


@agent_registry.register("technical", version="1.0")
class TechnicalAgent(BaseAgent):
    name = "技术面"
    description = "基于 K 线判断趋势/支撑压力/技术指标"

    async def analyze(self, ctx: AgentContext) -> AgentResult:
        prompt = self.load_prompt("technical").format(
            quote=ctx.fmt_quote(),
            klines=ctx.fmt_klines_summary(20),
        )
        out = await ctx.llm.chat_json(
            prompt=prompt,
            system="你是严格的 A 股技术分析师, 只基于给定数据, 数字以原始数据为准, 不编造.",
        )

        trend = out.get("trend", "unknown")
        badge = f"技术:{trend} {out.get('key_signal', '')[:20]}"

        return AgentResult(
            name=self.name,
            badge=badge,
            summary=out.get("summary", ""),
            details=out,
        )