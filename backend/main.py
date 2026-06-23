"""
TekhPortal CRM — FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import ALLOWED_ORIGINS
from routers import leads, whatsapp, meta, campaigns, email as email_router, content_plans, deals, tasks, automations, documents, team, clients, analytics
from auth import router as auth_router, get_current_user

import os
from contextlib import asynccontextmanager
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.backends.inmemory import InMemoryBackend
from redis import asyncio as aioredis

@asynccontextmanager
async def lifespan(app: FastAPI): 
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url or "localhost" in redis_url and os.getenv("RENDER"):
        # On Render, localhost redis won't work. Fallback silently.
        FastAPICache.init(InMemoryBackend(), prefix="tekhportal-cache")
        print("✅ InMemory cache initialized (No external Redis configured)")
    else:
        try:
            redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=True)
            # Test connection
            await redis.ping()
            FastAPICache.init(RedisBackend(redis), prefix="tekhportal-cache")
            print("✅ Redis cache initialized")
        except Exception as e:
            print(f"⚠️ Failed to connect to Redis. Falling back to InMemoryBackend. Error: {e}")
            FastAPICache.init(InMemoryBackend(), prefix="tekhportal-cache")
    yield

app = FastAPI(
    title="TekhPortal CRM API",
    description="Backend API for TekhPortal CRM — WhatsApp automation, Meta Lead Ads, and lead management",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(auth_router)


app.include_router(leads.router)
app.include_router(whatsapp.router)
app.include_router(meta.router)
app.include_router(meta.router, prefix="/api") # Added to support /api/meta/webhook
app.include_router(campaigns.router)
app.include_router(email_router.router)
app.include_router(content_plans.router)
app.include_router(deals.router)
app.include_router(tasks.router)
app.include_router(automations.router)
app.include_router(documents.router)
app.include_router(team.router)
app.include_router(clients.router)
app.include_router(analytics.router)



@app.get("/", tags=["health"])
async def root():
    return {
        "message": "TekhPortal CRM API is running 🚀",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "healthy", "service": "tekhportal-crm-api"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    pass
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
