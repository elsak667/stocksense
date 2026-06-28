"""FastAPI 应用入口."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.db import Base, engine
from app.api import auth as auth_api
from app.api import meta as meta_api
from app.api import quotes as quotes_api
from app.api import watchlist as watchlist_api
from app.api import analysis as analysis_api
from app.api import stocks as stocks_api

logger = logging.getLogger(__name__)
settings = get_settings()

MARKET_OPEN = time(9, 25)
MARKET_CLOSE = time(15, 30)
PREHEAT_INTERVAL = 300


def _is_trading_time() -> bool:
    now = datetime.now().astimezone()
    if now.weekday() >= 5:
        return False
    return MARKET_OPEN <= now.time() <= MARKET_CLOSE


async def _preheat_cache():
    """定时预热缓存：交易时段每5分钟拉所有自选股行情写入Redis."""
    from app.core.redis import redis_client
    from app.data.orchestrator import safe_quote

    from sqlalchemy import select
    from app.core.db import SessionLocal
    from app.models import Watchlist

    while True:
        try:
            if not _is_trading_time():
                await asyncio.sleep(60)
                continue
            async with SessionLocal() as s:
                rows = (await s.execute(select(Watchlist.stock_code).distinct())).scalars().all()
            codes = list(set(rows))
            if codes:
                results = await asyncio.gather(*[safe_quote(c) for c in codes], return_exceptions=True)
                import json
                for code, q in zip(codes, results, strict=False):
                    if isinstance(q, Exception):
                        logger.warning("预热失败 %s: %s", code, q)
                        continue
                    if q:
                        await redis_client.setex(f"q:{code}", 300, json.dumps(q.to_dict(), ensure_ascii=False))
                logger.info("预热完成 %d 只股票", len(codes))
        except Exception as e:
            logger.warning("预热任务异常: %s", e)
        await asyncio.sleep(PREHEAT_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from sqlalchemy import select
    from app.core.db import SessionLocal
    from app.core.security import hash_password
    from app.models import User

    async with SessionLocal() as s:
        existing = await s.execute(select(User).where(User.username == settings.admin_username))
        if not existing.scalar_one_or_none():
            s.add(User(username=settings.admin_username, password_hash=hash_password(settings.admin_password), is_admin=True))
            await s.commit()

    task = asyncio.create_task(_preheat_cache())
    yield
    task.cancel()
    await engine.dispose()


app = FastAPI(title="StockSense", version="0.1.0", description="A 股 LLM 分析工具", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(meta_api.router)
app.include_router(auth_api.router)
app.include_router(watchlist_api.router)
app.include_router(quotes_api.router)
app.include_router(analysis_api.router)
app.include_router(stocks_api.router)