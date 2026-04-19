import AuthLayout from "@/app/components/AuthLayout";
import Link from "next/link";
import { apiFetchAuth } from "@/app/lib/auth";

type Product = { id: string; stock_qty: number; is_active: boolean; low_stock_threshold: number | null };
type Order = {
  id: string; total: string; status: string; receipt_number: string;
  customer_name: string | null; created_at: string;
  items: { product_name: string; quantity: number }[];
};
type Customer = { id: string; is_active: boolean };
type Shift = { id: string; status: string; opening_float: number; location_id: string; opened_at: string };

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function QuickLink({ href, icon, label, sub }: { href: string; icon: string; label: string; sub?: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-3 bg-white rounded-xl shadow-sm px-5 py-4 hover:bg-gray-50 transition-colors group">
      <span className="text-2xl w-8 text-center">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-gray-900 group-hover:text-black">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      <span className="ml-auto text-gray-300 group-hover:text-gray-500">→</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const [products, orders, customers, shifts] = await Promise.all([
    apiFetchAuth<Product[]>("/api/v1/products/").catch(() => [] as Product[]),
    apiFetchAuth<Order[]>("/api/v1/orders/").catch(() => [] as Order[]),
    apiFetchAuth<Customer[]>("/api/v1/customers/?active_only=false").catch(() => [] as Customer[]),
    apiFetchAuth<Shift[]>("/api/v1/shifts/").catch(() => [] as Shift[]),
  ]);

  const today = new Date().toDateString();
  const todayOrders = orders.filter((o) => new Date(o.created_at).toDateString() === today);
  const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total), 0);

  const activeProducts = products.filter((p) => p.is_active).length;
  const lowStock = products.filter((p) => p.is_active && p.low_stock_threshold != null && p.stock_qty <= p.low_stock_threshold).length;
  const outOfStock = products.filter((p) => p.is_active && p.stock_qty === 0).length;

  const activeCustomers = Array.isArray(customers) ? customers.filter((c) => c.is_active).length : 0;
  const openShift = Array.isArray(shifts) ? shifts.find((s) => s.status === "OPEN") : null;

  // Last 7 days revenue
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekOrders = orders.filter((o) => new Date(o.created_at) >= sevenDaysAgo);
  const weekRevenue = weekOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);

  const recent = orders.slice(0, 8);

  return (
    <AuthLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          {openShift ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-green-800">Shift open</span>
            </div>
          ) : (
            <Link href="/shifts"
              className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 hover:bg-orange-100 transition-colors">
              <span className="text-sm font-medium text-orange-700">No open shift — Start one</span>
            </Link>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Today's Revenue" value={`$${todayRevenue.toFixed(2)}`} sub={`${todayOrders.length} order(s) today`} />
          <StatCard label="This Week" value={`$${weekRevenue.toFixed(2)}`} sub={`${weekOrders.length} orders`} />
          <StatCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} sub={`${orders.length} orders all time`} />
          <StatCard label="Customers" value={String(activeCustomers)} sub="Active accounts" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active Products" value={String(activeProducts)} sub={lowStock > 0 ? `${lowStock} low stock` : "All good"} />
          {outOfStock > 0 && <StatCard label="Out of Stock" value={String(outOfStock)} sub="Needs restocking" accent="text-red-600" />}
          <StatCard label="Total Orders" value={String(orders.length)} sub="Since launch" />
        </div>

        {/* Alerts */}
        {(outOfStock > 0 || lowStock > 0) && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-orange-500 text-lg">⚠</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800">
                {outOfStock > 0 ? `${outOfStock} out-of-stock` : ""}{outOfStock > 0 && lowStock > 0 ? ", " : ""}{lowStock > 0 ? `${lowStock} low-stock` : ""} product{outOfStock + lowStock !== 1 ? "s" : ""}
              </p>
            </div>
            <Link href="/inventory" className="text-xs font-medium text-orange-700 hover:text-orange-900">View Inventory →</Link>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <QuickLink href="/orders/new" icon="＋" label="New Sale" sub="Open POS terminal" />
          <QuickLink href="/customers" icon="◉" label="Customers" sub={`${activeCustomers} active`} />
          <QuickLink href="/promotions" icon="✦" label="Promotions" sub="Discounts & codes" />
          <QuickLink href="/shifts" icon="⊡" label="Cash Shifts" sub={openShift ? "Shift is open" : "No shift open"} />
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <Link href="/orders" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              No orders yet.{" "}
              <Link href="/orders/new" className="text-black underline">Make your first sale</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {recent.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{o.receipt_number}</td>
                    <td className="px-5 py-3 text-gray-600">{o.customer_name ?? <span className="text-gray-300">Walk-in</span>}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{o.items.length} item(s)</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">${parseFloat(o.total).toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/orders/${o.id}`} className="text-gray-300 hover:text-gray-700 transition-colors">→</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
