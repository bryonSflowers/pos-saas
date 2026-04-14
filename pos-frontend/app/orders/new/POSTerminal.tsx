"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import StripeTerminalPanel from "@/app/components/StripeTerminalPanel";

type Product = {
  id: string; name: string; price: string; stock_qty: number;
  sku: string | null; barcode: string | null; is_active: boolean; category_id: string | null;
};
type Location = { id: string; name: string; currency: string; tax_rate: number };
type Category = { id: string; name: string; color: string | null };
type Customer = { id: string; first_name: string; last_name: string; full_name: string; email: string | null; loyalty_points: number };
type CartItem = { product: Product; quantity: number; discount_pct: number };

type Props = { products: Product[]; locations: Location[]; categories: Category[] };

const PAYMENT_METHODS = [
  { value: "cash", label: "💵 Cash" },
  { value: "card", label: "💳 Card" },
  { value: "qr_code", label: "📱 QR" },
  { value: "voucher", label: "🎫 Voucher" },
];

export default function POSTerminal({ products, locations, categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Customer
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loyaltyToRedeem, setLoyaltyToRedeem] = useState(0);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Promo
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{valid: boolean; name?: string; discount?: number; error?: string} | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Barcode scanner
  const barcodeBuffer = useRef("");
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeLocation = locations.find((l) => l.id === locationId);
  const taxRate = activeLocation?.tax_rate ?? 0;
  const currency = activeLocation?.currency ?? "USD";

  // ── Barcode scanner (keyboard wedge) ────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Enter" && barcodeBuffer.current.length > 3) {
        const barcode = barcodeBuffer.current;
        barcodeBuffer.current = "";
        if (barcodeTimer.current !== null) clearTimeout(barcodeTimer.current);
        const found = products.find(
          (p) => p.barcode === barcode || p.sku === barcode
        );
        if (found) {
          addToCart(found);
        } else {
          setError(`No product found for barcode: ${barcode}`);
          setTimeout(() => setError(null), 3000);
        }
        return;
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        if (barcodeTimer.current !== null) clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ""; }, 80);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [products]);

  // ── Customer search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}`);
      if (res.ok) setCustomerResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // ── Promo validation ─────────────────────────────────────────────────────
  async function validatePromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await fetch("/api/promotions/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim(), order_subtotal: subtotalBeforePromo }),
      });
      const data = await res.json();
      setPromoResult(data.valid
        ? { valid: true, name: data.name, discount: data.calculated_discount }
        : { valid: false, error: data.error }
      );
    } finally {
      setPromoLoading(false);
    }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (product.stock_qty > 0 && existing.quantity >= product.stock_qty) return prev;
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, discount_pct: 0 }];
    });
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.product.id !== productId));
    else setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, quantity: qty } : i));
  }

  function updateDiscount(productId: string, pct: number) {
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, discount_pct: Math.min(100, Math.max(0, pct)) } : i));
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const subtotalBeforePromo = cart.reduce((sum, i) => {
    const disc = 1 - i.discount_pct / 100;
    return sum + parseFloat(i.product.price) * i.quantity * disc;
  }, 0);

  const promoDiscount = promoResult?.valid ? (promoResult.discount ?? 0) : 0;
  const loyaltyDiscount = Math.min(loyaltyToRedeem * 0.01, subtotalBeforePromo - promoDiscount);
  const taxableAmount = subtotalBeforePromo - promoDiscount - loyaltyDiscount;
  const taxAmount = taxableAmount * taxRate;
  const total = taxableAmount + taxAmount;
  const cashGivenNum = parseFloat(cashGiven) || 0;
  const change = cashGivenNum - total;

  const maxRedeemable = selectedCustomer
    ? Math.min(selectedCustomer.loyalty_points, Math.floor((subtotalBeforePromo - promoDiscount) * 100))
    : 0;

  // ── Place order ──────────────────────────────────────────────────────────
  async function handlePlaceOrder() {
    if (cart.length === 0) { setError("Add at least one item."); return; }
    if (!locationId) { setError("Select a location."); return; }
    setError(null);

    startTransition(async () => {
      try {
        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location_id: locationId,
            customer_id: selectedCustomer?.id ?? null,
            customer_name: selectedCustomer?.full_name ?? null,
            customer_email: selectedCustomer?.email ?? null,
            notes: notes || null,
            promo_code: promoResult?.valid ? promoCode.trim() : null,
            loyalty_points_to_redeem: loyaltyToRedeem,
            items: cart.map((i) => ({
              product_id: i.product.id,
              quantity: i.quantity,
              discount_pct: String(i.discount_pct),
            })),
          }),
        });

        if (!orderRes.ok) {
          const data = await orderRes.json();
          setError(data.detail ?? "Failed to place order.");
          return;
        }

        const order = await orderRes.json();

        // Card payments are handled by Stripe Terminal — set pending order and let panel take over
        if (paymentMethod === "card") {
          setPendingOrderId(order.id);
          return;
        }

        await fetch(`/api/payments/${order.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: paymentMethod, amount: total.toFixed(2) }),
        });

        router.push(`/orders/${order.id}`);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  const filtered = products.filter((p) => {
    if (!p.is_active) return false;
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.barcode ?? "").includes(q);
    const matchCat = categoryFilter === "all" || p.category_id === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex gap-4 h-[calc(100vh-4rem)]">
      {/* ── Product Grid ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search */}
        <div className="mb-2 flex gap-2">
          <input
            ref={searchRef}
            type="text"
            placeholder="🔍 Search or scan barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="mb-2 flex gap-1.5 flex-wrap">
            <button onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${categoryFilter === "all" ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setCategoryFilter(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${categoryFilter === c.id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={categoryFilter === c.id ? { backgroundColor: c.color ?? "#1f2937" } : {}}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 content-start">
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400 text-sm">No products found.</div>
          )}
          {filtered.map((p) => {
            const inCart = cart.find((i) => i.product.id === p.id);
            const outOfStock = p.stock_qty === 0;
            return (
              <button key={p.id} onClick={() => addToCart(p)} disabled={outOfStock}
                className={`bg-white rounded-xl shadow-sm p-3 text-left transition-all relative border-2 ${
                  outOfStock ? "opacity-40 cursor-not-allowed border-transparent" :
                  inCart ? "border-black hover:shadow-md" : "border-transparent hover:shadow-md hover:border-gray-200"
                }`}>
                {inCart && (
                  <span className="absolute top-2 right-2 bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {inCart.quantity}
                  </span>
                )}
                <p className="font-medium text-gray-900 text-sm leading-tight mb-1 pr-6">{p.name}</p>
                {p.sku && <p className="text-xs text-gray-400 mb-1">{p.sku}</p>}
                <p className="text-base font-bold text-gray-900">${parseFloat(p.price).toFixed(2)}</p>
                <p className={`text-xs mt-0.5 ${p.stock_qty <= 5 ? "text-orange-500 font-medium" : "text-gray-400"}`}>
                  {outOfStock ? "Out of stock" : `${p.stock_qty} left`}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cart / Checkout ───────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="font-semibold text-gray-900 text-sm">Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items)</h2>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
          )}
        </div>

        {/* Cart items */}
        <div className="overflow-auto p-3 flex flex-col gap-2" style={{ maxHeight: "260px" }}>
          {cart.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Tap a product or scan barcode.</p>}
          {cart.map((item) => (
            <div key={item.product.id} className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex-1 text-xs font-medium text-gray-900 truncate">{item.product.name}</span>
                <span className="text-xs font-bold text-gray-900 shrink-0">
                  ${(parseFloat(item.product.price) * item.quantity * (1 - item.discount_pct / 100)).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateQty(item.product.id, item.quantity - 1)}
                  className="w-5 h-5 rounded bg-gray-200 text-gray-700 text-xs hover:bg-gray-300 flex items-center justify-center">−</button>
                <span className="w-5 text-center text-xs font-medium">{item.quantity}</span>
                <button onClick={() => updateQty(item.product.id, item.quantity + 1)}
                  className="w-5 h-5 rounded bg-gray-200 text-gray-700 text-xs hover:bg-gray-300 flex items-center justify-center">+</button>
                <span className="text-xs text-gray-400 ml-auto">Disc:</span>
                <div className="flex items-center">
                  <input type="number" min="0" max="100" step="1" value={item.discount_pct}
                    onChange={(e) => updateDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                    className="w-10 text-xs text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none" />
                  <span className="text-xs text-gray-400 ml-0.5">%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-100 flex flex-col gap-2.5 overflow-auto flex-1">
          {/* Location */}
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black bg-white">
            {locations.length === 0 && <option value="">No locations</option>}
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          {/* Customer lookup */}
          <div className="relative">
            {selectedCustomer ? (
              <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-2 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-900 truncate">{selectedCustomer.full_name}</p>
                  <p className="text-xs text-blue-600">⭐ {selectedCustomer.loyalty_points} pts</p>
                </div>
                <button onClick={() => { setSelectedCustomer(null); setLoyaltyToRedeem(0); setCustomerSearch(""); }}
                  className="text-blue-400 hover:text-blue-600 text-xs">✕</button>
              </div>
            ) : (
              <div className="relative">
                <input type="text" placeholder="👤 Search customer…" value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerSearch(true); }}
                  onFocus={() => setShowCustomerSearch(true)}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black" />
                {showCustomerSearch && customerResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-auto">
                    {customerResults.map((c) => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setShowCustomerSearch(false); }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        <span className="font-medium">{c.full_name}</span>
                        {c.email && <span className="text-gray-400 ml-1">· {c.email}</span>}
                        <span className="text-blue-500 ml-1">⭐{c.loyalty_points}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Loyalty redemption */}
          {selectedCustomer && selectedCustomer.loyalty_points > 0 && (
            <div className="bg-yellow-50 rounded-lg px-2 py-1.5 flex items-center gap-2">
              <span className="text-xs text-yellow-800 flex-1">Redeem points (${(loyaltyToRedeem * 0.01).toFixed(2)} off)</span>
              <input type="range" min="0" max={maxRedeemable} step="10" value={loyaltyToRedeem}
                onChange={(e) => setLoyaltyToRedeem(parseInt(e.target.value))}
                className="w-20 accent-yellow-500" />
              <span className="text-xs font-bold text-yellow-700 w-8 text-right">{loyaltyToRedeem}</span>
            </div>
          )}

          {/* Promo code */}
          <div className="flex gap-1">
            <input type="text" placeholder="Promo code" value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value); setPromoResult(null); }}
              onKeyDown={(e) => e.key === "Enter" && validatePromo()}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black" />
            <button onClick={validatePromo} disabled={promoLoading || !promoCode.trim()}
              className="px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50">
              Apply
            </button>
          </div>
          {promoResult && (
            <p className={`text-xs px-2 py-1 rounded-lg ${promoResult.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {promoResult.valid ? `✓ ${promoResult.name} — $${promoResult.discount?.toFixed(2)} off` : `✗ ${promoResult.error}`}
            </p>
          )}

          {/* Totals */}
          <div className="flex flex-col gap-0.5 text-xs bg-gray-50 rounded-lg p-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>{currency} {subtotalBeforePromo.toFixed(2)}</span>
            </div>
            {promoDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Promo</span><span>−{currency} {promoDiscount.toFixed(2)}</span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-yellow-600">
                <span>Loyalty</span><span>−{currency} {loyaltyDiscount.toFixed(2)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax ({(taxRate * 100).toFixed(1)}%)</span><span>{currency} {taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200 text-sm">
              <span>Total</span><span>{currency} {total.toFixed(2)}</span>
            </div>
            {selectedCustomer && (
              <div className="flex justify-between text-blue-500 pt-0.5">
                <span>Points earned</span><span>+{Math.floor(total)} pts</span>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-4 gap-1">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value)}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  paymentMethod === m.value ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Cash change */}
          {paymentMethod === "cash" && (
            <div className="flex gap-2">
              <input type="number" placeholder="Cash given" min="0" step="0.01"
                value={cashGiven} onChange={(e) => setCashGiven(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black" />
              {cashGivenNum > 0 && (
                <div className={`flex items-center px-2 rounded-lg text-xs font-bold ${change >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* Quick cash buttons */}
          {paymentMethod === "cash" && total > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {[Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20]
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 4)
                .map((v) => (
                  <button key={v} onClick={() => setCashGiven(String(v))}
                    className="py-1 rounded-lg text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium">
                    ${v}
                  </button>
                ))
              }
            </div>
          )}

          {/* Notes */}
          <input type="text" placeholder="Order notes (optional)" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black" />

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">{error}</p>}

          {/* Stripe Terminal panel — shown when card method selected */}
          {paymentMethod === "card" && (
            <StripeTerminalPanel
              orderId={pendingOrderId}
              orderTotal={total}
              onPaymentSuccess={() => {
                if (pendingOrderId) router.push(`/orders/${pendingOrderId}`);
              }}
            />
          )}

          {/* Place order / charge button — hidden when terminal has a pending order */}
          {!pendingOrderId && (
            <button onClick={handlePlaceOrder} disabled={isPending || cart.length === 0 || !locationId}
              className="w-full rounded-lg bg-black text-white py-3 text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {isPending
                ? "Processing…"
                : paymentMethod === "card"
                  ? `Create Order — Then Charge Card`
                  : `Charge ${currency} ${total.toFixed(2)}`}
            </button>
          )}

          {pendingOrderId && paymentMethod !== "card" && (
            <button onClick={() => router.push(`/orders/${pendingOrderId}`)}
              className="w-full rounded-lg bg-gray-100 text-gray-700 py-2 text-sm font-medium hover:bg-gray-200">
              View Order →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
