"""akshare 数据源 — A 股主力源.

akshare 是 sync 的, async 内调用要 await asyncio.to_thread 包住.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import date
from typing import Any

import akshare as ak
import pandas as pd

logger = logging.getLogger(__name__)

CACHE_TTL_REALTIME = 60
CACHE_TTL_KLINE_DAILY = 3600


def safe_float(v) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
        return None if f != f else round(f, 4)
    except (ValueError, TypeError):
        return None


@dataclass
class Quote:
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

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code, "name": self.name, "market": self.market,
            "price": self.price, "change": self.change, "change_pct": self.change_pct,
            "open": self.open, "high": self.high, "low": self.low,
            "prev_close": self.prev_close, "volume": self.volume, "amount": self.amount,
            "timestamp": self.timestamp,
        }


@dataclass
class Kline:
    date: str
    open: float
    close: float
    high: float
    low: float
    volume: int
    amount: float
    change_pct: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "date": self.date, "open": self.open, "close": self.close,
            "high": self.high, "low": self.low, "volume": self.volume,
            "amount": self.amount, "change_pct": self.change_pct,
        }


def _detect_market(code: str) -> str:
    pure = code.replace(".HK", "").replace(".US", "")
    if len(pure) == 6 and pure.isdigit():
        return "A"
    if code.upper().endswith(".HK") or (len(pure) == 5 and pure.isdigit()):
        return "HK"
    return "US"


# ===== A 股全市场 snapshot 缓存 =====
_spot_cache: dict = {}
_spot_cache_ts: float = 0.0
_SPOT_TTL = 300.0


def _load_spot() -> dict[str, dict]:
    import time

    global _spot_cache, _spot_cache_ts
    now = time.time()
    if "data" in _spot_cache and (now - _spot_cache_ts) < _SPOT_TTL:
        return _spot_cache["data"]
    df = ak.stock_zh_a_spot_em()
    cache: dict[str, dict] = {}
    for _, r in df.iterrows():
        cache[str(r["代码"])] = r.to_dict()
    _spot_cache["data"] = cache
    _spot_cache_ts = now
    return cache


# ===== A 股实时行情 =====
async def get_quote_a(code: str) -> Quote | None:
    def _do():
        spot = _load_spot()
        r = spot.get(code)
        if not r:
            return None
        return Quote(
            code=str(r["代码"]),
            name=str(r["名称"]),
            market="A",
            price=float(r["最新价"]),
            change=float(r["涨跌额"]),
            change_pct=float(r["涨跌幅"]),
            open=float(r["今开"]),
            high=float(r["最高"]),
            low=float(r["最低"]),
            prev_close=float(r["昨收"]),
            volume=int(r["成交量"]),
            amount=float(r["成交额"]),
            timestamp=str(date.today().isoformat()),
        )

    return await asyncio.to_thread(_do)


# ===== A 股日 K 线 =====
async def get_kline_a(code: str, days: int = 120) -> list[Kline]:
    def _do():
        df = ak.stock_zh_a_hist(
            symbol=code,
            period="daily",
            adjust="qfq",
        )
        df = df.tail(days)
        out: list[Kline] = []
        for _, r in df.iterrows():
            out.append(
                Kline(
                    date=str(r["日期"]),
                    open=float(r["开盘"]),
                    close=float(r["收盘"]),
                    high=float(r["最高"]),
                    low=float(r["最低"]),
                    volume=int(r["成交量"]),
                    amount=float(r["成交额"]),
                    change_pct=float(r["涨跌幅"]),
                )
            )
        return out

    return await asyncio.to_thread(_do)


# ===== A 股基本面 =====
async def get_finance_a(code: str) -> dict[str, Any]:
    try:
        sym = code + ".SH" if code.startswith("6") else code + ".SZ"
        df = await asyncio.to_thread(ak.stock_financial_analysis_indicator_em, symbol=sym)
        if df is None or df.empty:
            return {}
        row = df.iloc[-1]
        COLS = {"一、营业总收入": "revenue", "二、营业总成本": "cost", "三、营业利润": "op_profit", "四、利润总额": "total_profit", "五、净利润": "net_profit", "基本每股收益": "eps", "营业毛利率": "gross_margin", "营业利润率": "op_margin", "净利率": "net_margin", "净资产收益率": "roe", "总资产周转率": "asset_turn"}
        out = {}
        for cn, en in COLS.items():
            v = row.get(cn)
            out[en] = safe_float(v) if v is not None else None
        return out
    except Exception as e:
        logger.warning("基本面数据失败 %s: %s", code, e)
        return {}


def _f(r, k):
    v = r.get(k)
    if v is None:
        return None
    try:
        v = float(v)
        return None if (v != v or v == 0) else round(v, 4)
    except (ValueError, TypeError):
        return None


async def get_quote(code: str) -> Quote | None:
    market = _detect_market(code)
    if market == "A":
        return await get_quote_a(code)
    from app.data.yfinance_client import get_quote_yf

    return await get_quote_yf(code)


async def get_klines(code: str, days: int = 120) -> list[Kline]:
    market = _detect_market(code)
    if market == "A":
        return await get_kline_a(code, days)
    from app.data.yfinance_client import get_kline_yf

    return await get_kline_yf(code, days)


class AkshareClient:
    async def _run(self, fn, *args, **kwargs):
        return await asyncio.to_thread(fn, *args, **kwargs)

    async def _load_spot(self) -> pd.DataFrame:
        global _spot_cache
        if "data" in _spot_cache:
            return _spot_cache["data"]
        df = await self._run(ak.stock_zh_a_spot_em)
        _spot_cache["data"] = df
        return df


async def search_stocks(query: str) -> list[dict]:
    q = query.strip()
    if not q:
        return []
    client = AkshareClient()
    df = await client._run(ak.stock_info_a_code_name)
    clean = df["name"].str.replace(r"^[XDXR]+ *", "", regex=True)
    mask = df["code"].str.contains(q, na=False) | clean.str.contains(q, na=False)
    if not mask.any() and len(q) > 1:
        require = max(1, len(q) - 1)
        hits = []
        for ch in q:
            hits.append(clean.str.contains(ch, na=False))
        mask = sum(hits) >= require
    out = df[mask].head(20)
    return [{"code": r["code"], "name": r["name"], "market": "A"} for _, r in out.iterrows()]


async def screener_stocks(
    pe_min: float | None = None, pe_max: float | None = None,
    pb_min: float | None = None, pb_max: float | None = None,
    price_min: float | None = None, price_max: float | None = None,
    change_min: float | None = None, change_max: float | None = None,
    volume_min: float | None = None, limit: int = 50,
) -> list[dict]:
    client = AkshareClient()
    df = await client._load_spot()
    COL = {"code": "代码", "name": "名称", "price": "最新价", "change_pct": "涨跌幅", "volume": "成交量", "pe": "市盈率-动态", "pb": "市净率", "vol_ratio": "量比", "mcap": "总市值"}
    masks = pd.Series(True, index=df.index)
    for py, cn in COL.items():
        if cn not in df.columns:
            continue
        col = pd.to_numeric(df[cn], errors="coerce")
        if py == "pe" and pe_min is not None: masks &= (col >= pe_min)
        if py == "pe" and pe_max is not None: masks &= (col <= pe_max)
        if py == "pb" and pb_min is not None: masks &= (col >= pb_min)
        if py == "pb" and pb_max is not None: masks &= (col <= pb_max)
        if py == "price" and price_min is not None: masks &= (col >= price_min)
        if py == "price" and price_max is not None: masks &= (col <= price_max)
        if py == "change_pct" and change_min is not None: masks &= (col >= change_min)
        if py == "change_pct" and change_max is not None: masks &= (col <= change_max)
        if py == "volume" and volume_min is not None: masks &= (col >= volume_min)
    out = df[masks].head(limit)
    res = []
    for _, r in out.iterrows():
        d = {"code": r.get("代码", ""), "name": r.get("名称", ""), "price": safe_float(r.get("最新价")), "change_pct": safe_float(r.get("涨跌幅")), "pe": safe_float(r.get("市盈率-动态")), "pb": safe_float(r.get("市净率")), "vol_ratio": safe_float(r.get("量比")), "mcap": safe_float(r.get("总市值")), "volume": safe_float(r.get("成交量"))}
        res.append(d)
    return res
