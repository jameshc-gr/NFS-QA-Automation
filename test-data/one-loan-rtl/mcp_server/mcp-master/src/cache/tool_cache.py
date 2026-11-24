"""
Tool result caching for the MCP server.

Architecture
------------
ToolCacheManager  – knows WHICH tools to cache (simple list) at a fixed TTL.
RedisBackend      – async Redis store using redis.asyncio.
InMemoryBackend   – lightweight asyncio store used only for tests / local dev.

Configuration (env vars)
------------------------
CACHE_TOOLS  – comma-separated list of tool names to cache.
               Example: CACHE_TOOLS=get_loan,search_loans,get_borrower_loans
               Add / remove entries and redeploy to change what gets cached.

CACHE_TTL    – TTL in seconds applied to every cached tool. Default: 3600 (1 h).

REDIS_URL    – Redis connection URL. Default: redis://localhost:6379/0

Safety
------
- Only "success": true responses are stored. Errors skip the cache so
  callers always retry on failure.
- NEVER add mutation tools (create_loan, update_loan, send_email, send_sms,
  pull_credit, upload_document, etc.) to CACHE_TOOLS — those must always hit
  the real service.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Backends
# ---------------------------------------------------------------------------

class RedisBackend:
    """Async Redis cache backend using redis.asyncio.

    Parameters
    ----------
    redis_url:
        Standard Redis URL, e.g. ``redis://localhost:6379/0``.
    key_prefix:
        Namespace prefix added to every key so multiple services can share
        one Redis instance without key collisions.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/0", key_prefix: str = "mcp:tool:") -> None:
        self._url = redis_url
        self._prefix = key_prefix
        self._client: Any = None  # set in connect()

    async def connect(self) -> None:
        """Open the connection pool. Call once during server startup."""
        import redis.asyncio as aioredis
        self._client = aioredis.from_url(self._url, decode_responses=True)
        await self._client.ping()
        logger.info("Redis cache connected: url=%s prefix=%s", self._url, self._prefix)

    async def close(self) -> None:
        """Release the connection pool. Call during server shutdown."""
        if self._client:
            await self._client.aclose()

    def _key(self, key: str) -> str:
        return f"{self._prefix}{key}"

    async def get(self, key: str) -> Optional[str]:
        if not self._client:
            return None
        return await self._client.get(self._key(key))

    async def set(self, key: str, value: str, ttl: int) -> None:
        if not self._client:
            return
        await self._client.setex(self._key(key), ttl, value)

    async def invalidate_prefix(self, prefix: str) -> int:
        """Remove all keys matching ``<key_prefix><prefix>*``."""
        if not self._client:
            return 0
        pattern = f"{self._prefix}{prefix}*"
        keys = await self._client.keys(pattern)
        if keys:
            await self._client.delete(*keys)
        return len(keys)

    async def clear(self) -> None:
        """Remove every key under this service's namespace prefix."""
        if not self._client:
            return
        pattern = f"{self._prefix}*"
        keys = await self._client.keys(pattern)
        if keys:
            await self._client.delete(*keys)


class InMemoryBackend:
    """Async-safe in-memory TTL store — for local dev and unit tests only."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[str, float]] = {}
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        pass

    async def close(self) -> None:
        pass

    async def get(self, key: str) -> Optional[str]:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: str, ttl: int) -> None:
        async with self._lock:
            self._store[key] = (value, time.monotonic() + ttl)

    async def invalidate_prefix(self, prefix: str) -> int:
        async with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
            return len(keys)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()


# ---------------------------------------------------------------------------
# Manager
# ---------------------------------------------------------------------------

class ToolCacheManager:
    """Manages tool result caching with a single TTL for all cached tools.

    Parameters
    ----------
    tool_names:
        List of tool names to cache. Add/remove names then redeploy to change
        what gets cached. Never include mutation tools here.
    ttl:
        TTL in seconds applied to every cached tool (default 3600 = 1 hour).
    backend:
        Cache backend instance (RedisBackend or InMemoryBackend). The caller
        must call ``backend.connect()`` before the manager is used.
    """

    def __init__(
        self,
        tool_names: list[str],
        ttl: int = 3600,
        backend: Optional[Any] = None,
    ) -> None:
        self._tool_set: frozenset[str] = frozenset(tool_names)
        self._ttl = ttl
        self._backend = backend

    def is_cached(self, tool_name: str) -> bool:
        return tool_name in self._tool_set

    @staticmethod
    def make_key(tool_name: str, arguments: dict) -> str:
        """Stable cache key — argument order does not matter."""
        canonical = json.dumps(arguments, sort_keys=True, default=str)
        digest = hashlib.sha256(canonical.encode()).hexdigest()[:16]
        return f"{tool_name}:{digest}"

    async def get(self, tool_name: str, arguments: dict) -> Optional[str]:
        """Return a cached result string, or ``None`` on miss / uncached tool."""
        if not self._backend or not self.is_cached(tool_name):
            return None
        key = self.make_key(tool_name, arguments)
        value = await self._backend.get(key)
        if value is not None:
            logger.info("Cache HIT  tool=%s ttl=%ds", tool_name, self._ttl)
        else:
            logger.debug("Cache MISS tool=%s", tool_name)
        return value

    async def set(self, tool_name: str, arguments: dict, result: str) -> None:
        """Cache a successful result. Error responses (success=false) are never stored."""
        if not self._backend or not self.is_cached(tool_name):
            return
        try:
            body = json.loads(result)
            if isinstance(body, dict) and body.get("success") is False:
                return
        except (json.JSONDecodeError, AttributeError):
            pass
        key = self.make_key(tool_name, arguments)
        await self._backend.set(key, result, self._ttl)
        logger.info("Cache SET  tool=%s ttl=%ds", tool_name, self._ttl)

    async def close(self) -> None:
        """Close the backend. Call during server shutdown."""
        if self._backend:
            await self._backend.close()
