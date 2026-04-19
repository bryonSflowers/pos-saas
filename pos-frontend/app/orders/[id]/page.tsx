import AuthLayout from "@/app/components/AuthLayout";
import Link from "next/link";
import { apiFetchAuth } from "@/app/lib/auth";
import OrderActions from "./OrderActions";

type OrderItem = { id: string; product_name: string; quantity: number; unit_price: string; discount_pct: string; line_total: string };
type Order = {
  id: string; receipt_number: string; status: string;
  subtotal: string; discount_amount: string; tax_amount: string; total: string;
  customer_name: string | null; notes: string | null; created_at: string;
  items: OrderItem[];
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
  REFUNDED: "bg-yellow-50 text-yellow-700",
  VOIDED: "bg-gray-100 text-gray-500",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiFetchAuth<Order>(`/api/v1/orders/${id}`).catch(() => null);
  if (!order) return <AuthLayout><div className="p-8 text-gray-500">Order not found.</div></AuthLayout>;

  return (
    <AuthLayout>
      <div className="p-8 max-w-2xl">
        <div className="mb-6">
          <Link href="/orders" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Back to Orders
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-mono">{order.receipt_number}</h1>
              <p className="text-sm text-gray-500 mt-1">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-500"}`}>
              {order.status}
            </span>
          </div>

          {order.customer_name && (
            <div className="mb-4 pb-4 border-b border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Customer</p>
              <p className="text-sm text-gray-900">{order.customer_name}</p>
            </div>
          )}

          <div className="mb-4 pb-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Items</p>
            <div className="flex flex-col gap-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-900 font-medium">{item.product_name}</span>
                    <span className="text-gray-500 ml-2">× {item.quantity}</span>
                    {parseFloat(item.discount_pct) > 0 && (
                      <span className="text-green-600 ml-2">-{item.discount_pct}% off</span>
                    )}
                  </div>
                  <span className="text-gray-900">${parseFloat(item.line_total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-sm mb-6">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>${parseFloat(order.subtotal).toFixed(2)}</span>
            </div>
            {parseFloat(order.discount_amount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>-${parseFloat(order.discount_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Tax</span><span>${parseFloat(order.tax_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100 mt-1">
              <span>Total</span><span>${parseFloat(order.total).toFixed(2)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="mb-6 pb-6 border-b border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Notes</p>
              <p className="text-sm text-gray-700">{order.notes}</p>
            </div>
          )}

          <OrderActions orderId={order.id} status={order.status} />
        </div>
      </div>
    </AuthLayout>
  );
}
