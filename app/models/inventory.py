import uuid
from enum import Enum as PyEnum
from sqlalchemy import String, ForeignKey, Enum, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.db.base import Base, UUIDMixin, TimestampMixin


class AdjustmentReason(str, PyEnum):
    RECOUNT = "recount"
    DAMAGE = "damage"
    THEFT = "theft"
    RETURN = "return"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    OPENING_STOCK = "opening_stock"
    OTHER = "other"


class InventoryAdjustment(Base, UUIDMixin, TimestampMixin):
    """Immutable log of every stock change (manual or system-triggered)."""
    __tablename__ = "inventory_adjustments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reason: Mapped[AdjustmentReason] = mapped_column(Enum(AdjustmentReason), nullable=False)
    qty_before: Mapped[int] = mapped_column(Integer, nullable=False)
    qty_change: Mapped[int] = mapped_column(Integer, nullable=False)  # positive=add, negative=remove
    qty_after: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # PO id, order id, etc.

    product: Mapped["Product"] = relationship()
    user: Mapped["User"] = relationship()
