"use client";

import { useState } from "react";

type Customer = {
  id: string; first_name: string; last_name: string; full_name: string;
  email: string | null; phone: string | null; loyalty_points: number;
  total_spent: number; visit_count: number; is_active: boolean;
};

type Props = { initialCustomers: Customer[] };

const empty = { first_name: "", last_name: "", email: "", phone: "", address: "", notes: "" };

export default function CustomersClient({ initialCustomers }: Props) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adjustModal, setAdjustModal] = useState<Customer | null>(null);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q);
  });

  function openCreate() { setEditing(null); setForm(empty); setError(""); setShowModal(true); }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ first_name: c.first_name, last_name: c.last_name, email: c.email ?? "", phone: c.phone ?? "", address: "", notes: "" });
    setError(""); setShowModal(true);
  }

  async function handleSave() {
    setLoading(true); setError("");
    try {
      const url = editing ? `/api/customers/${editing.id}` : "/api/customers";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email: form.email || null, phone: form.phone || null }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.detail ?? "Failed"); return; }
      const updated = await res.json();
      if (editing) setCustomers((prev) => prev.map((c) => c.id === editing.id ? updated : c));
      else setCustomers((prev) => [updated, ...prev]);
      setShowModal(false);
    } finally { setLoading(false); }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this customer?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    setCustomers((prev) => prev.map((c) => c.id === id ? { ...c, is_active: false } : c));
  }

  async function handleAdjustLoyalty() {
    if (!adjustModal) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${adjustModal.id}/loyalty/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: adjustPoints, note: adjustNote || null }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.detail ?? "Failed"); return; }
      const updated = await res.json();
      setCustomers((prev) => prev.map((c) => c.id === adjustModal.id ? { ...c, loyalty_points: updated.loyalty_points } : c));
      setAdjustModal(null); setAdjustPoints(0); setAdjustNote("");
    } finally { setLoading(false); }
  }

  return (
    <>
      <div className="mb-4 flex gap-3">
        <input type="text" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
        <button onClick={openCreate}
          className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 font-medium">
          + New Customer
        </button>
      </div>

      <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-right">Loyalty</th>
              <th className="px-4 py-3 text-right">Spent</th>
              <th className="px-4 py-3 text-right">Visits</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No customers found.</td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.full_name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {c.email && <div>{c.email}</div>}
                  {c.phone && <div>{c.phone}</div>}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium">
                    ⭐ {c.loyalty_points.toLocaleString()} pts
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 font-medium">${Number(c.total_spent).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{c.visit_count}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setAdjustModal(c); setAdjustPoints(0); setAdjustNote(""); }}
                      className="text-xs text-yellow-600 hover:text-yellow-700 font-medium">Points</button>
                    <button onClick={() => openEdit(c)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                    {c.is_active && (
                      <button onClick={() => handleDeactivate(c.id)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium">Deactivate</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Customer" : "New Customer"}</h2>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">First name *</label>
                  <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Last name *</label>
                  <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={loading || !form.first_name || !form.last_name}
                className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty Adjust Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-1">Adjust Loyalty Points</h2>
            <p className="text-sm text-gray-500 mb-4">{adjustModal.full_name} — Current: {adjustModal.loyalty_points} pts</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Points (+ add / − remove)</label>
                <input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Reason</label>
                <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. Manual correction"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAdjustModal(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdjustLoyalty} disabled={loading || adjustPoints === 0}
                className="flex-1 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50">
                {loading ? "Saving…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
