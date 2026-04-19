import uuid
from enum import Enum as PyEnum
from decimal import Decimal
from sqlalchemy import String, ForeignKey, Enum, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.db.base import Base, UUIDMixin, TimestampMixin


class PaymentMethod(str, PyEnum):
    CASH = "CASH"
    CARD = "CARD"
    QR_CODE = "QR_CODE"
    VOUCHER = "VOUCHER"
    SPLIT = "SPLIT"


class PaymentStatus(str, PyEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class Payment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # For card/QR payments
    provider_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(200), nullable=True)

    order: Mapped["Order"] = relationship(back_populates="payments")
