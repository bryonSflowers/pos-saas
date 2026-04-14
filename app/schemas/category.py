from pydantic import BaseModel, ConfigDict
from uuid import UUID


class CategoryCreate(BaseModel):
    name: str
    color: str | None = None  # hex e.g. "#FF5733"


class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    tenant_id: UUID
    name: str
    color: str | None
