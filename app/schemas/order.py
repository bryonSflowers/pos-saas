from pydantic import BaseModel, ConfigDict
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional
from app.models.order import OrderStatus


class OrderItemCreate(BaseModel):
    product_id: UUID
    quantity: int
    discount_pct: Decimal = Decimal("0")


class OrderCreate(BaseModel):
    location_id: UUID
    items: list[OrderItemCreate]
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    notes: Optional[str] = None
    promo_code: Optional[str] = None
    loyalty_points_to_redeem: int = 0
    shift_id: Optional[UUID] = None


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    product_id: UUID
    product_name: str
    unit_price: Decimal
    quantity: int
    discount_pct: Decimal
    line_total: Decimal


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    tenant_id: UUID
    location_id: UUID
    cashier_id: UUID
    customer_id: Optional[UUID]
    receipt_number: str
    status: OrderStatus
    subtotal: Decimal
    discount_amount: Decimal
    promo_discount: Decimal
    loyalty_discount: Decimal
    tax_amount: Decimal
    total: Decimal
    loyalty_points_earned: int
    loyalty_points_redeemed: int
    customer_name: Optional[str]
    customer_email: Optional[str]
    notes: Optional[str]
    items: list[OrderItemOut]
    created_at: datetime
