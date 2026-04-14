from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.core.deps import SessionDep, UserDep, AdminDep
from app.models.promotion import Promotion, DiscountType, PromoScope

router = APIRouter(prefix="/promotions", tags=["promotions"])


class PromotionCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    discount_type: DiscountType
    discount_value: float
    scope: PromoScope = PromoScope.ORDER
    min_order_amount: Optional[float] = None
    max_uses: Optional[int] = None
    max_uses_per_customer: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class PromotionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_value: Optional[float] = None
    min_order_amount: Optional[float] = None
    max_uses: Optional[int] = None
    is_active: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class PromoValidate(BaseModel):
    code: str
    order_subtotal: float
    customer_id: Optional[UUID] = None


class PromotionOut(BaseModel):
    id: UUID
    name: str
    code: Optional[str]
    description: Optional[str]
    discount_type: str
    discount_value: float
    scope: str
    min_order_amount: Optional[float]
    max_uses: Optional[int]
    uses_count: int
    is_active: bool
    starts_at: Optional[str]
    ends_at: Optional[str]

    model_config = {"from_attributes": True}


class PromoValidateOut(BaseModel):
    valid: bool
    promotion_id: Optional[UUID] = None
    name: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    calculated_discount: Optional[float] = None
    error: Optional[str] = None


@router.get("/", response_model=list[PromotionOut])
async def list_promotions(session: SessionDep, user: UserDep, active_only: bool = Query(False)):
    q = select(Promotion).where(Promotion.tenant_id == user.tenant_id)
    if active_only:
        q = q.where(Promotion.is_active == True)
    q = q.order_by(Promotion.created_at.desc())
    rows = (await session.scalars(q)).all()
    return [_promo_out(p) for p in rows]


@router.post("/", response_model=PromotionOut, status_code=201)
async def create_promotion(body: PromotionCreate, session: SessionDep, user: AdminDep):
    if body.code:
        existing = await session.scalar(
            select(Promotion).where(
                Promotion.tenant_id == user.tenant_id,
                Promotion.code == body.code.upper(),
                Promotion.is_active == True,
            )
        )
        if existing:
            raise HTTPException(status_code=400, detail="Promo code already in use")
    promo = Promotion(
        tenant_id=user.tenant_id,
        name=body.name,
        code=body.code.upper() if body.code else None,
        description=body.description,
        discount_type=body.discount_type,
        discount_value=Decimal(str(body.discount_value)),
        scope=body.scope,
        min_order_amount=Decimal(str(body.min_order_amount)) if body.min_order_amount else None,
        max_uses=body.max_uses,
        max_uses_per_customer=body.max_uses_per_customer,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
    )
    session.add(promo)
    await session.flush()
    return _promo_out(promo)


@router.patch("/{promo_id}", response_model=PromotionOut)
async def update_promotion(promo_id: UUID, body: PromotionUpdate, session: SessionDep, user: AdminDep):
    promo = await session.scalar(
        select(Promotion).where(Promotion.id == promo_id, Promotion.tenant_id == user.tenant_id)
    )
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    for k, v in body.model_dump(exclude_none=True).items():
        if k == "discount_value" and v is not None:
            v = Decimal(str(v))
        setattr(promo, k, v)
    return _promo_out(promo)


@router.delete("/{promo_id}", status_code=204)
async def delete_promotion(promo_id: UUID, session: SessionDep, user: AdminDep):
    promo = await session.scalar(
        select(Promotion).where(Promotion.id == promo_id, Promotion.tenant_id == user.tenant_id)
    )
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    promo.is_active = False


@router.post("/validate", response_model=PromoValidateOut)
async def validate_promo_code(body: PromoValidate, session: SessionDep, user: UserDep):
    """Validate a promo code and calculate the discount for the given order subtotal."""
    promo = await session.scalar(
        select(Promotion).where(
            Promotion.tenant_id == user.tenant_id,
            Promotion.code == body.code.upper(),
            Promotion.is_active == True,
        )
    )
    if not promo:
        return PromoValidateOut(valid=False, error="Invalid promo code")

    now = datetime.now(timezone.utc)
    if promo.starts_at and now < promo.starts_at:
        return PromoValidateOut(valid=False, error="Promotion not yet active")
    if promo.ends_at and now > promo.ends_at:
        return PromoValidateOut(valid=False, error="Promotion has expired")
    if promo.max_uses and promo.uses_count >= promo.max_uses:
        return PromoValidateOut(valid=False, error="Promotion usage limit reached")
    if promo.min_order_amount and Decimal(str(body.order_subtotal)) < promo.min_order_amount:
        return PromoValidateOut(
            valid=False,
            error=f"Minimum order amount is ${float(promo.min_order_amount):.2f}"
        )

    subtotal = Decimal(str(body.order_subtotal))
    if promo.discount_type == DiscountType.PERCENTAGE:
        discount = subtotal * promo.discount_value / 100
    elif promo.discount_type == DiscountType.FIXED:
        discount = min(promo.discount_value, subtotal)
    else:
        discount = Decimal("0")

    return PromoValidateOut(
        valid=True,
        promotion_id=promo.id,
        name=promo.name,
        discount_type=promo.discount_type,
        discount_value=float(promo.discount_value),
        calculated_discount=float(discount),
    )


def _promo_out(p: Promotion) -> PromotionOut:
    return PromotionOut(
        id=p.id,
        name=p.name,
        code=p.code,
        description=p.description,
        discount_type=p.discount_type,
        discount_value=float(p.discount_value),
        scope=p.scope,
        min_order_amount=float(p.min_order_amount) if p.min_order_amount else None,
        max_uses=p.max_uses,
        uses_count=p.uses_count,
        is_active=p.is_active,
        starts_at=p.starts_at.isoformat() if p.starts_at else None,
        ends_at=p.ends_at.isoformat() if p.ends_at else None,
    )
