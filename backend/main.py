"""
TekhPortal CRM — FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from config import ALLOWED_ORIGINS
from routers import leads, whatsapp, meta, campaigns, chatbot, email as email_router
from auth import router as auth_router, get_current_user

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

import os
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI): 
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
    allow_origins=ALLOWED_ORIGINS + ["http://localhost:5173", "http://localhost:3000", "https://tpcrm.netlify.app", "https://tpcrm.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# Include auth router FIRST (not protected by get_current_user)
app.include_router(auth_router)

# Protect all other routers with JWT authentication
app.include_router(leads.router, dependencies=[Depends(get_current_user)])
app.include_router(whatsapp.router, dependencies=[Depends(get_current_user)])
app.include_router(meta.router, dependencies=[Depends(get_current_user)])
app.include_router(campaigns.router, dependencies=[Depends(get_current_user)])
app.include_router(chatbot.router, dependencies=[Depends(get_current_user)])
app.include_router(email_router.router, dependencies=[Depends(get_current_user)])

# Mock auth logic removed (now in auth.py)
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
