"use client";

import { useState } from "react";

export default function SettingsClient({ userId }: { userId: string }) {
  const [saved, setSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwPending, setPwPending] = useState(false);

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwError("");
    setPwSaved(false);
    const form = new FormData(e.currentTarget);
    const newPassword = form.get("new_password") as string;
    const confirm = form.get("confirm_password") as string;
    if (newPassword !== confirm) {
      setPwError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    setPwPending(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error("Failed to update password");
      setPwSaved(true);
      (e.target as HTMLFormElement).reset();
    } catch {
      setPwError("Failed to update password. Try again.");
    } finally {
      setPwPending(false);
    }
  }

  return (
    <>
      {/* Change password */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              name="new_password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              name="confirm_password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          {pwError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>}
          {pwSaved && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">Password updated successfully.</p>}
          <button
            type="submit"
            disabled={pwPending}
            className="w-full rounded-lg bg-black text-white py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {pwPending ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </>
  );
}
