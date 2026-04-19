#!/bin/bash
echo "=== POS SaaS startup ==="
echo "PORT=${PORT:-8000}"

# If DB has existing tables but no alembic tracking, stamp at migration 2
# so we only run migration 3 (not try to recreate existing tables)
echo "Checking migration state..."
uv run python - <<'PYEOF'
import os, sys, asyncio

async def main():
    try:
        import asyncpg
        raw = os.environ.get("DATABASE_URL", "")
        if not raw:
            print("No DATABASE_URL, skipping stamp check")
            return

        # asyncpg uses postgresql:// (not postgresql+asyncpg://)
        url = raw.replace("postgresql+asyncpg://", "postgresql://", 1)
        if not url.startswith("postgresql://"):
            print(f"Unrecognised URL scheme, skipping stamp check")
            return

        conn = await asyncpg.connect(url)
        try:
            has_ver = await conn.fetchval(
                "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='alembic_version')"
            )
            if has_ver:
                row = await conn.fetchval("SELECT version_num FROM alembic_version LIMIT 1")
                print(f"Alembic version: {row or 'none'}")
            else:
                has_tenants = await conn.fetchval(
                    "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='tenants')"
                )
                if has_tenants:
                    print("Existing schema found without alembic_version — stamping at 842eee561565")
                    await conn.execute(
                        "CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL, "
                        "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
                    )
                    await conn.execute("INSERT INTO alembic_version VALUES ('842eee561565')")
                    print("Stamped successfully")
                else:
                    print("Fresh database — will run all migrations")
        finally:
            await conn.close()
    except Exception as e:
        print(f"Stamp check error (non-fatal): {e}")

asyncio.run(main())
PYEOF

echo "Running database migrations..."
uv run alembic upgrade head
if [ $? -ne 0 ]; then
    echo "WARNING: Migration failed or timed out. Starting server anyway — some features may be unavailable."
fi

echo "Starting server on port ${PORT:-8000}..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
