"""
Example test — run with: uv run pytest
"""
import pytest
from decimal import Decimal
from uuid import uuid4


@pytest.mark.asyncio
async def test_order_total_calculation():
    """Unit test for line total math — no DB needed."""
    price = Decimal("10.00")
    qty = 3
    discount_pct = Decimal("10")  # 10%
    discount_mult = (100 - discount_pct) / 100
    line_total = (price * qty * discount_mult).quantize(Decimal("0.01"))
    assert line_total == Decimal("27.00")
