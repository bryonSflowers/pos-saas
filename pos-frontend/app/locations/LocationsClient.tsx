"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { createLocationAction, updateLocationAction, deleteLocationAction, LocationFormState } from "./actions";

type Location = { id: string; name: string; address: string | null; phone: string | null; currency: string; tax_rate: number; is_active: boolean };

function LocationForm({
  location,
  onClose,
}: {
  location?: Location;
  onClose: () => void;
}) {
  const action = location
    ? updateLocationAction.bind(null, location.id)
    : createLocationAction;

  const [state, formAction, pending] = useActionState<LocationFormState, FormData>(action, null);
  const prevPending = useRef(pending);
  useEffect(() => {
    if (prevPending.current && !pending && !state) onClose();
    prevPending.current = pending;
  }, [pending, state, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">{location ? "Edit Location" : "Add Location"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input name="name" type="text" required defaultValue={location?.name}
              placeholder="Main Store"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input name="address" type="text" defaultValue={location?.address ?? ""}
              placeholder="123 Main St"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input name="phone" type="text" defaultValue={location?.phone ?? ""}
                placeholder="+1 555 0100"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <input name="currency" type="text" maxLength={3} defaultValue={location?.currency ?? "USD"}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (e.g. 0.08 for 8%)</label>
            <input name="tax_rate" type="number" step="0.001" min="0" max="1"
              defaultValue={location?.tax_rate ?? 0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
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
              {pending ? "Saving…" : location ? "Save changes" : "Add location"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LocationsClient({ locations }: { locations: Location[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{locations.length} location(s)</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors">
          + Add location
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.length === 0 && (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">
            No locations yet. Add your first store location to start taking orders.
          </div>
        )}
        {locations.map((l) => {
          const deleteAction = deleteLocationAction.bind(null, l.id);
          return (
            <div key={l.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <h2 className="font-semibold text-gray-900">{l.name}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  l.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {l.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-sm text-gray-600">
                {l.address && <p>{l.address}</p>}
                {l.phone && <p>{l.phone}</p>}
                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                  <span>{l.currency}</span>
                  <span>Tax: {(l.tax_rate * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                <button onClick={() => setEditing(l)}
                  className="flex-1 text-xs text-gray-600 hover:text-gray-900 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                  Edit
                </button>
                <form action={deleteAction} className="flex-1">
                  <button type="submit"
                    className="w-full text-xs text-red-500 hover:text-red-700 py-1 rounded border border-red-100 hover:bg-red-50 transition-colors"
                    onClick={(e) => { if (!confirm(`Deactivate "${l.name}"?`)) e.preventDefault(); }}>
                    Deactivate
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && <LocationForm onClose={() => setShowAdd(false)} />}
      {editing && <LocationForm location={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
