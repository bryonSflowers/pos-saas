"""
Order service — handles creation, totaling, inventory deduction,
promo code application, and loyalty points.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.location import Location
from app.models.customer import Customer, LoyaltyTransaction, LoyaltyTxnType
from app.models.promotion import Promotion, PromoUsage, DiscountType
from app.schemas.order import OrderCreate

# 1 point earned per $1 spent; 100 points = $1 discount
POINTS_PER_DOLLAR = 1
POINTS_DOLLAR_VALUE = Decimal("0.01")  # each point = $0.01


async def _next_receipt_number(session: AsyncSession, tenant_id: uuid.UUID, location_id: uuid.UUID) -> str:
    from sqlalchemy import func
    count = await session.scalar(
        select(func.count(Order.id)).where(Order.tenant_id == tenant_id, Order.location_id == location_id)
    )
    return f"REC-{(count or 0) + 1:06d}"


async def create_order(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    cashier_id: uuid.UUID,
    data: OrderCreate,
) -> Order:
    # Verify location
    location = await session.scalar(
        select(Location).where(Location.id == data.location_id, Location.tenant_id == tenant_id)
    )
    if not location:
        raise ValueError("Location not found")

    # ── Build items ──────────────────────────────────────────────────────────
    items: list[OrderItem] = []
    subtotal = Decimal("0")

    for item_data in data.items:
        product = await session.scalar(
            select(Product).where(Product.id == item_data.product_id, Product.tenant_id == tenant_id)
        )
        if not product or not product.is_active:
            raise ValueError(f"Product {item_data.product_id} not available")
        if product.track_inventory and product.stock_qty < item_data.quantity:
            raise ValueError(f"Insufficient stock for {product.name}")

        discount_mult = (100 - item_data.discount_pct) / 100
        line_total = (product.price * item_data.quantity * discount_mult).quantize(Decimal("0.01"))
        subtotal += line_total

        if product.track_inventory:
            product.stock_qty -= item_data.quantity

        items.append(OrderItem(
            product_id=product.id,
            product_name=product.name,
            unit_price=product.price,
            quantity=item_data.quantity,
            discount_pct=item_data.discount_pct,
            line_total=line_total,
        ))

    # ── Promo code ───────────────────────────────────────────────────────────
    promo_discount = Decimal("0")
    promo_id: uuid.UUID | None = None
    if data.promo_code:
        promo = await session.scalar(
            select(Promotion).where(
                Promotion.tenant_id == tenant_id,
                Promotion.code == data.promo_code.upper(),
                Promotion.is_active == True,
            )
        )
        if promo:
            now = datetime.now(timezone.utc)
            if (not promo.starts_at or now >= promo.starts_at) and \
               (not promo.ends_at or now <= promo.ends_at) and \
               (not promo.max_uses or promo.uses_count < promo.max_uses) and \
               (not promo.min_order_amount or subtotal >= promo.min_order_amount):
                if promo.discount_type == DiscountType.PERCENTAGE:
                    promo_discount = (subtotal * promo.discount_value / 100).quantize(Decimal("0.01"))
                elif promo.discount_type == DiscountType.FIXED:
                    promo_discount = min(promo.discount_value, subtotal)
                promo.uses_count += 1
                promo_id = promo.id

    # ── Loyalty redemption ───────────────────────────────────────────────────
    loyalty_discount = Decimal("0")
    loyalty_points_redeemed = 0
    customer: Customer | None = None

    if data.customer_id:
        customer = await session.scalar(
            select(Customer).where(Customer.id == data.customer_id, Customer.tenant_id == tenant_id)
        )
        if customer and data.loyalty_points_to_redeem > 0:
            redeemable = min(data.loyalty_points_to_redeem, customer.loyalty_points)
            loyalty_discount = (redeemable * POINTS_DOLLAR_VALUE).quantize(Decimal("0.01"))
            loyalty_discount = min(loyalty_discount, subtotal - promo_discount)
            loyalty_points_redeemed = int(loyalty_discount / POINTS_DOLLAR_VALUE)

    # ── Totals ───────────────────────────────────────────────────────────────
    taxable_amount = subtotal - promo_discount - loyalty_discount
    tax_amount = (taxable_amount * Decimal(str(location.tax_rate))).quantize(Decimal("0.01"))
    total = taxable_amount + tax_amount

    # ── Loyalty earned ───────────────────────────────────────────────────────
    loyalty_points_earned = int(float(total) * POINTS_PER_DOLLAR)

    order = Order(
        tenant_id=tenant_id,
        location_id=data.location_id,
        cashier_id=cashier_id,
        customer_id=data.customer_id,
        shift_id=data.shift_id,
        customer_name=data.customer_name or (customer.full_name if customer else None),
        customer_email=data.customer_email or (customer.email if customer else None),
        notes=data.notes,
        status=OrderStatus.OPEN,
        receipt_number=await _next_receipt_number(session, tenant_id, data.location_id),
        subtotal=subtotal,
        discount_amount=Decimal("0"),
        promo_discount=promo_discount,
        loyalty_discount=loyalty_discount,
        tax_amount=tax_amount,
        total=total,
        loyalty_points_earned=loyalty_points_earned,
        loyalty_points_redeemed=loyalty_points_redeemed,
        items=items,
    )
    session.add(order)
    await session.flush()

    # ── Update customer stats and loyalty ────────────────────────────────────
    if customer:
        if loyalty_points_redeemed > 0:
            customer.loyalty_points -= loyalty_points_redeemed
            session.add(LoyaltyTransaction(
                tenant_id=tenant_id,
                customer_id=customer.id,
                order_id=order.id,
                txn_type=LoyaltyTxnType.REDEEM,
                points=-loyalty_points_redeemed,
                note=f"Redeemed on order {order.receipt_number}",
            ))
        if loyalty_points_earned > 0:
            customer.loyalty_points += loyalty_points_earned
            session.add(LoyaltyTransaction(
                tenant_id=tenant_id,
                customer_id=customer.id,
                order_id=order.id,
                txn_type=LoyaltyTxnType.EARN,
                points=loyalty_points_earned,
                note=f"Earned on order {order.receipt_number}",
            ))
        customer.total_spent += total
        customer.visit_count += 1

    # ── Record promo usage ───────────────────────────────────────────────────
    if promo_id and promo_discount > 0:
        session.add(PromoUsage(
            promotion_id=promo_id,
            order_id=order.id,
            customer_id=data.customer_id,
            discount_applied=promo_discount,
        ))

    return order
