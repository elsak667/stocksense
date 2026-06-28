"""情绪面分析师."""

from __future__ import annotations

from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.core.registry import agent_registry


@agent_registry.register("sentiment", version="1.0")
class SentimentAgent(BaseAgent):
    name = "情绪面"
    description = "量价异动 / 动量 / 情绪温度"

    async def analyze(self, ctx: AgentContext) -> AgentResult:
        prompt = self.load_prompt("sentiment").format(
            klines=ctx.fmt_klines_summary(30),
            quote=ctx.fmt_quote(),
        )
        out = await ctx.llm.chat_json(
            prompt=prompt,
            system="你是 A 股情绪面/动量分析师, 只基于 K 线和量价信号判断情绪.",
        )
        badge = f"情绪:{out.get('mood', '?')} {out.get('volume_signal', '')}"
        return AgentResult(
            name=self.name,
            badge=badge,
            summary=out.get("summary", ""),
            details=out,
        )