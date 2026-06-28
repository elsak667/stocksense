"""分析 API — 触发一次完整分析 (SSE 流式)."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.pipeline import run_analysis
from app.deps import CurrentUser, DbSession
from app.data.orchestrator import safe_quote
from app.models import AnalysisHistory

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analysis", tags=["analysis"])


class AnalysisRequest(BaseModel):
    llm_provider: str | None = None
    debate_rounds: int = 2


async def _stream_analysis(
    stock_code: str,
    req: AnalysisRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """SSE 生成器: 逐阶段推送进度, 最后完整结果."""
    queue: asyncio.Queue = asyncio.Queue()

    async def on_progress(event: dict) -> None:
        await queue.put(event)

    async def run():
        try:
            result = await run_analysis(
                stock_code=stock_code,
                llm_provider=req.llm_provider,
                debate_rounds=req.debate_rounds,
                on_progress=on_progress,
            )
            await queue.put({"type": "complete", "result": result})
            # 保存分析历史
            try:
                dec = result.get("decision", {})
                ad = result.get("analysis_date")
                if isinstance(ad, str):
                    from datetime import date as _d
                    ad = _d.fromisoformat(ad)
                history = AnalysisHistory(
                    user_id=current_user.id,
                    stock_code=stock_code,
                    stock_name=result.get("stock_name"),
                    analysis_date=ad,
                    pipeline_version="1.0",
                    result=result,
                    decision_action=dec.get("action"),
                    decision_confidence=dec.get("confidence"),
                    llm_cost=result.get("llm_cost", 0),
                )
                db.add(history)
                await db.commit()
            except Exception as e:
                logger.error("保存分析失败: %s", e)
        except Exception as e:
            await queue.put({"type": "error", "detail": str(e)})
        finally:
            await queue.put(None)  # 结束信号

    task = asyncio.create_task(run())

    while True:
        event = await queue.get()
        if event is None:
            break
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    await task


@router.post("/{stock_code}")
async def analyze_stock(
    stock_code: str,
    req: AnalysisRequest,
    current_user: CurrentUser,
    db: DbSession,
    request: Request,
):
    """触发一次完整分析, SSE 流式推送进度."""

    quote_obj = await safe_quote(stock_code)
    if not quote_obj or not quote_obj.price:
        raise HTTPException(status_code=404, detail=f"股票代码 {stock_code} 无效或无行情数据")

    return StreamingResponse(
        _stream_analysis(stock_code, req, current_user, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history/{stock_code}")
async def get_analysis_history(
    stock_code: str,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = 10,
):
    """获取某股票的历史分析记录."""
    from sqlalchemy import select

    stmt = (
        select(AnalysisHistory)
        .where(AnalysisHistory.user_id == current_user.id, AnalysisHistory.stock_code == stock_code)
        .order_by(AnalysisHistory.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "created_at": r.created_at.isoformat(),
            "stock_name": r.stock_name,
            "decision": r.result.get("decision", {}),
        }
        for r in records
    ]


@router.get("/list")
async def list_analysis(current_user: CurrentUser, db: DbSession, limit: int = 50):
    from sqlalchemy import select
    stmt = select(AnalysisHistory).where(
        AnalysisHistory.user_id == current_user.id
    ).order_by(AnalysisHistory.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    records = result.scalars().all()
    return [{"id": r.id, "created_at": r.created_at.isoformat(), "stock_code": r.stock_code, "stock_name": r.stock_name, "decision": r.result.get("decision", {})} for r in records]


@router.get("/detail/{analysis_id}")
async def get_analysis_detail(analysis_id: int, current_user: CurrentUser, db: DbSession):
    from sqlalchemy import select
    stmt = select(AnalysisHistory).where(AnalysisHistory.id == analysis_id, AnalysisHistory.user_id == current_user.id)
    result = await db.execute(stmt)
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"id": r.id, "stock_code": r.stock_code, "stock_name": r.stock_name, "analysis_date": r.analysis_date.isoformat() if r.analysis_date else None, "elapsed_seconds": r.result.get("elapsed_seconds", 0), "created_at": r.created_at.isoformat(), "quote": r.result.get("quote", {}), "agents": r.result.get("agents", {}), "debate": r.result.get("debate", {}), "risk": r.result.get("risk", {}), "decision": r.result.get("decision", {})}