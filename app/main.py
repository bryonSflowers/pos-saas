import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown — close DB pool etc.


app = FastAPI(
    title="POS SaaS API",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins if _origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, exc: Exception):
    tb = traceback.format_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": tb},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/db")
async def health_db():
    import os, traceback
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    raw_url = os.environ.get("DATABASE_URL", "NOT SET")
    # Convert postgresql:// -> postgresql+asyncpg:// if needed
    if raw_url.startswith("postgresql://"):
        db_url = "postgresql+asyncpg://" + raw_url[len("postgresql://"):]
    else:
        db_url = raw_url

    masked = db_url[:30] + "..." if len(db_url) > 30 else db_url

    try:
        test_engine = create_async_engine(db_url, poolclass=NullPool, connect_args={"timeout": 5})
        async with test_engine.connect() as conn:
            result = await conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
            tables = [row[0] for row in result]
        await test_engine.dispose()
        return {"status": "ok", "url_prefix": masked, "tables": tables}
    except Exception as e:
        return {"status": "error", "url_prefix": masked, "error": str(e), "trace": traceback.format_exc()}


if "__main__" == __name__:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8020)