import os
import json
import logging
import redis.asyncio as aioredis
import redis as syncredis
from typing import Optional, Any

logger = logging.getLogger(__name__)

# Global Redis client instances
redis_client_async: Optional[aioredis.Redis] = None
redis_client_sync: Optional[syncredis.Redis] = None

async def init_redis():
    global redis_client_async, redis_client_sync
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        redis_client_async = aioredis.from_url(redis_url, decode_responses=True)
        await redis_client_async.ping()
        redis_client_sync = syncredis.from_url(redis_url, decode_responses=True)
        redis_client_sync.ping()
        logger.info(f"Connected to Redis at {redis_url}")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        redis_client_async = None
        redis_client_sync = None

async def close_redis():
    global redis_client_async, redis_client_sync
    if redis_client_async:
        await redis_client_async.close()
    if redis_client_sync:
        redis_client_sync.close()
    logger.info("Closed Redis connections")

# Synchronous cache methods for feed_router.py (which uses sync endpoints)
def get_cache_sync(key: str) -> Optional[Any]:
    if not redis_client_sync:
        return None
    try:
        data = redis_client_sync.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Failed to get cache for {key}: {e}")
    return None

def set_cache_sync(key: str, value: Any, expire_seconds: int = 300) -> bool:
    if not redis_client_sync:
        return False
    try:
        data = json.dumps(value)
        redis_client_sync.set(key, data, ex=expire_seconds)
        return True
    except Exception as e:
        logger.warning(f"Failed to set cache for {key}: {e}")
        return False

def get_redis_async() -> Optional[aioredis.Redis]:
    return redis_client_async

def get_redis_sync() -> Optional[syncredis.Redis]:
    return redis_client_sync
