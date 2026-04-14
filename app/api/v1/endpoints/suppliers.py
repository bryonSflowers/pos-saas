from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from app.core.deps import SessionDep, UserDep, AdminDep
from app.models.supplier import Supplier, PurchaseOrder, PurchaseOrderItem, POStatus
from app.models.product import Product
from app.models.inventory import InventoryAdjustment, AdjustmentReason

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class POItemCreate(BaseModel):
    product_id: UUID
    qty_ordered: int
    unit_cost: float


class POCreate(BaseModel):
    supplier_id: UUID
    expected_date: Optional[datetime] = None
    notes: Optional[str] = None
    items: list[POItemCreate]


class SupplierOut(BaseModel):
    id: UUID
    name: str
    contact_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


class POItemOut(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    qty_ordered: int
    qty_received: int
    unit_cost: float
    line_total: float


class POOut(BaseModel):
    id: UUID
    supplier_id: UUID
    supplier_name: str
    po_number: str
    status: str
    expected_date: Optional[str]
    received_at: Optional[str]
    total_cost: float
    notes: Optional[str]
    items: list[POItemOut]
    created_at: str


# ── Supplier CRUD ─────────────────────────────────────────────────────────────

@router.get("/", response_model=list[SupplierOut])
async def list_suppliers(session: SessionDep, user: UserDep, active_only: bool = Query(True)):
    q = select(Supplier).where(Supplier.tenant_id == user.tenant_id)
    if active_only:
        q = q.where(Supplier.is_active == True)
    return (await session.scalars(q.order_by(Supplier.name))).all()


@router.post("/", response_model=SupplierOut, status_code=201)
async def create_supplier(body: SupplierCreate, session: SessionDep, user: AdminDep):
    supplier = Supplier(tenant_id=user.tenant_id, **body.model_dump())
    session.add(supplier)
    await session.flush()
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(supplier_id: UUID, body: SupplierUpdate, session: SessionDep, user: AdminDep):
    supplier = await session.scalar(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.tenant_id == user.tenant_id)
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(supplier, k, v)
    return supplier


# ── Purchase Orders ───────────────────────────────────────────────────────────

@router.get("/purchase-orders", response_model=list[POOut])
async def list_purchase_orders(
    session: SessionDep,
    user: UserDep,
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    q = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.supplier), selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product))
        .where(PurchaseOrder.tenant_id == user.tenant_id)
    )
    if status:
        q = q.where(PurchaseOrder.status == status)
    rows = (await session.scalars(q.order_by(PurchaseOrder.created_at.desc()).limit(limit))).all()
    return [_po_out(po) for po in rows]


@router.post("/purchase-orders", response_model=POOut, status_code=201)
async def create_purchase_order(body: POCreate, session: SessionDep, user: AdminDep):
    supplier = await session.scalar(
        select(Supplier).where(Supplier.id == body.supplier_id, Supplier.tenant_id == user.tenant_id)
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Generate PO number
    count = await session.scalar(
        select(PurchaseOrder).where(PurchaseOrder.tenant_id == user.tenant_id)
    )
    po_number = f"PO-{(await session.execute(select(PurchaseOrder.id).where(PurchaseOrder.tenant_id == user.tenant_id))).rowcount + 1:05d}"

    total_cost = Decimal("0")
    po_items = []
    for item in body.items:
        product = await session.scalar(select(Product).where(Product.id == item.product_id, Product.tenant_id == user.tenant_id))
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        line_total = Decimal(str(item.unit_cost)) * item.qty_ordered
        total_cost += line_total
        po_items.append(PurchaseOrderItem(
            product_id=item.product_id,
            qty_ordered=item.qty_ordered,
            unit_cost=Decimal(str(item.unit_cost)),
            line_total=line_total,
        ))

    po = PurchaseOrder(
        tenant_id=user.tenant_id,
        supplier_id=body.supplier_id,
        created_by=user.user_id,
        po_number=po_number,
        expected_date=body.expected_date,
        notes=body.notes,
        total_cost=total_cost,
        status=POStatus.DRAFT,
        items=po_items,
    )
    session.add(po)
    await session.flush()
    await session.refresh(po, ["supplier", "items"])
    for item in po.items:
        await session.refresh(item, ["product"])
    return _po_out(po)


@router.post("/purchase-orders/{po_id}/receive", response_model=POOut)
async def receive_purchase_order(po_id: UUID, session: SessionDep, user: AdminDep):
    """Mark PO as received and update inventory for all items."""
    po = await session.scalar(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.supplier), selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product))
        .where(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == user.tenant_id)
    )
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status == POStatus.RECEIVED:
        raise HTTPException(status_code=400, detail="Already received")
    if po.status == POStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot receive a cancelled PO")

    for item in po.items:
        product = item.product
        adj = InventoryAdjustment(
            tenant_id=user.tenant_id,
            product_id=item.product_id,
            user_id=user.user_id,
            reason=AdjustmentReason.TRANSFER_IN,
            qty_before=product.stock_qty,
            qty_change=item.qty_ordered,
            qty_after=product.stock_qty + item.qty_ordered,
            reference_id=str(po.id),
            note=f"Received from PO {po.po_number}",
        )
        product.stock_qty += item.qty_ordered
        item.qty_received = item.qty_ordered
        session.add(adj)

    po.status = POStatus.RECEIVED
    po.received_at = datetime.now(timezone.utc)
    return _po_out(po)


def _po_out(po: PurchaseOrder) -> POOut:
    return POOut(
        id=po.id,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name,
        po_number=po.po_number,
        status=po.status,
        expected_date=po.expected_date.isoformat() if po.expected_date else None,
        received_at=po.received_at.isoformat() if po.received_at else None,
        total_cost=float(po.total_cost),
        notes=po.notes,
        items=[
            POItemOut(
                id=i.id,
                product_id=i.product_id,
                product_name=i.product.name,
                qty_ordered=i.qty_ordered,
                qty_received=i.qty_received,
                unit_cost=float(i.unit_cost),
                line_total=float(i.line_total),
            )
            for i in po.items
        ],
        created_at=po.created_at.isoformat(),
    )
