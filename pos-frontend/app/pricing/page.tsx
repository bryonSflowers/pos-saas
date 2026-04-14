import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

async function fetchPlans(): Promise<PlanDef[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/billing/plans`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function fmtLimit(v: number) {
  return v === -1 ? "Unlimited" : String(v);
}

const FEATURE_LABELS: Record<string, string> = {
  pos: "POS Terminal",
  orders: "Orders & Receipts",
  basic_reports: "Basic Reports",
  reports: "Advanced Reports",
  customers: "Customer Management",
  shifts: "Cash Shift Tracking",
  inventory: "Inventory Management",
  suppliers: "Supplier & POs",
  loyalty: "Loyalty Program",
  promotions: "Promotions & Coupons",
  stripe_terminal: "Card Reader (Stripe Terminal)",
  z_report: "Z-Report",
  email_receipts: "Email Receipts",
  white_label: "White-Label Branding",
  api_access: "API Access",
  priority_support: "Priority Support",
  custom_integrations: "Custom Integrations",
  all: "All Features",
};

export default async function PricingPage() {
  const plans = await fetchPlans();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">POS SaaS</Link>
        <div className="flex gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100">Sign In</Link>
          <Link href="/register" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">Get Started</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Start free, scale as you grow. No hidden fees, no long-term contracts.
          </p>
        </div>

        {/* Plan cards */}
        {plans.length === 0 ? (
          <p className="text-center text-gray-400">Unable to load plans. Please try again.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col shadow-sm transition-shadow hover:shadow-md ${
                  plan.highlight
                    ? "border-blue-500 shadow-blue-100 shadow-md"
                    : "border-gray-200"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h2>
                  <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-gray-900">
                      ${plan.price_monthly}
                    </span>
                    {plan.price_monthly > 0 && (
                      <span className="text-gray-400 text-sm mb-1">/mo</span>
                    )}
                  </div>
                  {plan.price_yearly > 0 && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      ${plan.price_yearly}/yr — save ${plan.price_monthly * 12 - plan.price_yearly}
                    </p>
                  )}
                </div>

                {/* Limits */}
                <div className="border-t border-gray-100 pt-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Locations</span>
                    <span className="font-medium text-gray-900">{fmtLimit(plan.locations)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Products</span>
                    <span className="font-medium text-gray-900">{fmtLimit(plan.products)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Users</span>
                    <span className="font-medium text-gray-900">{fmtLimit(plan.users)}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-green-500 flex-shrink-0">✓</span>
                      {FEATURE_LABELS[f] ?? f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.price_monthly === 0 ? "/register" : `/register?plan=${plan.id}`}
                  className={`w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  }`}
                >
                  {plan.price_monthly === 0 ? "Start for Free" : "Get Started"}
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* FAQ / bottom CTA */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Already have an account?</h2>
          <p className="text-gray-500 mb-6">Upgrade your plan from the billing settings inside your dashboard.</p>
          <Link href="/login" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700">
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
