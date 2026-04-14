"use client";

import { useState } from "react";

type Supplier = {
  id: string; name: string; contact_name: string | null;
  email: string | null; phone: string | null; is_active: boolean;
};

type POItem = {
  product_id: string; qty_ordered: number; qty_received: number; unit_cost: number;
};

type PurchaseOrder = {
  id: string; supplier_id: string; po_number: string; status: string;
  expected_date: string | null; received_at: string | null;
  total_cost: number; items: POItem[];
};

type Product = { id: string; name: string; sku: string | null };

const emptySupplier = { name: "", contact_name: "", email: "", phone: "" };

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500",
  ordered: "bg-blue-50 text-blue-700",
  received: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-500",
};

export default function SuppliersClient({
  initialSuppliers, initialPOs, products,
}: { initialSuppliers: Supplier[]; initialPOs: PurchaseOrder[]; products: Product[] }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [pos, setPOs] = useState<PurchaseOrder[]>(initialPOs);
  const [tab, setTab] = useState<"suppliers" | "orders">("suppliers");

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [supplierError, setSupplierError] = useState("");

  // PO modal
  const [showPOModal, setShowPOModal] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poExpected, setPoExpected] = useState("");
  const [poItems, setPoItems] = useState<{ product_id: string; qty_ordered: number; unit_cost: number }[]>([
    { product_id: "", qty_ordered: 1, unit_cost: 0 },
  ]);
  const [poError, setPOError] = useState("");

  // Receive modal
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);

  // Supplier CRUD
  function openCreateSupplier() {
    setEditingSupplier(null); setSupplierForm(emptySupplier); setSupplierError(""); setShowSupplierModal(true);
  }
  function openEditSupplier(s: Supplier) {
    setEditingSupplier(s);
    setSupplierForm({ name: s.name, contact_name: s.contact_name ?? "", email: s.email ?? "", phone: s.phone ?? "" });
    setSupplierError(""); setShowSupplierModal(true);
  }

  async function handleSaveSupplier() {
    setLoading(true); setSupplierError("");
    try {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers";
      const method = editingSupplier ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...supplierForm, contact_name: supplierForm.contact_name || null, email: supplierForm.email || null, phone: supplierForm.phone || null }),
      });
      if (!res.ok) { const d = await res.json(); setSupplierError(d.detail ?? "Failed"); return; }
      const updated = await res.json();
      if (editingSupplier) setSuppliers((prev) => prev.map((s) => s.id === editingSupplier.id ? updated : s));
      else setSuppliers((prev) => [updated, ...prev]);
      setShowSupplierModal(false);
    } finally { setLoading(false); }
  }

  // PO creation
  function openCreatePO() {
    setPoSupplierId(suppliers[0]?.id ?? ""); setPoExpected(""); setPOError("");
    setPoItems([{ product_id: products[0]?.id ?? "", qty_ordered: 1, unit_cost: 0 }]);
    setShowPOModal(true);
  }

  function addPOItem() {
    setPoItems((prev) => [...prev, { product_id: products[0]?.id ?? "", qty_ordered: 1, unit_cost: 0 }]);
  }

  function removePOItem(i: number) {
    setPoItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCreatePO() {
    setLoading(true); setPOError("");
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _type: "po", supplier_id: poSupplierId,
          expected_date: poExpected || null, items: poItems,
        }),
      });
      if (!res.ok) { const d = await res.json(); setPOError(d.detail ?? "Failed"); return; }
      const created = await res.json();
      setPOs((prev) => [created, ...prev]);
      setShowPOModal(false);
    } finally { setLoading(false); }
  }

  // Receive PO
  function openReceive(po: PurchaseOrder) {
    const qtys: Record<string, number> = {};
    po.items.forEach((item) => { qtys[item.product_id] = item.qty_ordered - item.qty_received; });
    setReceiveQtys(qtys);
    setReceivePO(po);
  }

  async function handleReceive() {
    if (!receivePO) return;
    setLoading(true);
    try {
      const items = Object.entries(receiveQtys).map(([product_id, qty_received]) => ({ product_id, qty_received }));
      const res = await fetch(`/api/suppliers/${receivePO.id}/receive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) { alert("Failed to receive PO"); return; }
      const updated = await res.json();
      setPOs((prev) => prev.map((p) => p.id === receivePO.id ? updated : p));
      setReceivePO(null);
    } finally { setLoading(false); }
  }

  function supplierName(id: string) {
    return suppliers.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  }

  function productName(id: string) {
    return products.find((p) => p.id === id)?.name ?? id.slice(0, 8);
  }

  const poTotal = poItems.reduce((sum, i) => sum + i.qty_ordered * i.unit_cost, 0);

  return (
    <>
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("suppliers")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "suppliers" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          Suppliers
        </button>
        <button onClick={() => setTab("orders")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "orders" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          Purchase Orders
        </button>
      </div>

      {tab === "suppliers" && (
        <>
          <div className="mb-3 flex justify-end">
            <button onClick={openCreateSupplier}
              className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 font-medium">
              + Add Supplier
            </button>
          </div>
          <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {suppliers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No suppliers yet.</td></tr>
                )}
                {suppliers.filter((s) => s.is_active).map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.contact_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{s.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{s.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEditSupplier(s)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "orders" && (
        <>
          <div className="mb-3 flex justify-end">
            <button onClick={openCreatePO} disabled={suppliers.length === 0}
              className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50">
              + New Purchase Order
            </button>
          </div>
          <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">PO #</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3 text-left">Expected</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pos.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No purchase orders yet.</td></tr>
                )}
                {pos.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{po.po_number}</td>
                    <td className="px-4 py-3 font-medium">{supplierName(po.supplier_id)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">${Number(po.total_cost).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {po.status === "ordered" && (
                        <button onClick={() => openReceive(po)} className="text-xs text-green-600 hover:text-green-700 font-medium">Receive</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Supplier modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{editingSupplier ? "Edit Supplier" : "New Supplier"}</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Company Name *</label>
                <input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Contact Person</label>
                <input value={supplierForm.contact_name} onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Email</label>
                  <input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Phone</label>
                  <input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
              {supplierError && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{supplierError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowSupplierModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={handleSaveSupplier} disabled={loading || !supplierForm.name}
                className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PO creation modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">New Purchase Order</h2>
            <div className="flex flex-col gap-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Supplier *</label>
                  <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {suppliers.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Expected Delivery</label>
                  <input type="date" value={poExpected} onChange={(e) => setPoExpected(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Items</h3>
            <div className="flex flex-col gap-2 mb-3">
              {poItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={item.product_id} onChange={(e) => setPoItems((prev) => prev.map((x, j) => j === i ? { ...x, product_id: e.target.value } : x))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
                  </select>
                  <div className="w-20">
                    <input type="number" min="1" value={item.qty_ordered}
                      onChange={(e) => setPoItems((prev) => prev.map((x, j) => j === i ? { ...x, qty_ordered: parseInt(e.target.value) || 1 } : x))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none"
                      placeholder="Qty" />
                  </div>
                  <div className="w-28">
                    <input type="number" min="0" step="0.01" value={item.unit_cost}
                      onChange={(e) => setPoItems((prev) => prev.map((x, j) => j === i ? { ...x, unit_cost: parseFloat(e.target.value) || 0 } : x))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none"
                      placeholder="Unit cost" />
                  </div>
                  <span className="text-xs text-gray-500 w-20 text-right">${(item.qty_ordered * item.unit_cost).toFixed(2)}</span>
                  {poItems.length > 1 && (
                    <button onClick={() => removePOItem(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                  )}
                </div>
              ))}
              <button onClick={addPOItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium self-start mt-1">+ Add item</button>
            </div>
            <div className="flex justify-between items-center border-t pt-3 mb-3">
              <span className="text-sm text-gray-500">Total</span>
              <span className="font-semibold text-gray-900">${poTotal.toFixed(2)}</span>
            </div>
            {poError && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2 mb-3">{poError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowPOModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={handleCreatePO} disabled={loading || !poSupplierId || poItems.some((i) => !i.product_id)}
                className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {loading ? "Creating…" : "Create PO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive modal */}
      {receivePO && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-1">Receive Stock</h2>
            <p className="text-sm text-gray-500 mb-4">PO {receivePO.po_number} — {supplierName(receivePO.supplier_id)}</p>
            <div className="flex flex-col gap-2">
              {receivePO.items.map((item) => (
                <div key={item.product_id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-800">{productName(item.product_id)}</span>
                  <span className="text-xs text-gray-400">Ordered: {item.qty_ordered}</span>
                  <input type="number" min="0" max={item.qty_ordered}
                    value={receiveQtys[item.product_id] ?? 0}
                    onChange={(e) => setReceiveQtys((prev) => ({ ...prev, [item.product_id]: parseInt(e.target.value) || 0 }))}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setReceivePO(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={handleReceive} disabled={loading}
                className="flex-1 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
                {loading ? "Receiving…" : "Confirm Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
