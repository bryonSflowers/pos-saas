import AuthLayout from "@/app/components/AuthLayout";
import Link from "next/link";
import { apiFetchAuth } from "@/app/lib/auth";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
};

type Order = {
  id: string;
  receipt_number: string;
  status: string;
  total: string;
  customer_name: string | null;
  created_at: string;
  items: OrderItem[];
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  paid: "bg-green-50 text-green-700",
  refunded: "bg-yellow-50 text-yellow-700",
  voided: "bg-gray-100 text-gray-500",
};

export default async function OrdersPage() {
  const orders = await apiFetchAuth<Order[]>("/api/v1/orders/").catch(() => [] as Order[]);

  return (
    <AuthLayout>
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">{orders.length} orders</p>
          </div>
          <Link
            href="/orders/new"
            className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            + New Sale
          </Link>
        </div>

        <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Receipt
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Customer
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Items
                </th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Date
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No orders yet.{" "}
                    <Link href="/orders/new" className="text-black underline">
                      Create your first sale
                    </Link>
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-gray-900">{o.receipt_number}</td>
                  <td className="px-5 py-3 text-gray-700">{o.customer_name ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-500">{o.items.length} item(s)</td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    ${parseFloat(o.total).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/orders/${o.id}`}
                      className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthLayout>
  );
}
