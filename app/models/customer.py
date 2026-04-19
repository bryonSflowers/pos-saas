import uuid
from decimal import Decimal
from enum import Enum as PyEnum
from sqlalchemy import String, ForeignKey, Enum, Integer, Numeric, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.db.base import Base, UUIDMixin, TimestampMixin


class Customer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "customers"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    loyalty_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_spent: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    visit_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    loyalty_transactions: Mapped[list["LoyaltyTransaction"]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class LoyaltyTxnType(str, PyEnum):
    EARN = "EARN"
    REDEEM = "REDEEM"
    ADJUST = "ADJUST"
    EXPIRE = "EXPIRE"


class LoyaltyTransaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "loyalty_transactions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    txn_type: Mapped[LoyaltyTxnType] = mapped_column(Enum(LoyaltyTxnType), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)  # positive=earn, negative=redeem
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="loyalty_transactions")
