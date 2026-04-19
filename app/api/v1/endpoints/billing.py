"""
Billing — Stripe Subscriptions + plan management.
"""
import os
import stripe
from uuid import UUID
from fastapi import APIRouter, HTTPException, Request, Header
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from app.core.deps import SessionDep, UserDep, AdminDep
from app.core.config import settings
from app.core.plans import PLAN_LIMITS, PLAN_ORDER, get_plan
from app.models.tenant import Tenant, TenantPlan
from app.models.location import Location
from app.models.product import Product
from app.models.user import User

router = APIRouter(prefix="/billing", tags=["billing"])


def _stripe():
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    stripe.api_key = settings.stripe_secret_key
    return stripe


def _price_id_from_env(plan: str, interval: str) -> Optional[str]:
    """Load Stripe price IDs from environment variables at runtime."""
    key = f"STRIPE_PRICE_{plan.upper()}_{interval.upper()}"
    return os.environ.get(key)


# ── Public plan info ──────────────────────────────────────────────────────────

@router.get("/plans")
async def list_plans():
    """Return all plan definitions for the pricing page (no auth required)."""
    plans = []
    for plan_key in PLAN_ORDER:
        p = PLAN_LIMITS[plan_key].copy()
        p["id"] = plan_key
        plans.append(p)
    return plans


# ── Current tenant billing info ───────────────────────────────────────────────

@router.get("/current")
async def get_billing(session: SessionDep, user: UserDep):
    """Current plan, usage counters, and Stripe subscription status."""
    tenant = await session.get(Tenant, user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Usage counts
    location_count = await session.scalar(
        select(func.count(Location.id)).where(Location.tenant_id == user.tenant_id, Location.is_active == True)
    ) or 0
    product_count = await session.scalar(
        select(func.count(Product.id)).where(Product.tenant_id == user.tenant_id, Product.is_active == True)
    ) or 0
    user_count = await session.scalar(
        select(func.count(User.id)).where(User.tenant_id == user.tenant_id, User.is_active == True)
    ) or 0

    limits = get_plan(tenant.plan)

    return {
        "plan": tenant.plan,
        "plan_name": limits["name"],
        "price_monthly": limits["price_monthly"],
        "stripe_customer_id": tenant.stripe_customer_id,
        "stripe_subscription_id": tenant.stripe_subscription_id,
        "usage": {
            "locations": {"current": location_count, "limit": limits["locations"]},
            "products": {"current": product_count, "limit": limits["products"]},
            "users": {"current": user_count, "limit": limits["users"]},
        },
        "features": limits["features"],
    }


# ── Stripe Checkout ───────────────────────────────────────────────────────────

class CheckoutBody(BaseModel):
    plan: str  # "starter" | "pro" | "enterprise"
    interval: str = "monthly"  # "monthly" | "yearly"
    success_url: str
    cancel_url: str


@router.post("/checkout")
async def create_checkout_session(body: CheckoutBody, session: SessionDep, user: AdminDep):
    """Create a Stripe Checkout Session for plan upgrade."""
    s = _stripe()

    try:
        plan_enum = TenantPlan(body.plan.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan}")

    price_id = _price_id_from_env(body.plan, body.interval)
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe price not configured. Add STRIPE_PRICE_{body.plan.upper()}_{body.interval.upper()} to env."
        )

    tenant = await session.get(Tenant, user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Create or reuse Stripe customer
    customer_id = tenant.stripe_customer_id
    if not customer_id:
        customer = s.Customer.create(
            metadata={"tenant_id": str(user.tenant_id), "slug": tenant.slug}
        )
        customer_id = customer.id
        tenant.stripe_customer_id = customer_id

    checkout = s.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=body.success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=body.cancel_url,
        metadata={"tenant_id": str(user.tenant_id), "plan": body.plan},
        subscription_data={
            "metadata": {"tenant_id": str(user.tenant_id), "plan": body.plan}
        },
    )

    return {"checkout_url": checkout.url}


# ── Customer portal ───────────────────────────────────────────────────────────

class PortalBody(BaseModel):
    return_url: str


@router.post("/portal")
async def create_portal_session(body: PortalBody, session: SessionDep, user: AdminDep):
    """Stripe Customer Portal — manage subscription, invoices, payment method."""
    s = _stripe()
    tenant = await session.get(Tenant, user.tenant_id)
    if not tenant or not tenant.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found. Subscribe first.")

    portal = s.billing_portal.Session.create(
        customer=tenant.stripe_customer_id,
        return_url=body.return_url,
    )
    return {"portal_url": portal.url}


# ── Stripe webhook ────────────────────────────────────────────────────────────

PLAN_FROM_PRICE: dict[str, str] = {}  # populated lazily from env at request time


def _resolve_plan_from_price(price_id: str) -> Optional[str]:
    for plan in ["starter", "pro", "enterprise"]:
        for interval in ["monthly", "yearly"]:
            if _price_id_from_env(plan, interval) == price_id:
                return plan
    return None


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    """Handle Stripe subscription lifecycle events."""
    payload = await request.body()
    webhook_secret = settings.stripe_webhook_secret

    if webhook_secret:
        try:
            event = stripe.Webhook.construct_event(payload, stripe_signature, webhook_secret)
        except stripe.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        import json
        event = json.loads(payload)

    # Get a DB session for webhook handling
    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        if event["type"] in ("customer.subscription.created", "customer.subscription.updated"):
            sub = event["data"]["object"]
            tenant_id = sub.get("metadata", {}).get("tenant_id")
            plan_name = sub.get("metadata", {}).get("plan")

            # Fallback: derive plan from price ID
            if not plan_name and sub.get("items", {}).get("data"):
                price_id = sub["items"]["data"][0]["price"]["id"]
                plan_name = _resolve_plan_from_price(price_id)

            if tenant_id and plan_name:
                try:
                    plan_enum = TenantPlan(plan_name.upper())
                    tenant = await db.get(Tenant, UUID(tenant_id))
                    if tenant:
                        tenant.plan = plan_enum
                        tenant.stripe_subscription_id = sub["id"]
                        await db.commit()
                except (ValueError, Exception):
                    pass

        elif event["type"] == "customer.subscription.deleted":
            sub = event["data"]["object"]
            tenant_id = sub.get("metadata", {}).get("tenant_id")
            if tenant_id:
                tenant = await db.get(Tenant, UUID(tenant_id))
                if tenant:
                    tenant.plan = TenantPlan.FREE
                    tenant.stripe_subscription_id = None
                    await db.commit()

    return {"received": True}
