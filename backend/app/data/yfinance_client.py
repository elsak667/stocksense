"""yfinance 数据源 — 港股/美股主源 + A 股回退.

akshare 挂了的兜底.
"""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

import yfinance as yf

from app.data.akshare_client import Kline, Quote


async def _safe_async(func, *args, **kwargs):
    """yfinance 是 sync 的, 用 to_thread 包."""
    return await asyncio.to_thread(func, *args, **kwargs)


def _ya_to_quote(ticker_name: str, info: dict[str, Any]) -> Quote | None:
    if not info or info is None:
        return None
    price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("regularMarketPrice")
    if price is None:
        # 退化试 last close
        price = info.get("regularMarketPreviousClose")
    if price is None:
        return None
    prev = info.get("regularMarketPreviousClose") or info.get("previousClose") or price
    change = price - prev
    change_pct = (change / prev * 100) if prev else 0.0
    market = "HK" if ticker_name.upper().endswith(".HK") else "US"
    code_stripped = ticker_name.replace(".HK", "").replace(".US", "")
    return Quote(
        code=code_stripped if market == "HK" else ticker_name,
        name=info.get("longName") or info.get("shortName") or ticker_name,
        market=market,
        price=float(price),
        change=float(change),
        change_pct=float(change_pct),
        open=float(info.get("open") or price),
        high=float(info.get("dayHigh") or price),
        low=float(info.get("dayLow") or price),
        prev_close=float(prev),
        volume=int(info.get("volume") or 0),
        amount=0.0,  # yfinance 不直接给成交额
        timestamp=str(date.today().isoformat()),
    )


async def get_quote_yf(code: str) -> Quote | None:
    def _do():
        t = yf.Ticker(code)
        return t.info
    info = await _safe_async(_do)
    return _ya_to_quote(code, info)


async def get_kline_yf(code: str, days: int = 120) -> list[Kline]:
    def _do():
        t = yf.Ticker(code)
        hist = t.history(period=f"{days + 60}d")  # 超量取再 tail
        out: list[Kline] = []
        for idx, row in hist.tail(days).iterrows():
            prev_close = hist.loc[:idx, "Close"].shift(1).loc[idx]
            change_pct = ((row["Close"] - prev_close) / prev_close * 100) if prev_close else 0.0
            out.append(
                Kline(
                    date=idx.strftime("%Y-%m-%d"),
                    open=float(row["Open"]),
                    close=float(row["Close"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    volume=int(row["Volume"]),
                    amount=0.0,
                    change_pct=float(change_pct),
                )
            )
        return out
    return await _safe_async(_do)