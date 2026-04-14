from uuid import UUID
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.core.deps import SessionDep, UserDep, AdminDep
from app.models.product import Category
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryOut])
async def list_categories(session: SessionDep, user: UserDep):
    rows = await session.scalars(
        select(Category).where(Category.tenant_id == user.tenant_id).order_by(Category.name)
    )
    return rows.all()


@router.post("/", response_model=CategoryOut, status_code=201)
async def create_category(body: CategoryCreate, session: SessionDep, user: AdminDep):
    cat = Category(tenant_id=user.tenant_id, **body.model_dump())
    session.add(cat)
    await session.flush()
    return cat


@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(category_id: UUID, body: CategoryUpdate, session: SessionDep, user: AdminDep):
    cat = await session.scalar(
        select(Category).where(Category.id == category_id, Category.tenant_id == user.tenant_id)
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    return cat


@router.delete("/{category_id}", status_code=204)
async def delete_category(category_id: UUID, session: SessionDep, user: AdminDep):
    cat = await session.scalar(
        select(Category).where(Category.id == category_id, Category.tenant_id == user.tenant_id)
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await session.delete(cat)
