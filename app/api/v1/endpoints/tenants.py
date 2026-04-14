from fastapi import APIRouter
from app.core.deps import SessionDep
from app.schemas.tenant import TenantCreate, TenantOut
from app.services.tenant import create_tenant

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("/register", response_model=TenantOut, status_code=201)
async def register_tenant(body: TenantCreate, session: SessionDep):
    tenant, _ = await create_tenant(session, body)
    return tenant
