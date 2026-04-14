"use client";

import { useState } from "react";

type Promotion = {
  id: string; name: string; code: string | null;
  discount_type: "percentage" | "fixed" | "bogo";
  discount_value: number; scope: string;
  min_order_amount: number | null; max_uses: number | null;
  uses_count: number; is_active: boolean;
  starts_at: string | null; ends_at: string | null;
};

type FormState = {
  name: string; code: string; discount_type: "percentage" | "fixed" | "bogo";
  discount_value: string; scope: string; min_order_amount: string; max_uses: string;
  starts_at: string; ends_at: string;
};

const empty: FormState = {
  name: "", code: "", discount_type: "percentage",
  discount_value: "", scope: "order", min_order_amount: "", max_uses: "",
  starts_at: "", ends_at: "",
};

export default function PromotionsClient({ initialPromotions }: { initialPromotions: Promotion[] }) {
  const [promotions, setPromotions] = useState<Promotion[]>(initialPromotions);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openCreate() { setEditing(null); setForm(empty); setError(""); setShowModal(true); }
  function openEdit(p: Promotion) {
    setEditing(p);
    setForm({
      name: p.name, code: p.code ?? "",
      discount_type: p.discount_type, discount_value: String(p.discount_value),
      scope: p.scope, min_order_amount: p.min_order_amount != null ? String(p.min_order_amount) : "",
      max_uses: p.max_uses != null ? String(p.max_uses) : "",
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : "",
      ends_at: p.ends_at ? p.ends_at.slice(0, 16) : "",
    });
    setError(""); setShowModal(true);
  }

  async function handleSave() {
    setLoading(true); setError("");
    try {
      const payload = {
        name: form.name, code: form.code || null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
        scope: form.scope,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      };
      const url = editing ? `/api/promotions/${editing.id}` : "/api/promotions";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); setError(d.detail ?? "Failed"); return; }
      const updated = await res.json();
      if (editing) setPromotions((prev) => prev.map((p) => p.id === editing.id ? updated : p));
      else setPromotions((prev) => [updated, ...prev]);
      setShowModal(false);
    } finally { setLoading(false); }
  }

  async function handleToggle(p: Promotion) {
    const res = await fetch(`/api/promotions/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPromotions((prev) => prev.map((x) => x.id === p.id ? updated : x));
    }
  }

  function discountLabel(p: Promotion) {
    if (p.discount_type === "percentage") return `${p.discount_value}% off`;
    if (p.discount_type === "fixed") return `$${p.discount_value.toFixed(2)} off`;
    return "BOGO";
  }

  function fmtDate(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleDateString();
  }

  const active = promotions.filter((p) => p.is_active);
  const inactive = promotions.filter((p) => !p.is_active);

  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2 text-sm text-gray-500">
          <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">{active.length} active</span>
          <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{inactive.length} inactive</span>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 font-medium">
          + New Promotion
        </button>
      </div>

      <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Discount</th>
              <th className="px-4 py-3 text-left">Scope</th>
              <th className="px-4 py-3 text-right">Min Order</th>
              <th className="px-4 py-3 text-center">Uses</th>
              <th className="px-4 py-3 text-left">Expires</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {promotions.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No promotions yet.</td></tr>
            )}
            {promotions.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3">
                  {p.code ? (
                    <code className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">{p.code}</code>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Auto-apply</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                    {discountLabel(p)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize">{p.scope}</td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {p.min_order_amount != null ? `$${Number(p.min_order_amount).toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3 text-center text-gray-500">
                  {p.uses_count}{p.max_uses != null ? ` / ${p.max_uses}` : ""}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(p.ends_at)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(p)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                    <button onClick={() => handleToggle(p)}
                      className={`text-xs font-medium ${p.is_active ? "text-red-500 hover:text-red-600" : "text-green-600 hover:text-green-700"}`}>
                      {p.is_active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Promotion" : "New Promotion"}</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Summer Sale"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Promo Code <span className="text-gray-400 font-normal">(leave blank for auto-apply)</span>
                </label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SAVE20"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Discount Type *</label>
                  <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as typeof form.discount_type })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                    <option value="bogo">Buy One Get One</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    {form.discount_type === "percentage" ? "Discount %" : form.discount_type === "fixed" ? "Discount $" : "Value"}
                  </label>
                  <input type="number" min="0" step="0.01" value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    disabled={form.discount_type === "bogo"}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Min Order Amount ($)</label>
                  <input type="number" min="0" step="0.01" value={form.min_order_amount}
                    onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                    placeholder="No minimum"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Max Uses</label>
                  <input type="number" min="1" value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Starts At</label>
                  <input type="datetime-local" value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Expires At</label>
                  <input type="datetime-local" value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={loading || !form.name}
                className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
