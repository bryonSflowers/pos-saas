import uuid
from decimal import Decimal
from enum import Enum as PyEnum
from datetime import datetime
from sqlalchemy import String, ForeignKey, Enum, Numeric, Integer, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.db.base import Base, UUIDMixin, TimestampMixin


class DiscountType(str, PyEnum):
    PERCENTAGE = "PERCENTAGE"   # e.g. 10% off
    FIXED = "FIXED"             # e.g. $5 off
    BOGO = "BOGO"               # buy one get one


class PromoScope(str, PyEnum):
    ORDER = "ORDER"             # applies to entire order
    PRODUCT = "PRODUCT"         # applies to specific product(s)
    CATEGORY = "CATEGORY"       # applies to a category


class Promotion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "promotions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)  # None = auto-apply
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_type: Mapped[DiscountType] = mapped_column(Enum(DiscountType), nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    scope: Mapped[PromoScope] = mapped_column(Enum(PromoScope), default=PromoScope.ORDER)
    # Optional scope targets (JSON-encoded list of UUIDs)
    scope_target_ids: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_order_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = unlimited
    uses_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_uses_per_customer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    usages: Mapped[list["PromoUsage"]] = relationship(
        back_populates="promotion", cascade="all, delete-orphan"
    )


class PromoUsage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "promo_usages"

    promotion_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("promotions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    discount_applied: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    promotion: Mapped["Promotion"] = relationship(back_populates="usages")
