from pydantic import BaseModel, ConfigDict
from uuid import UUID
from decimal import Decimal
from datetime import datetime


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    sku: str | None = None
    barcode: str | None = None
    price: Decimal
    cost: Decimal | None = None
    stock_qty: int = 0
    track_inventory: bool = True
    category_id: UUID | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sku: str | None = None
    price: Decimal | None = None
    cost: Decimal | None = None
    stock_qty: int | None = None
    track_inventory: bool | None = None
    is_active: bool | None = None
    category_id: UUID | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    tenant_id: UUID
    name: str
    description: str | None
    sku: str | None
    barcode: str | None
    price: Decimal
    cost: Decimal | None
    stock_qty: int
    track_inventory: bool
    is_active: bool
    category_id: UUID | None
    created_at: datetime
