from pydantic import BaseModel, ConfigDict
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from app.models.payment import PaymentMethod, PaymentStatus


class PaymentCreate(BaseModel):
    method: PaymentMethod
    amount: Decimal
    provider_ref: str | None = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    order_id: UUID
    method: PaymentMethod
    status: PaymentStatus
    amount: Decimal
    provider_ref: str | None
    created_at: datetime
