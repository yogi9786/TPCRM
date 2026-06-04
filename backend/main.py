"""
TekhPortal CRM — FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import ALLOWED_ORIGINS
from routers import leads, whatsapp, meta, campaigns, chatbot, email as email_router
from auth import router as auth_router, get_current_user


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

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


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS + ["http://localhost:5173", "http://localhost:3000", "https://tpcrm.netlify.app", "https://tpcrm.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(auth_router)


app.include_router(leads.router)
app.include_router(whatsapp.router)
app.include_router(meta.router)
app.include_router(campaigns.router)
app.include_router(chatbot.router)
app.include_router(email_router.router)


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
