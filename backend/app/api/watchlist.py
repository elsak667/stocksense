"""自选股 CRUD 路由."""

import json
import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.redis import redis_client
from app.data.akshare_client import _detect_market
from app.data.orchestrator import safe_quote
from app.deps import CurrentUser, DbSession
from app.models import Watchlist

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistAdd(BaseModel):
    stock_code: str = Field(..., min_length=1, max_length=16)
    note: str | None = None


class WatchlistOut(BaseModel):
    id: int
    stock_code: str
    stock_name: str
    market: str
    note: str | None
    added_at: str


@router.get("", response_model=list[WatchlistOut])
async def list_watchlist(user: CurrentUser, db: DbSession):
    q = await db.execute(
        select(Watchlist).where(Watchlist.user_id == user.id).order_by(Watchlist.added_at.desc())
    )
    rows = q.scalars().all()
    return [
        WatchlistOut(
            id=r.id, stock_code=r.stock_code, stock_name=r.stock_name,
            market=r.market, note=r.note, added_at=r.added_at.isoformat(),
        )
        for r in rows
    ]


@router.post("", response_model=WatchlistOut, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(body: WatchlistAdd, user: CurrentUser, db: DbSession):
    code = body.stock_code.upper().strip()
    # 已存在则返回原条目, 不重复
    existing = await db.execute(
        select(Watchlist).where(Watchlist.user_id == user.id, Watchlist.stock_code == code)
    )
    if row := existing.scalar_one_or_none():
        return WatchlistOut(
            id=row.id, stock_code=row.stock_code, stock_name=row.stock_name,
            market=row.market, note=row.note, added_at=row.added_at.isoformat(),
        )

    # 拉行情拿股票名 + 验证代码合法性
    market = _detect_market(code)
    quote = await safe_quote(code)
    if not quote:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"无法验证股票代码: {code}")
    await redis_client.setex(f"q:{code}", 60, json.dumps(quote.to_dict(), ensure_ascii=False))
    new = Watchlist(
        user_id=user.id, stock_code=code, stock_name=quote.name,
        market=market, note=body.note,
    )
    db.add(new)
    await db.commit()
    await db.refresh(new)
    return WatchlistOut(
        id=new.id, stock_code=new.stock_code, stock_name=new.stock_name,
        market=new.market, note=new.note, added_at=new.added_at.isoformat(),
    )


@router.delete("/{wid}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(wid: int, user: CurrentUser, db: DbSession):
    q = await db.execute(
        select(Watchlist).where(Watchlist.id == wid, Watchlist.user_id == user.id)
    )
    row = q.scalar_one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "不在自选股列表")
    await db.delete(row)
    await db.commit()