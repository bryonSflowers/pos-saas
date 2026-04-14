"use client";

import { useState } from "react";

type Product = {
  id: string; name: string; sku: string | null; barcode: string | null;
  stock_qty: number; low_stock_threshold: number | null; price: number;
  category_name?: string;
};

type Adjustment = {
  id: string; product_id: string; product_name?: string;
  reason: string; qty_before: number; qty_change: number; qty_after: number;
  note: string | null; created_at: string; user_name?: string;
};

const REASONS = [
  { value: "recount", label: "Stock Recount" },
  { value: "damage", label: "Damage / Spoilage" },
  { value: "theft", label: "Theft / Shrinkage" },
  { value: "return", label: "Customer Return" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "opening_stock", label: "Opening Stock" },
  { value: "other", label: "Other" },
];

export default function InventoryClient({
  initialProducts, initialAdjustments,
}: { initialProducts: Product[]; initialAdjustments: Adjustment[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [adjustments, setAdjustments] = useState<Adjustment[]>(initialAdjustments);
  const [tab, setTab] = useState<"stock" | "history">("stock");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ reason: "recount", qty_change: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterProductId, setFilterProductId] = useState("");

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.barcode ?? "").includes(q);
  });

  const filteredAdjustments = filterProductId
    ? adjustments.filter((a) => a.product_id === filterProductId)
    : adjustments;

  const lowStock = products.filter((p) => p.low_stock_threshold != null && p.stock_qty <= p.low_stock_threshold);

  function openAdjust(p: Product) {
    setSelectedProduct(p);
    setForm({ reason: "recount", qty_change: "", note: "" });
    setError("");
    setShowModal(true);
  }

  async function handleAdjust() {
    if (!selectedProduct) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/inventory-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          reason: form.reason,
          qty_change: parseInt(form.qty_change) || 0,
          note: form.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Failed"); return; }
      setAdjustments((prev) => [data, ...prev]);
      setProducts((prev) => prev.map((p) =>
        p.id === selectedProduct.id ? { ...p, stock_qty: data.qty_after } : p
      ));
      setShowModal(false);
    } finally { setLoading(false); }
  }

  function qtyChangeClass(n: number) {
    if (n > 0) return "text-green-600";
    if (n < 0) return "text-red-600";
    return "text-gray-500";
  }

  function stockBadge(p: Product) {
    const isLow = p.low_stock_threshold != null && p.stock_qty <= p.low_stock_threshold;
    if (p.stock_qty === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Out of stock</span>;
    if (isLow) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">Low stock</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">In stock</span>;
  }

  return (
    <>
      {lowStock.length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-orange-500 text-lg mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-medium text-orange-800">{lowStock.length} item{lowStock.length !== 1 ? "s" : ""} low on stock</p>
            <p className="text-xs text-orange-600 mt-0.5">{lowStock.map((p) => p.name).join(", ")}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("stock")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "stock" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          Stock Levels
        </button>
        <button onClick={() => setTab("history")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "history" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          Adjustment History
        </button>
      </div>

      {tab === "stock" && (
        <>
          <div className="mb-3">
            <input type="text" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">SKU / Barcode</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Low Alert</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No products found.</td></tr>
                )}
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                      {p.sku && <div>SKU: {p.sku}</div>}
                      {p.barcode && <div>BC: {p.barcode}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{p.stock_qty}</td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {p.low_stock_threshold != null ? p.low_stock_threshold : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">{stockBadge(p)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openAdjust(p)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium">Adjust</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "history" && (
        <>
          <div className="mb-3 flex gap-3">
            <select value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-right">Before</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3 text-right">After</th>
                  <th className="px-4 py-3 text-left">Note</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAdjustments.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No adjustments yet.</td></tr>
                )}
                {filteredAdjustments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {a.product_name ?? products.find((p) => p.id === a.product_id)?.name ?? a.product_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{REASONS.find((r) => r.value === a.reason)?.label ?? a.reason}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{a.qty_before}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${qtyChangeClass(a.qty_change)}`}>
                      {a.qty_change > 0 ? "+" : ""}{a.qty_change}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{a.qty_after}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{a.note ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-1">Adjust Stock</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedProduct.name} — Current: <strong>{selectedProduct.stock_qty}</strong> units</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Reason</label>
                <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Quantity Change (+ add / − remove)</label>
                <input type="number" value={form.qty_change} onChange={(e) => setForm({ ...form, qty_change: e.target.value })}
                  placeholder="e.g. -5 or +20"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                {form.qty_change && (
                  <p className="text-xs text-gray-400 mt-1">
                    New quantity: <strong className="text-gray-900">{selectedProduct.stock_qty + (parseInt(form.qty_change) || 0)}</strong>
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Note</label>
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Optional note"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={handleAdjust} disabled={loading || !form.qty_change || parseInt(form.qty_change) === 0}
                className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {loading ? "Saving…" : "Apply Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
