"""简单内存缓存 (dev 模式替代 Redis)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

_cache: dict[str, tuple[Any, datetime | None]] = {}


async def get(key: str) -> Any | None:
    val, expire = _cache.get(key, (None, None))
    if expire and datetime.utcnow() > expire:
        _cache.pop(key, None)
        return None
    return val


async def set(key: str, value: Any, ttl_seconds: int | None = None) -> None:
    expire = datetime.utcnow() + timedelta(seconds=ttl_seconds) if ttl_seconds else None
    _cache[key] = (value, expire)


async def delete(key: str) -> None:
    _cache.pop(key, None)


from datetime import timedelta
