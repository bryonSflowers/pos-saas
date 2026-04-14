from fastapi import APIRouter, Query
from sqlalchemy import select, func
from datetime import date, datetime, timezone
from decimal import Decimal
from pydantic import BaseModel
from app.core.deps import SessionDep, AdminDep
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product

router = APIRouter(prefix="/reports", tags=["reports"])


class SalesSummary(BaseModel):
    date: str
    order_count: int
    revenue: Decimal
    tax: Decimal
    refunds: int


class InventoryItem(BaseModel):
    id: str
    name: str
    sku: str | None
    stock_qty: int
    price: Decimal
    is_active: bool


class TopProduct(BaseModel):
    product_name: str
    quantity_sold: int
    revenue: Decimal


@router.get("/sales", response_model=list[SalesSummary])
async def sales_report(
    session: SessionDep,
    user: AdminDep,
    days: int = Query(default=30, ge=1, le=365),
):
    """Daily sales summary for the last N days."""
    from datetime import timedelta
    start = datetime.now(timezone.utc) - timedelta(days=days)

    orders = await session.scalars(
        select(Order)
        .where(
            Order.tenant_id == user.tenant_id,
            Order.created_at >= start,
            Order.status.in_([OrderStatus.PAID, OrderStatus.REFUNDED]),
        )
        .order_by(Order.created_at)
    )
    all_orders = orders.all()

    # Group by date
    by_date: dict[str, dict] = {}
    for o in all_orders:
        d = o.created_at.strftime("%Y-%m-%d")
        if d not in by_date:
            by_date[d] = {"order_count": 0, "revenue": Decimal("0"), "tax": Decimal("0"), "refunds": 0}
        if o.status == OrderStatus.PAID:
            by_date[d]["order_count"] += 1
            by_date[d]["revenue"] += o.total
            by_date[d]["tax"] += o.tax_amount
        else:
            by_date[d]["refunds"] += 1

    return [
        SalesSummary(date=d, **v)
        for d, v in sorted(by_date.items())
    ]


@router.get("/inventory", response_model=list[InventoryItem])
async def inventory_report(session: SessionDep, user: AdminDep):
    """Full inventory list with stock levels."""
    products = await session.scalars(
        select(Product)
        .where(Product.tenant_id == user.tenant_id)
        .order_by(Product.stock_qty, Product.name)
    )
    return [
        InventoryItem(
            id=str(p.id),
            name=p.name,
            sku=p.sku,
            stock_qty=p.stock_qty,
            price=p.price,
            is_active=p.is_active,
        )
        for p in products.all()
    ]


@router.get("/top-products", response_model=list[TopProduct])
async def top_products_report(
    session: SessionDep,
    user: AdminDep,
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Top selling products by quantity."""
    from datetime import timedelta
    start = datetime.now(timezone.utc) - timedelta(days=days)

    rows = await session.execute(
        select(
            OrderItem.product_name,
            func.sum(OrderItem.quantity).label("quantity_sold"),
            func.sum(OrderItem.line_total).label("revenue"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.tenant_id == user.tenant_id,
            Order.status == OrderStatus.PAID,
            Order.created_at >= start,
        )
        .group_by(OrderItem.product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    )
    return [
        TopProduct(product_name=r.product_name, quantity_sold=r.quantity_sold, revenue=r.revenue)
        for r in rows.all()
    ]
