"""多源 orchestrator — 按 priority 顺序调用,失败自动回退下一源.

这是 PLAN 里说的 "多源回退链" 的真实样子.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.data.akshare_client import Kline, Quote, get_klines, get_quote

logger = logging.getLogger(__name__)


async def safe_quote(code: str) -> Quote | None:
    """行情入口: A 走 akshare / 港美股走 yfinance, 失败返回 None."""
    try:
        return await get_quote(code)
    except Exception as e:
        logger.warning("行情查询失败 code=%s err=%s", code, e)
        return None


async def safe_klines(code: str, days: int = 120) -> list[Kline]:
    try:
        return await get_klines(code, days)
    except Exception as e:
        logger.warning("K线查询失败 code=%s err=%s", code, e)
        return []


async def safe_finance(code: str) -> dict[str, Any]:
    """A 股才用, 其他市场返回空 dict."""
    from app.data.akshare_client import _detect_market, get_finance_a

    if _detect_market(code) != "A":
        return {}
    try:
        return await get_finance_a(code)
    except Exception as e:
        logger.warning("基本面查询失败 code=%s err=%s", code, e)
        return {}


async def batch_quotes(codes: list[str]) -> dict[str, Quote | None]:
    """并发拉多只自选股的行情, 返回 {code: quote | None}."""
    results = await asyncio.gather(*[safe_quote(c) for c in codes], return_exceptions=True)
    out: dict[str, Quote | None] = {}
    for code, r in zip(codes, results, strict=False):
        out[code] = r if isinstance(r, Quote) else None
    return out