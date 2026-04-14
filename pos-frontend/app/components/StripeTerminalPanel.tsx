"use client";

import { useState } from "react";
import { useStripeTerminal, TerminalStatus } from "@/app/hooks/useStripeTerminal";

const STATUS_LABEL: Record<TerminalStatus, string> = {
  unavailable:  "Card reader unavailable",
  loading:      "Loading…",
  disconnected: "No reader connected",
  discovering:  "Scanning for readers…",
  connecting:   "Connecting…",
  connected:    "Reader ready",
  processing:   "Processing card…",
  error:        "Error",
};

const STATUS_COLOR: Record<TerminalStatus, string> = {
  unavailable:  "bg-gray-100 text-gray-400",
  loading:      "bg-gray-100 text-gray-400",
  disconnected: "bg-orange-50 text-orange-600",
  discovering:  "bg-blue-50 text-blue-600",
  connecting:   "bg-blue-50 text-blue-600",
  connected:    "bg-green-50 text-green-700",
  processing:   "bg-purple-50 text-purple-700",
  error:        "bg-red-50 text-red-600",
};

interface Props {
  orderId: string | null;
  orderTotal: number;
  onPaymentSuccess: () => void;
}

export default function StripeTerminalPanel({ orderId, orderTotal, onPaymentSuccess }: Props) {
  const {
    status, readers, connectedReader, errorMsg,
    discoverReaders, connectReader, collectCardPayment, disconnectReader,
  } = useStripeTerminal();

  const [showReaders, setShowReaders] = useState(false);
  const [simulated, setSimulated] = useState(false);

  async function handleDiscover() {
    setShowReaders(true);
    await discoverReaders(simulated);
  }

  async function handlePayByCard() {
    if (!orderId) return;
    const ok = await collectCardPayment(orderId);
    if (ok) onPaymentSuccess();
  }

  if (status === "unavailable") return null; // Hide entirely when Stripe not configured

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[status]}`}>
            {status === "connected" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
            {status === "processing" && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />}
            {STATUS_LABEL[status]}
            {connectedReader && ` — ${connectedReader.label}`}
          </span>
        </div>
        {connectedReader && (
          <button onClick={disconnectReader} className="text-xs text-gray-400 hover:text-gray-600">Disconnect</button>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-2">{errorMsg}</p>
      )}

      {/* Pay by card button — shown when connected and order exists */}
      {status === "connected" && orderId && (
        <button onClick={handlePayByCard}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
          <span>💳</span> Charge ${orderTotal.toFixed(2)} via Card Reader
        </button>
      )}

      {/* Processing state */}
      {status === "processing" && (
        <div className="w-full py-2.5 bg-purple-100 text-purple-700 text-sm font-medium rounded-lg text-center animate-pulse">
          Waiting for card… tap, insert, or swipe
        </div>
      )}

      {/* Discover / connect flow */}
      {(status === "disconnected" || status === "error") && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button onClick={handleDiscover}
              className="flex-1 py-2 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50">
              {showReaders ? "Refresh Readers" : "Find Card Readers"}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={simulated} onChange={(e) => setSimulated(e.target.checked)}
                className="rounded" />
              Simulated
            </label>
          </div>

          {/* Reader list */}
          {showReaders && readers.length > 0 && (
            <div className="flex flex-col gap-1">
              {readers.map((r) => (
                <button key={r.id} onClick={() => connectReader(r)}
                  className="w-full text-left px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-between">
                  <span>{r.label}</span>
                  <span className="text-xs text-gray-400">{r.status}</span>
                </button>
              ))}
            </div>
          )}

          {showReaders && readers.length === 0 && status === "disconnected" && (
            <p className="text-xs text-gray-400 text-center py-1">
              No readers found. Enable &quot;Simulated&quot; to test without hardware.
            </p>
          )}
        </div>
      )}

      {/* Connecting spinner */}
      {(status === "connecting" || status === "discovering") && (
        <div className="text-center text-xs text-gray-400 py-1 animate-pulse">{STATUS_LABEL[status]}</div>
      )}
    </div>
  );
}
