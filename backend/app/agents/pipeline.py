"""分析 Pipeline — 串联全流程: 数据采集 → 3 分析师 → 辩论 → 风控 → PM 决策.

调用方式:
    result = await run_analysis("600519", llm_provider="deepseek")
"""

from __future__ import annotations

import logging
import time
from datetime import date
from typing import Any

from app.agents.base import AgentContext
from app.agents.debate import run_debate
from app.agents.fundamental import FundamentalAgent
from app.agents.manager import ManagerAgent
from app.agents.risk import RiskAgent
from app.agents.sentiment import SentimentAgent
from app.agents.technical import TechnicalAgent
from app.data.orchestrator import safe_finance, safe_klines, safe_quote
from app.llm import get_llm

logger = logging.getLogger(__name__)


ProgressCb = None.__class__  # hack: Callable[[dict], Awakeable[None]] without typing


async def run_analysis(
    stock_code: str,
    llm_provider: str | None = None,
    debate_rounds: int = 2,
    on_progress: ProgressCb | None = None,
) -> dict[str, Any]:
    """完整分析流程, 返回结构化结果."""

    async def emit(stage: str, data: dict) -> None:
        if on_progress:
            await on_progress({"type": "stage", "stage": stage, **data})

    t0 = time.time()
    llm = get_llm(llm_provider)

    # 1. 数据采集
    logger.info("[%s] 开始数据采集", stock_code)
    await emit("data", {"status": "start"})
    quote_obj = await safe_quote(stock_code)
    kline_objs = await safe_klines(stock_code, days=60)
    finance_data = await safe_finance(stock_code)

    # 转成 dict 格式给 AgentContext
    quote: dict[str, Any] = {}
    if quote_obj:
        quote = {
            "code": quote_obj.code,
            "name": quote_obj.name,
            "market": quote_obj.market,
            "price": quote_obj.price,
            "open": quote_obj.open,
            "high": quote_obj.high,
            "low": quote_obj.low,
            "prev_close": quote_obj.prev_close,
            "volume": quote_obj.volume,
            "change_pct": quote_obj.change_pct,
        }

    klines: list[dict[str, Any]] = [
        {
            "date": k.date,
            "open": k.open,
            "close": k.close,
            "high": k.high,
            "low": k.low,
            "volume": k.volume,
            "change_pct": k.change_pct,
        }
        for k in kline_objs
    ]

    ctx = AgentContext(
        stock_code=stock_code,
        stock_name=quote.get("name", stock_code),
        market=quote.get("market", "A"),
        analysis_date=date.today(),
        llm=llm,
        quote=quote,
        klines=klines,
        finance=finance_data,
    )
    logger.info("[%s] 数据采集完成: quote=%s klines=%d条", stock_code, bool(quote), len(klines))
    await emit("data", {"status": "done", "quote": quote, "klines_count": len(klines)})

    # 2. 三位分析师
    analysts = [("technical", TechnicalAgent()), ("fundamental", FundamentalAgent()), ("sentiment", SentimentAgent())]
    agent_results: dict[str, Any] = {}
    for key, agent in analysts:
        logger.info("[%s] 分析师 %s 开始", stock_code, agent.name)
        await emit("agent_start", {"name": agent.name})
        try:
            result = await agent.analyze(ctx)
            d = result.to_dict()
            agent_results[key] = d
            logger.info("[%s] 分析师 %s → %s", stock_code, agent.name, result.badge)
            await emit("agent_done", {"name": agent.name, "badge": result.badge, "summary": result.summary})
        except Exception as e:
            logger.error("[%s] 分析师 %s 失败: %s", stock_code, agent.name, e)
            agent_results[key] = {
                "name": agent.name,
                "badge": f"{agent.name}:分析失败",
                "summary": str(e),
                "details": {},
            }
            await emit("agent_done", {"name": agent.name, "badge": f"{agent.name}:分析失败", "summary": str(e)})

    # 3. 多空辩论
    logger.info("[%s] 开始多空辩论 rounds=%d", stock_code, debate_rounds)
    await emit("debate", {"status": "start", "rounds": debate_rounds})
    try:
        debate = await run_debate(ctx, agent_results, rounds=debate_rounds)
        await emit("debate", {"status": "done", "data": debate})
    except Exception as e:
        logger.error("[%s] 辩论失败: %s", stock_code, e)
        debate = {"bull": f"辩论失败: {e}", "bear": f"辩论失败: {e}"}
        await emit("debate", {"status": "done", "data": debate})

    # 4. 风控审查
    logger.info("[%s] 风控审查", stock_code)
    await emit("risk", {"status": "start"})
    try:
        risk = await RiskAgent().review(ctx, debate)
        await emit("risk", {"status": "done", "data": risk})
    except Exception as e:
        logger.error("[%s] 风控失败: %s", stock_code, e)
        risk = {"risk_level": "unknown", "key_risks": [str(e)], "position_suggestion_pct": 0, "summary": str(e)}
        await emit("risk", {"status": "done", "data": risk})

    # 5. PM 最终决策
    logger.info("[%s] PM 决策", stock_code)
    await emit("decision", {"status": "start"})
    try:
        decision = await ManagerAgent().decide(ctx, agent_results, debate, risk)
        await emit("decision", {"status": "done", "data": decision})
    except Exception as e:
        logger.error("[%s] PM 决策失败: %s", stock_code, e)
        decision = {"action": "HOLD", "confidence": 0, "reason": str(e)}
        await emit("decision", {"status": "done", "data": decision})

    elapsed = time.time() - t0
    logger.info("[%s] 分析完成 %.1fs action=%s confidence=%s", stock_code, elapsed, decision.get("action"), decision.get("confidence"))

    return {
        "stock_code": stock_code,
        "stock_name": ctx.stock_name,
        "analysis_date": ctx.analysis_date.isoformat(),
        "elapsed_seconds": round(elapsed, 1),
        "quote": ctx.quote,
        "agents": agent_results,
        "debate": debate,
        "risk": risk,
        "decision": decision,
    }