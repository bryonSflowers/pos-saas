"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { createUserAction, toggleUserAction, deleteUserAction, UserFormState } from "./actions";

type User = { id: string; full_name: string; email: string; role: string; is_active: boolean };

const ROLES = ["cashier", "manager", "admin", "owner"];

const roleBadge = (role: string) => {
  const map: Record<string, string> = {
    owner: "bg-purple-100 text-purple-700",
    admin: "bg-blue-100 text-blue-700",
    manager: "bg-yellow-100 text-yellow-700",
    cashier: "bg-gray-100 text-gray-600",
  };
  return map[role] ?? "bg-gray-100 text-gray-600";
};

function AddUserModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    createUserAction,
    null
  );
  const prevPending = useRef(pending);
  useEffect(() => {
    if (prevPending.current && !pending && !state) onClose();
    prevPending.current = pending;
  }, [pending, state, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Add Team Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input name="full_name" type="text" required placeholder="Jane Smith"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" type="email" required placeholder="jane@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input name="password" type="password" required minLength={8} placeholder="••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select name="role" defaultValue="cashier"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 rounded-lg bg-black text-white py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {pending ? "Saving…" : "Add member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersClient({ users }: { users: User[] }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} member(s)</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors">
          + Add member
        </button>
      </div>

      <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
        {users.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No team members yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => {
                const toggleAction = toggleUserAction.bind(null, u.id, u.is_active);
                const deleteAction = deleteUserAction.bind(null, u.id);
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{u.full_name}</td>
                    <td className="px-5 py-3 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right flex gap-3 justify-end">
                      <form action={toggleAction}>
                        <button type="submit" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <form action={deleteAction}>
                        <button type="submit"
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                          onClick={(e) => { if (!confirm(`Remove ${u.full_name}?`)) e.preventDefault(); }}>
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
