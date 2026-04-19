#!/bin/bash
echo "=== POS SaaS startup ==="

# If DB has existing tables but no alembic tracking, stamp at migration 2
# so we only run migration 3 (not try to recreate existing tables)
echo "Checking migration state..."
uv run python - <<'PYEOF'
import os, sys
try:
    from sqlalchemy import create_engine, text
    raw = os.environ.get("DATABASE_URL", "")
    if not raw:
        print("No DATABASE_URL, skipping stamp check")
        sys.exit(0)
    url = raw.replace("postgresql://", "postgresql+psycopg2://", 1) \
             .replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    engine = create_engine(url, pool_pre_ping=True)
    with engine.connect() as conn:
        # Check if alembic_version table exists
        r = conn.execute(text(
            "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='alembic_version')"
        ))
        has_ver = r.scalar()
        if has_ver:
            r2 = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
            row = r2.fetchone()
            print(f"Alembic version: {row[0] if row else 'none'}")
        else:
            # Check if tenants table exists (schema was set up without Alembic)
            r2 = conn.execute(text(
                "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='tenants')"
            ))
            has_tenants = r2.scalar()
            if has_tenants:
                print("Existing schema found without alembic_version — stamping at 842eee561565")
                conn.execute(text(
                    "CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
                ))
                conn.execute(text("INSERT INTO alembic_version VALUES ('842eee561565')"))
                conn.commit()
            else:
                print("Fresh database — will run all migrations")
    engine.dispose()
except Exception as e:
    print(f"Stamp check error (non-fatal): {e}")
PYEOF

echo "Running database migrations..."
uv run alembic upgrade head
if [ $? -ne 0 ]; then
    echo "WARNING: Migration failed. Starting server anyway — some features may be unavailable."
fi

echo "Starting server..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
