from uuid import UUID
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.deps import SessionDep, UserDep, AdminDep
from app.models.order import Order, OrderStatus
from app.models.product import Product
from app.schemas.order import OrderCreate, OrderOut
from app.services.order import create_order

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("/", response_model=list[OrderOut])
async def list_orders(session: SessionDep, user: UserDep):
    orders = await session.scalars(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.tenant_id == user.tenant_id)
        .order_by(Order.created_at.desc())
        .limit(200)
    )
    return orders.all()


@router.post("/", response_model=OrderOut, status_code=201)
async def place_order(body: OrderCreate, session: SessionDep, user: UserDep):
    try:
        order = await create_order(session, user.tenant_id, user.user_id, body)
        await session.flush()
        order = await session.scalar(
            select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
        )
        return order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: UUID, session: SessionDep, user: UserDep):
    order = await session.scalar(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.tenant_id == user.tenant_id)
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/{order_id}/void", response_model=OrderOut)
async def void_order(order_id: UUID, session: SessionDep, user: AdminDep):
    order = await session.scalar(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.tenant_id == user.tenant_id)
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in (OrderStatus.REFUNDED, OrderStatus.VOIDED):
        raise HTTPException(status_code=400, detail=f"Order is already {order.status}")

    # Restore inventory
    for item in order.items:
        product = await session.scalar(select(Product).where(Product.id == item.product_id))
        if product and product.track_inventory:
            product.stock_qty += item.quantity

    order.status = OrderStatus.VOIDED
    await session.flush()
    return order


@router.post("/{order_id}/refund", response_model=OrderOut)
async def refund_order(order_id: UUID, session: SessionDep, user: AdminDep):
    order = await session.scalar(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.tenant_id == user.tenant_id)
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.PAID:
        raise HTTPException(status_code=400, detail="Only paid orders can be refunded")

    # Restore inventory
    for item in order.items:
        product = await session.scalar(select(Product).where(Product.id == item.product_id))
        if product and product.track_inventory:
            product.stock_qty += item.quantity

    order.status = OrderStatus.REFUNDED
    await session.flush()
    return order
