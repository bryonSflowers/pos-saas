# POS SaaS — FastAPI + PostgreSQL

Multi-tenant Point of Sale backend supporting retail and restaurant use cases.

## Stack
- **API**: FastAPI (async)
- **DB**: PostgreSQL 16 via SQLAlchemy 2.0 (async)
- **Migrations**: Alembic
- **Auth**: JWT (python-jose)
- **Task queue**: Celery + Redis
- **Payments**: Stripe Terminal + Stripe Online
- **Containerization**: Docker + docker-compose

## Quick Start

```bash
# Copy env and edit values
cp .env.example .env

# Start all services
docker compose up -d

# Run migrations
docker compose exec api uv run alembic upgrade head

# API docs
open http://localhost:8000/docs
```

## Tenant Isolation

Row-level isolation: every table has `tenant_id` (FK → tenants). All queries
in services and endpoints filter by `tenant_id` derived from the JWT.
No cross-tenant data leakage is possible without a compromised token.

## API Structure

```
POST /api/v1/tenants/register     Register new tenant + owner
POST /api/v1/auth/login           Get JWT token
GET  /api/v1/products/            List products (tenant-scoped)
POST /api/v1/products/            Create product (admin/owner)
POST /api/v1/orders/              Place order (any authenticated user)
GET  /api/v1/orders/{id}          Get order details
```

## Multi-tenant Data Model

```
Tenant
  └── Locations (branches)
  └── Users (owner / admin / manager / cashier)
  └── Products → Categories
       └── Orders → OrderItems
            └── Payments
```
