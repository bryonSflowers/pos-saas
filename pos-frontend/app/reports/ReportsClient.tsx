"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type SalesSummary = { date: string; order_count: number; revenue: string; tax: string; refunds: number };
type InventoryItem = { id: string; name: string; sku: string | null; stock_qty: number; price: string; is_active: boolean; low_stock_threshold: number | null };
type TopProduct = { product_name: string; quantity_sold: number; revenue: string };

const PRESETS = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default function ReportsClient({
  initialSales, inventory, initialTopProducts,
}: { initialSales: SalesSummary[]; inventory: InventoryItem[]; initialTopProducts: TopProduct[] }) {
  const [sales, setSales] = useState<SalesSummary[]>(initialSales);
  const [topProducts, setTopProducts] = useState<TopProduct[]>(initialTopProducts);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<"low" | "all">("low");

  async function loadData(d: number) {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        fetch(`/api/reports/sales?days=${d}`).then((r) => r.json()),
        fetch(`/api/reports/top-products?days=${d}`).then((r) => r.json()),
      ]);
      setSales(Array.isArray(s) ? s : []);
      setTopProducts(Array.isArray(t) ? t : []);
    } finally { setLoading(false); }
  }

  function selectPreset(d: number) {
    setDays(d);
    loadData(d);
  }

  const totalRevenue = useMemo(() => sales.reduce((s, d) => s + parseFloat(d.revenue), 0), [sales]);
  const totalOrders = useMemo(() => sales.reduce((s, d) => s + d.order_count, 0), [sales]);
  const totalTax = useMemo(() => sales.reduce((s, d) => s + parseFloat(d.tax), 0), [sales]);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const lowStock = inventory.filter((p) => p.is_active && p.low_stock_threshold != null && p.stock_qty <= p.low_stock_threshold);
  const outOfStock = inventory.filter((p) => p.is_active && p.stock_qty === 0);
  const displayedInventory = inventoryTab === "low" ? lowStock : inventory.filter((p) => p.is_active);

  // Simple sparkline bar chart using divs
  const maxRevenue = Math.max(...sales.map((d) => parseFloat(d.revenue)), 1);
  const chartDays = [...sales].reverse().slice(-14); // show last 14 days

  return (
    <>
      {/* Date range selector */}
      <div className="mb-6 flex items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.days} onClick={() => selectPreset(p.days)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${days === p.days ? "bg-black text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
            {p.label}
          </button>
        ))}
        {loading && <span className="text-xs text-gray-400 ml-2">Loading…</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Revenue", value: `$${totalRevenue.toFixed(2)}`, sub: `${days}-day period` },
          { label: "Orders", value: String(totalOrders), sub: `Avg $${avgOrderValue.toFixed(2)}/order` },
          { label: "Tax Collected", value: `$${totalTax.toFixed(2)}`, sub: "Before remittance" },
          { label: "Low Stock", value: String(lowStock.length), sub: `${outOfStock.length} out of stock` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue sparkline */}
      {chartDays.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Daily Revenue (last {chartDays.length} days)</h2>
          <div className="flex items-end gap-1 h-24">
            {chartDays.map((d) => {
              const pct = (parseFloat(d.revenue) / maxRevenue) * 100;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                    {d.date}: ${parseFloat(d.revenue).toFixed(2)}
                  </div>
                  <div
                    style={{ height: `${Math.max(pct, 2)}%` }}
                    className="w-full bg-blue-500 rounded-sm hover:bg-blue-600 transition-colors"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>{chartDays[0]?.date}</span>
            <span>{chartDays[chartDays.length - 1]?.date}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily sales table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Daily Sales</h2>
            <span className="text-xs text-gray-400">{days} days</span>
          </div>
          {sales.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No sales in this period.</div>
          ) : (
            <div className="overflow-y-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Orders</th>
                    <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                    <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...sales].reverse().map((d) => (
                    <tr key={d.date} className="hover:bg-gray-50">
                      <td className="px-5 py-2 text-gray-700 font-mono text-xs">{d.date}</td>
                      <td className="px-5 py-2 text-right text-gray-600">{d.order_count}</td>
                      <td className="px-5 py-2 text-right font-medium text-gray-900">${parseFloat(d.revenue).toFixed(2)}</td>
                      <td className="px-5 py-2 text-right text-gray-400">${parseFloat(d.tax).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Top Products</h2>
            <span className="text-xs text-gray-400">{days} days</span>
          </div>
          {topProducts.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No sales in this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                  <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topProducts.slice(0, 10).map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-2 text-gray-300 text-xs font-mono">{i + 1}</td>
                    <td className="px-5 py-2 text-gray-900">{p.product_name}</td>
                    <td className="px-5 py-2 text-right text-gray-600">{p.quantity_sold}</td>
                    <td className="px-5 py-2 text-right font-medium text-gray-900">${parseFloat(p.revenue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Inventory section */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Inventory Status</h2>
          <div className="flex gap-1">
            <button onClick={() => setInventoryTab("low")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${inventoryTab === "low" ? "bg-orange-50 text-orange-700" : "text-gray-500 hover:text-gray-700"}`}>
              Low Stock ({lowStock.length})
            </button>
            <button onClick={() => setInventoryTab("all")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${inventoryTab === "all" ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:text-gray-700"}`}>
              All Active
            </button>
          </div>
          <Link href="/inventory" className="text-sm text-gray-500 hover:text-gray-900">Manage →</Link>
        </div>
        {displayedInventory.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            {inventoryTab === "low" ? "No low stock items." : "No active products."}
          </div>
        ) : (
          <div className="overflow-y-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase">SKU</th>
                  <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Stock</th>
                  <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Threshold</th>
                  <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayedInventory.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2 font-medium text-gray-900">{p.name}</td>
                    <td className="px-5 py-2 text-gray-500 font-mono text-xs">{p.sku ?? "—"}</td>
                    <td className="px-5 py-2 text-right">
                      <span className={`font-bold ${p.stock_qty === 0 ? "text-red-600" : p.low_stock_threshold != null && p.stock_qty <= p.low_stock_threshold ? "text-orange-500" : "text-gray-900"}`}>
                        {p.stock_qty}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right text-gray-400">{p.low_stock_threshold ?? "—"}</td>
                    <td className="px-5 py-2 text-right text-gray-900">${parseFloat(p.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
