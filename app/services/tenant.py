from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.schemas.tenant import TenantCreate
from app.core.security import hash_password
from slugify import slugify


async def create_tenant(session: AsyncSession, data: TenantCreate) -> tuple[Tenant, User]:
    slug = slugify(data.slug)
    existing = await session.scalar(select(Tenant).where(Tenant.slug == slug))
    if existing:
        raise ValueError(f"Slug '{slug}' already taken")

    tenant = Tenant(name=data.name, slug=slug)
    session.add(tenant)
    await session.flush()  # get tenant.id before creating user

    owner = User(
        tenant_id=tenant.id,
        email=data.owner_email,
        hashed_password=hash_password(data.owner_password),
        full_name=data.owner_full_name,
        role=UserRole.OWNER,
    )
    session.add(owner)
    return tenant, owner
