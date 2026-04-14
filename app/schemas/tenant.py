from pydantic import BaseModel, ConfigDict, EmailStr
from uuid import UUID
from app.models.tenant import TenantPlan


class TenantCreate(BaseModel):
    name: str
    slug: str
    owner_email: EmailStr
    owner_password: str
    owner_full_name: str


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    slug: str
    plan: TenantPlan
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
