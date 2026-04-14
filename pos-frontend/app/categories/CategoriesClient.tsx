"use client";

import { useState, useActionState } from "react";
import { createCategoryAction, deleteCategoryAction, CategoryFormState } from "./actions";

type Category = { id: string; name: string; color: string | null };

function DeleteButton({ id, name }: { id: string; name: string }) {
  const boundAction = deleteCategoryAction.bind(null, id);
  return (
    <form action={boundAction}>
      <button
        type="submit"
        className="text-xs text-red-500 hover:text-red-700 transition-colors"
        onClick={(e) => { if (!confirm(`Delete "${name}"?`)) e.preventDefault(); }}
      >
        Delete
      </button>
    </form>
  );
}

export default function CategoriesClient({ categories }: { categories: Category[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(
    createCategoryAction,
    null
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">{categories.length} category(s)</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          + Add category
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Category</h2>
          <form action={formAction} className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                name="name"
                type="text"
                placeholder="e.g. Beverages"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                name="color"
                type="color"
                defaultValue="#6366f1"
                className="h-9 w-16 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
          {state?.error && (
            <p className="text-sm text-red-600 mt-2">{state.error}</p>
          )}
        </div>
      )}

      <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No categories yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Color</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <span
                      className="inline-block w-5 h-5 rounded-full border border-gray-200"
                      style={{ backgroundColor: c.color ?? "#e5e7eb" }}
                    />
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-5 py-3 text-right">
                    <DeleteButton id={c.id} name={c.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
