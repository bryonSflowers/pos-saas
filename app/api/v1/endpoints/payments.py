import asyncio
import stripe
from uuid import UUID
from fastapi import APIRouter, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.core.deps import SessionDep, UserDep
from app.core.config import settings
from app.models.order import Order, OrderStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.schemas.payment import PaymentCreate, PaymentOut

router = APIRouter(prefix="/payments", tags=["payments"])


# ── Stripe Terminal endpoints ─────────────────────────────────────────────────

def _stripe_client():
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured. Add STRIPE_SECRET_KEY.")
    stripe.api_key = settings.stripe_secret_key
    return stripe


@router.get("/stripe/config")
async def stripe_config(user: UserDep):
    """Return publishable key for the frontend Terminal SDK."""
    if not settings.stripe_publishable_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    return {"publishable_key": settings.stripe_publishable_key}


@router.post("/stripe/connection-token")
async def create_connection_token(user: UserDep):
    """Stripe Terminal requires a short-lived connection token to authenticate the SDK."""
    s = _stripe_client()
    token = s.terminal.ConnectionToken.create()
    return {"secret": token.secret}


@router.post("/stripe/intent/{order_id}")
async def create_payment_intent(order_id: UUID, session: SessionDep, user: UserDep):
    """Create a Stripe PaymentIntent for the order total. Returns client_secret for Terminal."""
    order = await session.scalar(
        select(Order).where(Order.id == order_id, Order.tenant_id == user.tenant_id)
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == OrderStatus.PAID:
        raise HTTPException(status_code=400, detail="Order already paid")
    if order.status == OrderStatus.VOIDED:
        raise HTTPException(status_code=400, detail="Order is voided")

    s = _stripe_client()
    amount_cents = int(order.total * 100)  # Stripe uses smallest currency unit
    intent = s.PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        payment_method_types=["card_present"],
        capture_method="manual",  # Terminal requires manual capture
        metadata={
            "order_id": str(order.id),
            "receipt_number": order.receipt_number,
            "tenant_id": str(user.tenant_id),
        },
    )
    return {
        "payment_intent_id": intent.id,
        "client_secret": intent.client_secret,
        "amount": float(order.total),
    }


class CaptureBody(BaseModel):
    order_id: UUID
    payment_intent_id: str


@router.post("/stripe/capture")
async def capture_payment_intent(
    body: CaptureBody,
    session: SessionDep,
    user: UserDep,
    background_tasks: BackgroundTasks,
):
    """Capture the PaymentIntent after Terminal collects the card, then record the payment."""
    order = await session.scalar(
        select(Order)
        .options(selectinload(Order.payments), selectinload(Order.items))
        .where(Order.id == body.order_id, Order.tenant_id == user.tenant_id)
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    s = _stripe_client()
    try:
        intent = s.PaymentIntent.capture(body.payment_intent_id)
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if intent.status not in ("succeeded", "requires_capture"):
        raise HTTPException(status_code=400, detail=f"Payment not successful: {intent.status}")

    # Record in our system
    payment = Payment(
        tenant_id=user.tenant_id,
        order_id=order.id,
        method=PaymentMethod.CARD,
        amount=order.total,
        status=PaymentStatus.COMPLETED,
        provider_ref=intent.id,
        stripe_payment_intent_id=intent.id,
    )
    session.add(payment)
    order.status = OrderStatus.PAID
    await session.flush()

    if order.customer_email:
        background_tasks.add_task(
            _send_receipt_email,
            email=order.customer_email,
            receipt_number=order.receipt_number,
            total=float(order.total),
            items=[{"name": i.product_name, "qty": i.quantity, "line_total": float(i.line_total)} for i in order.items],
            customer_name=order.customer_name,
        )

    return {"status": "paid", "payment_intent_id": intent.id}


async def _send_receipt_email(
    email: str,
    receipt_number: str,
    total: float,
    items: list,
    customer_name: str | None,
):
    """Fire-and-forget email receipt. Uses SMTP if configured, otherwise logs."""
    import os
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    from_email = os.environ.get("SMTP_FROM", smtp_user or "noreply@pos-saas.app")

    if not smtp_host or not smtp_user:
        print(f"[receipt] SMTP not configured — would send to {email}: {receipt_number} ${total:.2f}")
        return

    items_html = "".join(
        f"<tr><td>{i['name']}</td><td style='text-align:center'>{i['qty']}</td>"
        f"<td style='text-align:right'>${i['line_total']:.2f}</td></tr>"
        for i in items
    )

    html = f"""
    <html><body style="font-family:sans-serif;max-width:480px;margin:auto">
    <h2 style="color:#111">Receipt {receipt_number}</h2>
    {"<p>Hi " + customer_name + ",</p>" if customer_name else ""}
    <p>Thank you for your purchase!</p>
    <table width="100%" cellpadding="6" style="border-collapse:collapse">
      <thead>
        <tr style="background:#f3f4f6">
          <th align="left">Item</th><th>Qty</th><th align="right">Total</th>
        </tr>
      </thead>
      <tbody>{items_html}</tbody>
      <tfoot>
        <tr><td colspan="2"><strong>Total</strong></td>
        <td align="right"><strong>${total:.2f}</strong></td></tr>
      </tfoot>
    </table>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">
      This is your digital receipt. No action required.
    </p>
    </body></html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your receipt — {receipt_number}"
    msg["From"] = from_email
    msg["To"] = email
    msg.attach(MIMEText(html, "html"))

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _smtp_send, smtp_host, smtp_port, smtp_user, smtp_pass, from_email, email, msg)
    except Exception as exc:
        print(f"[receipt] Failed to send to {email}: {exc}")


def _smtp_send(host, port, user, password, from_addr, to_addr, msg):
    with smtplib.SMTP(host, port) as s:
        s.starttls()
        s.login(user, password)
        s.sendmail(from_addr, to_addr, msg.as_string())


@router.post("/orders/{order_id}", response_model=PaymentOut, status_code=201)
async def record_payment(
    order_id: UUID,
    body: PaymentCreate,
    session: SessionDep,
    user: UserDep,
    background_tasks: BackgroundTasks,
):
    """Record a payment for an order and mark it as paid."""
    order = await session.scalar(
        select(Order)
        .options(selectinload(Order.payments), selectinload(Order.items))
        .where(Order.id == order_id, Order.tenant_id == user.tenant_id)
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == OrderStatus.VOIDED:
        raise HTTPException(status_code=400, detail="Cannot pay a voided order")
    if order.status == OrderStatus.PAID:
        raise HTTPException(status_code=400, detail="Order is already paid")

    payment = Payment(
        tenant_id=user.tenant_id,
        order_id=order.id,
        method=body.method,
        amount=body.amount,
        status=PaymentStatus.COMPLETED,
        provider_ref=body.provider_ref,
    )
    session.add(payment)
    order.status = OrderStatus.PAID
    await session.flush()

    # Send email receipt in background
    if order.customer_email:
        background_tasks.add_task(
            _send_receipt_email,
            email=order.customer_email,
            receipt_number=order.receipt_number,
            total=float(order.total),
            items=[
                {"name": i.product_name, "qty": i.quantity, "line_total": float(i.line_total)}
                for i in order.items
            ],
            customer_name=order.customer_name,
        )

    return payment


@router.get("/orders/{order_id}", response_model=list[PaymentOut])
async def list_order_payments(order_id: UUID, session: SessionDep, user: UserDep):
    order = await session.scalar(
        select(Order).where(Order.id == order_id, Order.tenant_id == user.tenant_id)
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    rows = await session.scalars(select(Payment).where(Payment.order_id == order_id))
    return rows.all()
