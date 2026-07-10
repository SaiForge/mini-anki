# app/core/limiter.py
"""
SECURITY FIX (Critical #4): Centralized rate limiter singleton.

Using a single module prevents circular imports when routers need to apply
rate limits without importing from main.py.

slowapi wraps the token bucket algorithm — each key (IP by default) gets
a fixed number of requests per time window. Exceeding it returns HTTP 429.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Key by IP address. In production behind a proxy (Azure Front Door, nginx),
# set FORWARDED_ALLOW_IPS and use get_remote_address which reads X-Forwarded-For.
limiter = Limiter(key_func=get_remote_address)
