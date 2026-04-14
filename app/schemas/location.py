from pydantic import BaseModel, ConfigDict
from uuid import UUID


class LocationCreate(BaseModel):
    name: str
    address: str | None = None
    phone: str | None = None
    currency: str = "USD"
    tax_rate: float = 0.0


class LocationUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    currency: str | None = None
    tax_rate: float | None = None
    is_active: bool | None = None


class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    tenant_id: UUID
    name: str
    address: str | None
    phone: str | None
    currency: str
    tax_rate: float
    is_active: bool
