from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from typing import Optional
from app.core.deps import SessionDep, UserDep, AdminDep
from app.models.shift import Shift, ShiftStatus
from app.models.order import Order, OrderItem, OrderStatus
from app.models.payment import Payment, PaymentMethod
from app.models.user import User
from app.models.location import Location

router = APIRouter(prefix="/shifts", tags=["shifts"])


class ShiftOpen(BaseModel):
    location_id: UUID
    opening_float: float = 0.0
    notes: Optional[str] = None


class ShiftClose(BaseModel):
    closing_cash: float
    notes: Optional[str] = None


class ShiftOut(BaseModel):
    id: UUID
    location_id: UUID
    cashier_id: UUID
    status: str
    opening_float: float
    closing_cash: Optional[float]
    expected_cash: Optional[float]
    cash_variance: Optional[float]
    notes: Optional[str]
    opened_at: str
    closed_at: Optional[str]
    order_count: Optional[int] = None
    total_sales: Optional[float] = None

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[ShiftOut])
async def list_shifts(
    session: SessionDep,
    user: UserDep,
    location_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    q = select(Shift).where(Shift.tenant_id == user.tenant_id)
    if location_id:
        q = q.where(Shift.location_id == location_id)
    if status:
        q = q.where(Shift.status == status)
    q = q.order_by(Shift.opened_at.desc()).limit(limit)
    shifts = (await session.scalars(q)).all()
    return [_shift_out(s) for s in shifts]


@router.get("/current", response_model=Optional[ShiftOut])
async def get_current_shift(session: SessionDep, user: UserDep):
    """Get the open shift for the current cashier, if any."""
    shift = await session.scalar(
        select(Shift).where(
            Shift.tenant_id == user.tenant_id,
            Shift.cashier_id == user.user_id,
            Shift.status == ShiftStatus.OPEN,
        ).order_by(Shift.opened_at.desc())
    )
    return _shift_out(shift) if shift else None


@router.post("/open", response_model=ShiftOut, status_code=201)
async def open_shift(body: ShiftOpen, session: SessionDep, user: UserDep):
    # Check no open shift already exists for this cashier at this location
    existing = await session.scalar(
        select(Shift).where(
            Shift.tenant_id == user.tenant_id,
            Shift.cashier_id == user.user_id,
            Shift.status == ShiftStatus.OPEN,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have an open shift. Close it first.")
    shift = Shift(
        tenant_id=user.tenant_id,
        location_id=body.location_id,
        cashier_id=user.user_id,
        opening_float=Decimal(str(body.opening_float)),
        notes=body.notes,
        opened_at=datetime.now(timezone.utc),
        status=ShiftStatus.OPEN,
    )
    session.add(shift)
    await session.flush()
    return _shift_out(shift)


@router.post("/{shift_id}/close", response_model=ShiftOut)
async def close_shift(shift_id: UUID, body: ShiftClose, session: SessionDep, user: UserDep):
    shift = await session.scalar(
        select(Shift).where(Shift.id == shift_id, Shift.tenant_id == user.tenant_id)
    )
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    if shift.status == ShiftStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Shift already closed")
    if shift.cashier_id != user.user_id and user.role not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Cannot close another cashier's shift")

    # Calculate expected cash from cash payments during this shift
    cash_payments = await session.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).join(Order).where(
            and_(
                Order.shift_id == shift_id,
                Payment.method == PaymentMethod.CASH,
            )
        )
    )
    expected = Decimal(str(shift.opening_float)) + Decimal(str(cash_payments or 0))
    closing = Decimal(str(body.closing_cash))

    shift.closing_cash = closing
    shift.expected_cash = expected
    shift.cash_variance = closing - expected
    shift.status = ShiftStatus.CLOSED
    shift.closed_at = datetime.now(timezone.utc)
    if body.notes:
        shift.notes = body.notes

    return _shift_out(shift)


@router.get("/{shift_id}", response_model=ShiftOut)
async def get_shift(shift_id: UUID, session: SessionDep, user: UserDep):
    shift = await session.scalar(
        select(Shift).where(Shift.id == shift_id, Shift.tenant_id == user.tenant_id)
    )
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    # Compute order stats
    stats = await session.execute(
        select(func.count(Order.id), func.coalesce(func.sum(Order.total), 0)).where(
            Order.shift_id == shift_id
        )
    )
    row = stats.one()
    out = _shift_out(shift)
    out.order_count = row[0]
    out.total_sales = float(row[1])
    return out


@router.get("/{shift_id}/report")
async def get_shift_report(shift_id: UUID, session: SessionDep, user: UserDep):
    """Z-Report: full end-of-shift financial summary."""
    shift = await session.scalar(
        select(Shift).where(Shift.id == shift_id, Shift.tenant_id == user.tenant_id)
    )
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    # Cashier and location names
    cashier = await session.get(User, shift.cashier_id)
    location = await session.get(Location, shift.location_id)

    # Orders during this shift
    orders = (await session.scalars(
        select(Order).where(Order.shift_id == shift_id, Order.status != OrderStatus.VOIDED)
    )).all()
    order_ids = [o.id for o in orders]

    # Payments breakdown by method
    payment_rows = (await session.execute(
        select(Payment.method, func.sum(Payment.amount), func.count(Payment.id))
        .where(Payment.order_id.in_(order_ids))
        .group_by(Payment.method)
    )).all() if order_ids else []

    payments_by_method = {
        row[0]: {"total": float(row[1]), "count": int(row[2])}
        for row in payment_rows
    }

    # Refunded orders
    refunded = [o for o in orders if o.status == OrderStatus.REFUNDED]

    # Top products
    if order_ids:
        top_rows = (await session.execute(
            select(
                OrderItem.product_name,
                func.sum(OrderItem.quantity).label("qty"),
                func.sum(OrderItem.line_total).label("revenue"),
            )
            .where(OrderItem.order_id.in_(order_ids))
            .group_by(OrderItem.product_name)
            .order_by(func.sum(OrderItem.line_total).desc())
            .limit(10)
        )).all()
        top_products = [{"name": r[0], "qty": int(r[1]), "revenue": float(r[2])} for r in top_rows]
    else:
        top_products = []

    # Aggregates
    gross_sales = sum(float(o.subtotal) for o in orders)
    promo_discounts = sum(float(o.promo_discount) for o in orders)
    loyalty_discounts = sum(float(o.loyalty_discount) for o in orders)
    item_discounts = sum(float(o.discount_amount) for o in orders)
    total_discounts = promo_discounts + loyalty_discounts + item_discounts
    tax_collected = sum(float(o.tax_amount) for o in orders)
    net_sales = sum(float(o.total) for o in orders)
    refund_total = sum(float(o.total) for o in refunded)

    return {
        "shift": {
            "id": str(shift.id),
            "status": shift.status,
            "opened_at": shift.opened_at.isoformat(),
            "closed_at": shift.closed_at.isoformat() if shift.closed_at else None,
            "opening_float": float(shift.opening_float),
            "expected_cash": float(shift.expected_cash) if shift.expected_cash is not None else None,
            "closing_cash": float(shift.closing_cash) if shift.closing_cash is not None else None,
            "cash_variance": float(shift.cash_variance) if shift.cash_variance is not None else None,
            "notes": shift.notes,
        },
        "cashier_name": cashier.full_name if cashier else "Unknown",
        "location_name": location.name if location else "Unknown",
        "summary": {
            "order_count": len(orders),
            "refund_count": len(refunded),
            "gross_sales": round(gross_sales, 2),
            "total_discounts": round(total_discounts, 2),
            "promo_discounts": round(promo_discounts, 2),
            "loyalty_discounts": round(loyalty_discounts, 2),
            "item_discounts": round(item_discounts, 2),
            "tax_collected": round(tax_collected, 2),
            "net_sales": round(net_sales, 2),
            "refund_total": round(refund_total, 2),
        },
        "payments_by_method": payments_by_method,
        "top_products": top_products,
    }


def _shift_out(s: Shift) -> ShiftOut:
    return ShiftOut(
        id=s.id,
        location_id=s.location_id,
        cashier_id=s.cashier_id,
        status=s.status,
        opening_float=float(s.opening_float),
        closing_cash=float(s.closing_cash) if s.closing_cash is not None else None,
        expected_cash=float(s.expected_cash) if s.expected_cash is not None else None,
        cash_variance=float(s.cash_variance) if s.cash_variance is not None else None,
        notes=s.notes,
        opened_at=s.opened_at.isoformat(),
        closed_at=s.closed_at.isoformat() if s.closed_at else None,
    )
