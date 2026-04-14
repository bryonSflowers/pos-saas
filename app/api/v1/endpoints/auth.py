from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from app.core.deps import SessionDep
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.schemas.tenant import TokenResponse
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: str


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: SessionDep):
    from app.models.tenant import Tenant
    tenant = await session.scalar(select(Tenant).where(Tenant.slug == body.tenant_slug, Tenant.is_active == True))
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    user = await session.scalar(
        select(User).where(User.email == body.email, User.tenant_id == tenant.id, User.is_active == True)
    )
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(subject=user.id, tenant_id=str(tenant.id), role=user.role)
    return TokenResponse(access_token=token)
