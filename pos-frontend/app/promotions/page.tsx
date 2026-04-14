import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/app/lib/server-api";
import AuthLayout from "@/app/components/AuthLayout";
import PromotionsClient from "./PromotionsClient";

export default async function PromotionsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  const res = await fetch(`${SERVER_API_BASE}/api/v1/promotions/`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  const promotions = res.ok ? await res.json() : [];
  return (
    <AuthLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
          <p className="text-sm text-gray-500 mt-1">Create discount codes and automatic promotions</p>
        </div>
        <PromotionsClient initialPromotions={promotions} />
      </div>
    </AuthLayout>
  );
}
