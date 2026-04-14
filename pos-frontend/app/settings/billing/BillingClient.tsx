"use client";

import { useState } from "react";
import Link from "next/link";

type BillingInfo = {
  plan: string;
  plan_name: string;
  price_monthly: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  usage: {
    locations: { current: number; limit: number };
    products: { current: number; limit: number };
    users: { current: number; limit: number };
  };
  features: string[];
};

type PlanDef = {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  locations: number;
  products: number;
  users: number;
  features: string[];
  description: string;
  highlight: boolean;
};

interface Props {
  billing: BillingInfo | null;
  plans: PlanDef[];
}

function UsageMeter({ label, current, limit }: { label: string; current: number; limit: number }) {
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const isUnlimited = limit === -1;
  const isWarning = !isUnlimited && pct >= 80;
  const isFull = !isUnlimited && pct >= 100;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={`font-medium ${isFull ? "text-red-600" : isWarning ? "text-amber-600" : "text-gray-900"}`}>
          {current} / {isUnlimited ? "∞" : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isFull ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingClient({ billing, plans }: Props) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState("");

  async function handleUpgrade(planId: string) {
    setLoadingPlan(planId);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          interval,
          success_url: window.location.origin + "/settings/billing?success=1",
          cancel_url: window.location.origin + "/settings/billing",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Failed to start checkout");
      } else {
        window.location.href = data.checkout_url;
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handlePortal() {
    setLoadingPortal(true);
    setError("");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Failed to open billing portal");
      } else {
        window.location.href = data.portal_url;
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingPortal(false);
    }
  }

  if (!billing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        Unable to load billing information. Please refresh.
      </div>
    );
  }

  const currentPlanDef = plans.find((p) => p.id === billing.plan);

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("success") && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          Subscription activated! Your plan has been updated.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{billing.plan_name} Plan</h2>
            <p className="text-sm text-gray-500">
              {billing.price_monthly === 0 ? "Free forever" : `$${billing.price_monthly}/month`}
            </p>
          </div>
          <div className="flex gap-2">
            {billing.stripe_subscription_id && (
              <button
                onClick={handlePortal}
                disabled={loadingPortal}
                className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
              >
                {loadingPortal ? "Loading…" : "Manage Subscription"}
              </button>
            )}
            <Link href="/pricing" className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              View Plans
            </Link>
          </div>
        </div>

        {/* Usage meters */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Usage</h3>
          <UsageMeter label="Locations" current={billing.usage.locations.current} limit={billing.usage.locations.limit} />
          <UsageMeter label="Products" current={billing.usage.products.current} limit={billing.usage.products.limit} />
          <UsageMeter label="Team Members" current={billing.usage.users.current} limit={billing.usage.users.limit} />
        </div>

        {/* Features */}
        <div className="pt-4 border-t border-gray-100 mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Included Features</h3>
          <div className="flex flex-wrap gap-2">
            {billing.features.map((f) => (
              <span key={f} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                {f.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Plan picker */}
      {plans.filter((p) => p.id !== billing.plan && p.price_monthly > 0).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upgrade Your Plan</h2>
            {/* Interval toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              <button
                onClick={() => setInterval("monthly")}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${interval === "monthly" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setInterval("yearly")}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${interval === "yearly" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                Yearly <span className="text-green-600 font-semibold">Save ~20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans
              .filter((p) => p.id !== billing.plan && p.price_monthly > 0)
              .map((plan) => {
                const price = interval === "yearly" ? plan.price_yearly : plan.price_monthly;
                const displayPrice = interval === "yearly" ? Math.round(plan.price_yearly / 12) : plan.price_monthly;
                const isHigher = (currentPlanDef?.price_monthly ?? 0) < plan.price_monthly;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-xl border-2 p-4 flex flex-col ${plan.highlight ? "border-blue-400" : "border-gray-200"}`}
                  >
                    {plan.highlight && (
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Most Popular</span>
                    )}
                    <h3 className="font-semibold text-gray-900 mb-0.5">{plan.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      ${displayPrice}<span className="text-sm font-normal text-gray-400">/mo</span>
                    </div>
                    {interval === "yearly" && (
                      <p className="text-xs text-green-600 mb-3">
                        Billed ${plan.price_yearly}/yr · Save ${plan.price_monthly * 12 - plan.price_yearly}
                      </p>
                    )}
                    <div className="text-xs text-gray-500 space-y-0.5 mb-3 flex-1">
                      <div>{plan.locations === -1 ? "Unlimited" : plan.locations} location{plan.locations !== 1 ? "s" : ""}</div>
                      <div>{plan.products === -1 ? "Unlimited" : plan.products} products</div>
                      <div>{plan.users === -1 ? "Unlimited" : plan.users} users</div>
                    </div>
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={loadingPlan === plan.id}
                      className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                        plan.highlight
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-900 text-white hover:bg-gray-700"
                      }`}
                    >
                      {loadingPlan === plan.id ? "Loading…" : isHigher ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Already on enterprise or top tier */}
      {billing.plan === "enterprise" && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white text-center">
          <h2 className="text-lg font-semibold mb-1">You are on the Enterprise plan</h2>
          <p className="text-sm text-blue-100">Contact us for custom pricing, integrations, or SLA requirements.</p>
          <a href="mailto:support@possaas.com" className="inline-block mt-3 bg-white text-blue-700 text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-50">
            Contact Support
          </a>
        </div>
      )}
    </div>
  );
}
