from uuid import UUID
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from app.core.deps import SessionDep, UserDep, AdminDep
from app.models.inventory import InventoryAdjustment, AdjustmentReason
from app.models.product import Product

router = APIRouter(prefix="/inventory-adjustments", tags=["inventory"])


class AdjustmentCreate(BaseModel):
    product_id: UUID
    qty_change: int  # positive = add, negative = remove
    reason: AdjustmentReason
    note: Optional[str] = None
    reference_id: Optional[str] = None


class AdjustmentOut(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    user_id: UUID
    reason: str
    qty_before: int
    qty_change: int
    qty_after: int
    note: Optional[str]
    reference_id: Optional[str]
    created_at: str

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[AdjustmentOut])
async def list_adjustments(
    session: SessionDep,
    user: UserDep,
    product_id: Optional[UUID] = Query(None),
    limit: int = Query(100, le=500),
):
    q = (
        select(InventoryAdjustment)
        .options(selectinload(InventoryAdjustment.product))
        .where(InventoryAdjustment.tenant_id == user.tenant_id)
    )
    if product_id:
        q = q.where(InventoryAdjustment.product_id == product_id)
    q = q.order_by(InventoryAdjustment.created_at.desc()).limit(limit)
    rows = (await session.scalars(q)).all()
    return [
        AdjustmentOut(
            id=r.id,
            product_id=r.product_id,
            product_name=r.product.name,
            user_id=r.user_id,
            reason=r.reason,
            qty_before=r.qty_before,
            qty_change=r.qty_change,
            qty_after=r.qty_after,
            note=r.note,
            reference_id=r.reference_id,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/", response_model=AdjustmentOut, status_code=201)
async def create_adjustment(body: AdjustmentCreate, session: SessionDep, user: AdminDep):
    product = await session.scalar(
        select(Product).where(Product.id == body.product_id, Product.tenant_id == user.tenant_id)
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    qty_before = product.stock_qty
    qty_after = qty_before + body.qty_change
    if qty_after < 0:
        raise HTTPException(status_code=400, detail=f"Adjustment would result in negative stock ({qty_after})")

    product.stock_qty = qty_after

    adj = InventoryAdjustment(
        tenant_id=user.tenant_id,
        product_id=body.product_id,
        user_id=user.user_id,
        reason=body.reason,
        qty_before=qty_before,
        qty_change=body.qty_change,
        qty_after=qty_after,
        note=body.note,
        reference_id=body.reference_id,
    )
    session.add(adj)
    await session.flush()
    return AdjustmentOut(
        id=adj.id,
        product_id=adj.product_id,
        product_name=product.name,
        user_id=adj.user_id,
        reason=adj.reason,
        qty_before=adj.qty_before,
        qty_change=adj.qty_change,
        qty_after=adj.qty_after,
        note=adj.note,
        reference_id=adj.reference_id,
        created_at=adj.created_at.isoformat() if adj.created_at else "",
    )
