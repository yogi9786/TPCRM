"""
TekhPortal CRM — FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from config import ALLOWED_ORIGINS
from routers import leads, whatsapp, meta, campaigns, chatbot

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    try:
        redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=True)
        FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
        logger.info("Redis cache initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize Redis cache: {e}")
    yield

app = FastAPI(
    title="TekhPortal CRM API",
    description="Backend API for TekhPortal CRM — WhatsApp automation, Meta Lead Ads, and lead management",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS + ["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(leads.router)
app.include_router(whatsapp.router)
app.include_router(meta.router)
app.include_router(campaigns.router)
app.include_router(chatbot.router)

from pydantic import BaseModel
import os
from fastapi import HTTPException

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
async def login_endpoint(credentials: LoginRequest):
    admin_email = os.getenv("ADMIN_EMAIL", "admin@tekhportal.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "Admin@123")
    
    if credentials.email == admin_email and credentials.password == admin_password:
        return {
            "token": "mock-jwt-token-xyz",
            "user": {
                "uid": "demo-admin-uid",
                "email": admin_email,
                "displayName": "Demo Admin"
            }
        }
    raise HTTPException(status_code=400, detail="Invalid email or password")



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
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
