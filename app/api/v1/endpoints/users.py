from uuid import UUID
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func
from app.core.deps import SessionDep, UserDep, AdminDep
from app.core.security import hash_password
from app.core.plans import check_limit
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.user import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
async def list_users(session: SessionDep, user: AdminDep):
    rows = await session.scalars(
        select(User).where(User.tenant_id == user.tenant_id).order_by(User.full_name)
    )
    return rows.all()


@router.get("/me", response_model=UserOut)
async def get_me(session: SessionDep, user: UserDep):
    row = await session.scalar(select(User).where(User.id == user.user_id))
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row


@router.post("/", response_model=UserOut, status_code=201)
async def create_user(body: UserCreate, session: SessionDep, user: AdminDep):
    tenant = await session.get(Tenant, user.tenant_id)
    if tenant:
        current_count = await session.scalar(
            select(func.count(User.id)).where(
                User.tenant_id == user.tenant_id, User.is_active == True
            )
        ) or 0
        allowed, limit = check_limit(tenant.plan, "users", current_count)
        if not allowed:
            raise HTTPException(
                status_code=402,
                detail=f"User limit reached ({limit} on your plan). Upgrade to add more."
            )
    existing = await session.scalar(
        select(User).where(User.email == body.email, User.tenant_id == user.tenant_id)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")
    new_user = User(
        tenant_id=user.tenant_id,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        location_id=body.location_id,
    )
    session.add(new_user)
    await session.flush()
    return new_user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: UUID, body: UserUpdate, session: SessionDep, current: AdminDep):
    row = await session.scalar(
        select(User).where(User.id == user_id, User.tenant_id == current.tenant_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    return row


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: UUID, session: SessionDep, current: AdminDep):
    if user_id == current.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    row = await session.scalar(
        select(User).where(User.id == user_id, User.tenant_id == current.tenant_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    await session.delete(row)
