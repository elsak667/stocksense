"""行情 / K线 / 自选股总览路由.

带 Redis 缓存:
- 实时行情 60s
- 日 K 线 1h
"""

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.redis import redis_client
from app.data.orchestrator import safe_klines, safe_quote
from app.deps import CurrentUser, DbSession
from app.models import Watchlist

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["quotes"])

from datetime import datetime, time

QUOTE_TTL = 60
KLINE_TTL = 3600
_MARKET_CLOSE = time(15, 30)


def _quote_ttl() -> int:
    now = datetime.now().astimezone()
    if now.weekday() >= 5 or now.time() > _MARKET_CLOSE:
        return 3600
    return 60


class QuoteOut(BaseModel):
    code: str
    name: str
    market: str
    price: float
    change: float
    change_pct: float
    open: float
    high: float
    low: float
    prev_close: float
    volume: int
    amount: float
    timestamp: str


class WatchlistQuoteOut(BaseModel):
    id: int
    stock_code: str
    stock_name: str
    market: str
    note: str | None
    price: float | None
    change_pct: float | None


@router.get("/quotes/{code}", response_model=QuoteOut)
async def quote(code: str):
    cache_key = f"q:{code.upper()}"
    if cached := await redis_client.get(cache_key):
        return QuoteOut(**json.loads(cached))
    q = await safe_quote(code)
    if not q:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "行情数据不可用")
    out = QuoteOut(**q.to_dict())
    await redis_client.setex(cache_key, _quote_ttl(), out.model_dump_json())
    return out


@router.get("/klines/{code}")
async def klines(code: str, days: int = 120):
    if days > 365:
        days = 365
    cache_key = f"k:{code.upper()}:{days}"
    if cached := await redis_client.get(cache_key):
        return json.loads(cached)
    ks = await safe_klines(code, days)
    if not ks:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "K线数据不可用")
    out = [k.to_dict() for k in ks]
    await redis_client.setex(cache_key, KLINE_TTL, json.dumps(out, ensure_ascii=False))
    return out


@router.get("/watchlist/quotes", response_model=list[WatchlistQuoteOut])
async def watchlist_with_quotes(user: CurrentUser, db: DbSession):
    """Dashboard 用: 自选股 + 每只股的实时行情合并返回."""
    rows = (
        await db.execute(
            select(Watchlist).where(Watchlist.user_id == user.id).order_by(Watchlist.added_at.desc())
        )
    ).scalars().all()

    missing = [r for r in rows if not await redis_client.exists(f"q:{r.stock_code}")]
    if missing:
        results = await asyncio.gather(*[safe_quote(w.stock_code) for w in missing], return_exceptions=True)
        for w, q in zip(missing, results, strict=False):
            if isinstance(q, Exception):
                logger.warning("看板补缺失败 %s: %s", w.stock_code, q)
                continue
            if q:
                await redis_client.setex(f"q:{w.stock_code}", _quote_ttl(), json.dumps(q.to_dict(), ensure_ascii=False))

    out: list[WatchlistQuoteOut] = []
    for r in rows:
        cache_key = f"q:{r.stock_code}"
        price = change_pct = None
        if cached := await redis_client.get(cache_key):
            j = json.loads(cached)
            price = j.get("price")
            change_pct = j.get("change_pct")
        out.append(
            WatchlistQuoteOut(
                id=r.id, stock_code=r.stock_code, stock_name=r.stock_name,
                market=r.market, note=r.note, price=price, change_pct=change_pct,
            )
        )
    return out