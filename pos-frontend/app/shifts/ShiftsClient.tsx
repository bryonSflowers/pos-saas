"use client";

import { useState } from "react";
import Link from "next/link";

type Shift = {
  id: string; location_id: string; cashier_id: string; status: string;
  opening_float: number; closing_cash: number | null; expected_cash: number | null;
  cash_variance: number | null; notes: string | null;
  opened_at: string; closed_at: string | null;
  order_count?: number; total_sales?: number;
};
type Location = { id: string; name: string };

export default function ShiftsClient({ initialShifts, locations }: { initialShifts: Shift[]; locations: Location[] }) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState<Shift | null>(null);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const openShift = shifts.find((s) => s.status === "OPEN");

  async function handleOpenShift() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "open", location_id: locationId, opening_float: parseFloat(openingFloat) || 0 }),
      });
      let data: Record<string, unknown>;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) { setError((data.detail as string) ?? `Server error (${res.status})`); return; }
      setShifts((prev) => [data as unknown as Shift, ...prev]);
      setShowOpenModal(false);
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : "Could not reach server"}`);
    } finally { setLoading(false); }
  }

  async function handleCloseShift() {
    if (!showCloseModal) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/shifts/${showCloseModal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closing_cash: parseFloat(closingCash) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Failed"); return; }
      setShifts((prev) => prev.map((s) => s.id === showCloseModal.id ? data : s));
      setShowCloseModal(null);
    } finally { setLoading(false); }
  }

  function fmtDate(s: string) { return new Date(s).toLocaleString(); }
  function locationName(id: string) { return locations.find((l) => l.id === id)?.name ?? id.slice(0, 8); }

  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        {openShift ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-800">Shift open at {locationName(openShift.location_id)} — Float: ${openShift.opening_float.toFixed(2)}</span>
            <button onClick={() => { setShowCloseModal(openShift); setClosingCash(""); setError(""); }}
              className="ml-2 px-3 py-1 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800">Close Shift</button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No open shift.</p>
        )}
        {!openShift && (
          <button onClick={() => { setShowOpenModal(true); setError(""); }}
            className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 font-medium">
            Open Shift
          </button>
        )}
      </div>

      <div className="table-responsive bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Opened</th>
              <th className="px-4 py-3 text-left">Closed</th>
              <th className="px-4 py-3 text-right">Float</th>
              <th className="px-4 py-3 text-right">Expected</th>
              <th className="px-4 py-3 text-right">Actual</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {shifts.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No shifts yet.</td></tr>}
            {shifts.map((s) => {
              const variance = s.cash_variance;
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{locationName(s.location_id)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(s.opened_at)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.closed_at ? fmtDate(s.closed_at) : "—"}</td>
                  <td className="px-4 py-3 text-right">${s.opening_float.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">{s.expected_cash != null ? `$${s.expected_cash.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-right">{s.closing_cash != null ? `$${s.closing_cash.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {variance != null ? (
                      <span className={`font-medium ${variance < 0 ? "text-red-600" : variance > 0 ? "text-orange-500" : "text-green-600"}`}>
                        {variance >= 0 ? "+" : ""}{variance.toFixed(2)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === "OPEN" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {s.status === "OPEN" ? "open" : "closed"}
                      </span>
                      {s.status === "CLOSED" && (
                        <Link href={`/shifts/${s.id}/report`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          Z-Report
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Open modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Open New Shift</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Location</label>
                <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Opening float ($)</label>
                <input type="number" min="0" step="0.01" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowOpenModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={handleOpenShift} disabled={loading || !locationId}
                className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {loading ? "Opening…" : "Open Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-1">Close Shift</h2>
            <p className="text-sm text-gray-500 mb-4">Count the cash in the drawer and enter the total below.</p>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Actual cash in drawer ($)</label>
              <input type="number" min="0" step="0.01" value={closingCash} onChange={(e) => setClosingCash(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            {error && <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCloseModal(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={handleCloseShift} disabled={loading || !closingCash}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {loading ? "Closing…" : "Close Shift"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
