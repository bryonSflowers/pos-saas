from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.core.deps import SessionDep, UserDep, AdminDep
from app.models.customer import Customer, LoyaltyTransaction, LoyaltyTxnType

router = APIRouter(prefix="/customers", tags=["customers"])


class CustomerCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class LoyaltyAdjust(BaseModel):
    points: int
    note: Optional[str] = None


class CustomerOut(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    loyalty_points: int
    total_spent: float
    visit_count: int
    is_active: bool

    model_config = {"from_attributes": True}


class LoyaltyTxnOut(BaseModel):
    id: UUID
    txn_type: str
    points: int
    note: Optional[str]
    created_at: str

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[CustomerOut])
async def list_customers(
    session: SessionDep,
    user: UserDep,
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
):
    q = select(Customer).where(Customer.tenant_id == user.tenant_id)
    if active_only:
        q = q.where(Customer.is_active == True)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            Customer.first_name.ilike(pattern)
            | Customer.last_name.ilike(pattern)
            | Customer.email.ilike(pattern)
            | Customer.phone.ilike(pattern)
        )
    q = q.order_by(Customer.last_name, Customer.first_name)
    result = await session.scalars(q)
    return result.all()


@router.post("/", response_model=CustomerOut, status_code=201)
async def create_customer(body: CustomerCreate, session: SessionDep, user: UserDep):
    customer = Customer(tenant_id=user.tenant_id, **body.model_dump())
    session.add(customer)
    await session.flush()
    return customer


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: UUID, session: SessionDep, user: UserDep):
    customer = await session.scalar(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == user.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(customer_id: UUID, body: CustomerUpdate, session: SessionDep, user: AdminDep):
    customer = await session.scalar(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == user.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(customer, k, v)
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: UUID, session: SessionDep, user: AdminDep):
    customer = await session.scalar(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == user.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.is_active = False


@router.get("/{customer_id}/loyalty", response_model=list[LoyaltyTxnOut])
async def get_loyalty_history(customer_id: UUID, session: SessionDep, user: UserDep):
    result = await session.scalars(
        select(LoyaltyTransaction)
        .where(LoyaltyTransaction.customer_id == customer_id, LoyaltyTransaction.tenant_id == user.tenant_id)
        .order_by(LoyaltyTransaction.created_at.desc())
        .limit(100)
    )
    return [
        LoyaltyTxnOut(
            id=t.id,
            txn_type=t.txn_type,
            points=t.points,
            note=t.note,
            created_at=t.created_at.isoformat(),
        )
        for t in result.all()
    ]


@router.post("/{customer_id}/loyalty/adjust", response_model=CustomerOut)
async def adjust_loyalty(customer_id: UUID, body: LoyaltyAdjust, session: SessionDep, user: AdminDep):
    customer = await session.scalar(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == user.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.loyalty_points + body.points < 0:
        raise HTTPException(status_code=400, detail="Insufficient loyalty points")
    customer.loyalty_points += body.points
    txn = LoyaltyTransaction(
        tenant_id=user.tenant_id,
        customer_id=customer_id,
        txn_type=LoyaltyTxnType.ADJUST,
        points=body.points,
        note=body.note,
    )
    session.add(txn)
    return customer
