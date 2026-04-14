"""
Plan definitions and limit enforcement.
Maps TenantPlan enum values to feature limits.
"""
from typing import Any
from app.models.tenant import TenantPlan

# -1 = unlimited
PLAN_LIMITS: dict[str, dict[str, Any]] = {
    TenantPlan.FREE: {
        "name": "Free",
        "price_monthly": 0,
        "price_yearly": 0,
        "locations": 1,
        "products": 50,
        "users": 1,
        "features": ["pos", "orders", "basic_reports"],
        "stripe_price_id_monthly": None,
        "stripe_price_id_yearly": None,
        "description": "Get started with a single location",
        "highlight": False,
    },
    TenantPlan.STARTER: {
        "name": "Starter",
        "price_monthly": 29,
        "price_yearly": 279,
        "locations": 2,
        "products": 200,
        "users": 3,
        "features": ["pos", "orders", "reports", "customers", "shifts", "inventory"],
        "stripe_price_id_monthly": None,   # set via STRIPE_PRICE_STARTER_MONTHLY env
        "stripe_price_id_yearly": None,
        "description": "For small shops ready to grow",
        "highlight": False,
    },
    TenantPlan.PRO: {
        "name": "Growth",
        "price_monthly": 79,
        "price_yearly": 759,
        "locations": 5,
        "products": -1,
        "users": 10,
        "features": [
            "pos", "orders", "reports", "customers", "shifts",
            "inventory", "suppliers", "loyalty", "promotions",
            "stripe_terminal", "z_report", "email_receipts",
        ],
        "stripe_price_id_monthly": None,
        "stripe_price_id_yearly": None,
        "description": "Everything you need to run a serious retail operation",
        "highlight": True,
    },
    TenantPlan.ENTERPRISE: {
        "name": "Enterprise",
        "price_monthly": 199,
        "price_yearly": 1899,
        "locations": -1,
        "products": -1,
        "users": -1,
        "features": ["all", "white_label", "api_access", "priority_support", "custom_integrations"],
        "stripe_price_id_monthly": None,
        "stripe_price_id_yearly": None,
        "description": "Unlimited scale, white-label, dedicated support",
        "highlight": False,
    },
}

PLAN_ORDER = [TenantPlan.FREE, TenantPlan.STARTER, TenantPlan.PRO, TenantPlan.ENTERPRISE]


def get_plan(plan: TenantPlan) -> dict[str, Any]:
    return PLAN_LIMITS[plan]


def plan_allows_feature(plan: TenantPlan, feature: str) -> bool:
    limits = PLAN_LIMITS[plan]
    return "all" in limits["features"] or feature in limits["features"]


def check_limit(plan: TenantPlan, resource: str, current_count: int) -> tuple[bool, int]:
    """Returns (allowed, limit). limit -1 = unlimited."""
    limits = PLAN_LIMITS[plan]
    limit = limits.get(resource, 0)
    if limit == -1:
        return True, -1
    return current_count < limit, limit
