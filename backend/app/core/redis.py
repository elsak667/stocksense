"""Redis/内存缓存兼容层."""

from __future__ import annotations

import json
from typing import Any

from app.config import get_settings

settings = get_settings()

if settings.redis_url.startswith("memory://"):
    # 简单内存缓存
    _store: dict[str, tuple[str, float | None]] = {}

    class MemoryClient:
        async def get(self, key: str) -> str | None:
            val, expire = _store.get(key, (None, None))
            import time
            if expire and time.time() > expire:
                _store.pop(key, None)
                return None
            return val

        async def setex(self, key: str, ttl: int, value: str) -> None:
            import time
            _store[key] = (value, time.time() + ttl)

        async def delete(self, key: str) -> None:
            _store.pop(key, None)

    redis_client = MemoryClient()
else:
    import redis.asyncio as redis
    redis_client = redis.from_url(settings.redis_url, decode_responses=True)


async def get_redis():
    return redis_client