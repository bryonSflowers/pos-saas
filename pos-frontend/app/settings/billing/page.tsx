import AuthLayout from "@/app/components/AuthLayout";
import BillingClient from "./BillingClient";
import { apiFetchAuth } from "@/app/lib/auth";

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

export default async function BillingPage() {
  const [billing, plans] = await Promise.all([
    apiFetchAuth<BillingInfo>("/api/v1/billing/current").catch(() => null),
    apiFetchAuth<PlanDef[]>("/api/v1/billing/plans").catch(() => [] as PlanDef[]),
  ]);

  return (
    <AuthLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Billing & Subscription</h1>
        <p className="text-sm text-gray-500 mb-6">Manage your plan, usage, and payment method.</p>
        <BillingClient billing={billing} plans={plans} />
      </div>
    </AuthLayout>
  );
}
