"use client";

import { useState } from "react";
import ProductModal from "./ProductModal";
import { deleteProductAction } from "./actions";

type Product = { id: string; name: string; sku: string | null; price: string; stock_qty: number; is_active: boolean; description?: string | null; category_id?: string | null };
type Category = { id: string; name: string };

export default function ProductsClient({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} items</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors">
          + Add product
        </button>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Search products…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
      </div>

      <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  {search ? "No products match your search." : "No products yet. Add your first product."}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const deleteAction = deleteProductAction.bind(null, p.id);
              return (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.sku ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-500">{p.category_id ? categoryMap[p.category_id] ?? "—" : "—"}</td>
                  <td className="px-5 py-3 text-right text-gray-900">${parseFloat(p.price).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={p.stock_qty <= 5 ? "text-orange-500 font-medium" : "text-gray-900"}>
                      {p.stock_qty}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right flex gap-3 justify-end">
                    <button onClick={() => setEditing(p)}
                      className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                      Edit
                    </button>
                    <form action={deleteAction}>
                      <button type="submit"
                        className="text-sm text-red-400 hover:text-red-600 transition-colors"
                        onClick={(e) => { if (!confirm(`Deactivate "${p.name}"?`)) e.preventDefault(); }}>
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && <ProductModal categories={categories} onClose={() => setShowAdd(false)} />}
      {editing && <ProductModal product={editing} categories={categories} onClose={() => setEditing(null)} />}
    </div>
  );
}
