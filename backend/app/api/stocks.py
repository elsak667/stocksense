"""股票搜索与筛选 API."""
from __future__ import annotations
from fastapi import APIRouter, Query
from app.data.akshare_client import search_stocks as _search, screener_stocks as _screener

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    results = await _search(q)
    if not results:
        return {"detail": f"未找到匹配: {q}"}
    return results

@router.get("/screener")
async def screener(
    pe_min: float | None = None, pe_max: float | None = None,
    pb_min: float | None = None, pb_max: float | None = None,
    price_min: float | None = None, price_max: float | None = None,
    change_min: float | None = None, change_max: float | None = None,
    volume_min: float | None = None, limit: int = 50,
):
    return await _screener(
        pe_min=pe_min, pe_max=pe_max, pb_min=pb_min, pb_max=pb_max,
        price_min=price_min, price_max=price_max,
        change_min=change_min, change_max=change_max,
        volume_min=volume_min, limit=limit,
    )
