import uuid
from decimal import Decimal
from enum import Enum as PyEnum
from datetime import datetime
from sqlalchemy import String, ForeignKey, Enum, Numeric, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.db.base import Base, UUIDMixin, TimestampMixin


class ShiftStatus(str, PyEnum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class Shift(Base, UUIDMixin, TimestampMixin):
    """Cash drawer shift — opened/closed by cashier at start/end of day."""
    __tablename__ = "shifts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False, index=True
    )
    cashier_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[ShiftStatus] = mapped_column(Enum(ShiftStatus), default=ShiftStatus.OPEN, index=True)
    opening_float: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    closing_cash: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    expected_cash: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    cash_variance: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cashier: Mapped["User"] = relationship()
    location: Mapped["Location"] = relationship()
