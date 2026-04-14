from uuid import UUID
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.deps import SessionDep, UserDep, AdminDep
from app.core.plans import check_limit
from app.models.product import Product, Category
from app.models.tenant import Tenant
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=list[ProductOut])
async def list_products(session: SessionDep, user: UserDep):
    products = await session.scalars(
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.tenant_id == user.tenant_id)
        .order_by(Product.name)
    )
    return products.all()


@router.post("/", response_model=ProductOut, status_code=201)
async def create_product(body: ProductCreate, session: SessionDep, user: AdminDep):
    tenant = await session.get(Tenant, user.tenant_id)
    if tenant:
        current_count = await session.scalar(
            select(func.count(Product.id)).where(
                Product.tenant_id == user.tenant_id, Product.is_active == True
            )
        ) or 0
        allowed, limit = check_limit(tenant.plan, "products", current_count)
        if not allowed:
            raise HTTPException(
                status_code=402,
                detail=f"Product limit reached ({limit} on your plan). Upgrade to add more."
            )
    if body.category_id:
        cat = await session.scalar(
            select(Category).where(Category.id == body.category_id, Category.tenant_id == user.tenant_id)
        )
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")
    product = Product(tenant_id=user.tenant_id, **body.model_dump())
    session.add(product)
    await session.flush()
    return product


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(product_id: UUID, body: ProductUpdate, session: SessionDep, user: AdminDep):
    product = await session.scalar(
        select(Product).where(Product.id == product_id, Product.tenant_id == user.tenant_id)
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(product, k, v)
    return product


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: UUID, session: SessionDep, user: AdminDep):
    product = await session.scalar(
        select(Product).where(Product.id == product_id, Product.tenant_id == user.tenant_id)
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    # Soft delete
    product.is_active = False
