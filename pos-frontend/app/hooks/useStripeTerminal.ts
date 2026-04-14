"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type TerminalStatus =
  | "unavailable"   // Stripe not configured
  | "loading"       // SDK loading
  | "disconnected"  // SDK ready, no reader
  | "discovering"   // scanning for readers
  | "connecting"    // connecting to reader
  | "connected"     // ready to accept payments
  | "processing"    // collecting payment
  | "error";

export type Reader = { id: string; label: string; status: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TerminalSDK = any;

export function useStripeTerminal() {
  const [status, setStatus] = useState<TerminalStatus>("loading");
  const [readers, setReaders] = useState<Reader[]>([]);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const terminalRef = useRef<TerminalSDK>(null);

  // Initialize Terminal SDK on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Check if Stripe is configured
        const configRes = await fetch("/api/payments/stripe/config");
        if (!configRes.ok) { setStatus("unavailable"); return; }

        // Dynamically import the SDK (avoids SSR issues)
        const { loadStripeTerminal } = await import("@stripe/terminal-js");
        if (cancelled) return;

        const StripeTerminal = await loadStripeTerminal();
        if (cancelled || !StripeTerminal) { setStatus("unavailable"); return; }

        const terminal = StripeTerminal.create({
          onFetchConnectionToken: async () => {
            const res = await fetch("/api/payments/stripe/connection-token", { method: "POST" });
            const data = await res.json();
            return data.secret;
          },
          onUnexpectedReaderDisconnect: () => {
            setConnectedReader(null);
            setStatus("disconnected");
            setErrorMsg("Reader disconnected unexpectedly.");
          },
        });

        terminalRef.current = terminal;
        if (!cancelled) setStatus("disconnected");
      } catch (e) {
        console.error("[StripeTerminal] init error", e);
        if (!cancelled) setStatus("unavailable");
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const discoverReaders = useCallback(async (simulated = false) => {
    if (!terminalRef.current) return;
    setStatus("discovering");
    setErrorMsg("");
    try {
      const result = await terminalRef.current.discoverReaders({ simulated });
      if (result.error) {
        setErrorMsg(result.error.message);
        setStatus("disconnected");
      } else {
        setReaders(result.discoveredReaders.map((r: TerminalSDK) => ({
          id: r.id, label: r.label || r.id, status: r.status,
        })));
        setStatus("disconnected");
      }
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  }, []);

  const connectReader = useCallback(async (reader: Reader) => {
    if (!terminalRef.current) return;
    setStatus("connecting");
    setErrorMsg("");
    // Find the full reader object from the last discovery
    const rawReader = reader;
    try {
      const result = await terminalRef.current.connectReader(rawReader);
      if (result.error) {
        setErrorMsg(result.error.message);
        setStatus("disconnected");
      } else {
        setConnectedReader(reader);
        setStatus("connected");
      }
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  }, []);

  const collectCardPayment = useCallback(async (orderId: string): Promise<boolean> => {
    if (!terminalRef.current || status !== "connected") return false;
    setStatus("processing");
    setErrorMsg("");
    try {
      // 1. Create PaymentIntent server-side
      const intentRes = await fetch(`/api/payments/stripe/intent/${orderId}`, { method: "POST" });
      const intentData = await intentRes.json();
      if (!intentRes.ok) {
        setErrorMsg(intentData.detail ?? "Failed to create payment intent");
        setStatus("connected");
        return false;
      }

      // 2. Collect payment method via reader
      const collectResult = await terminalRef.current.collectPaymentMethod(intentData.client_secret);
      if (collectResult.error) {
        setErrorMsg(collectResult.error.message);
        setStatus("connected");
        return false;
      }

      // 3. Process the payment
      const processResult = await terminalRef.current.processPayment(collectResult.paymentIntent);
      if (processResult.error) {
        setErrorMsg(processResult.error.message);
        setStatus("connected");
        return false;
      }

      // 4. Capture server-side + record payment
      const captureRes = await fetch("/api/payments/stripe/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          payment_intent_id: intentData.payment_intent_id,
        }),
      });
      if (!captureRes.ok) {
        const d = await captureRes.json();
        setErrorMsg(d.detail ?? "Capture failed");
        setStatus("connected");
        return false;
      }

      setStatus("connected");
      return true;
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("connected");
      return false;
    }
  }, [status]);

  const disconnectReader = useCallback(async () => {
    if (terminalRef.current) await terminalRef.current.disconnectReader();
    setConnectedReader(null);
    setStatus("disconnected");
  }, []);

  return {
    status, readers, connectedReader, errorMsg,
    discoverReaders, connectReader, collectCardPayment, disconnectReader,
  };
}
