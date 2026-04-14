import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/app/lib/server-api";
import AuthLayout from "@/app/components/AuthLayout";
import CustomersClient from "./CustomersClient";

async function getCustomers(token: string) {
  const res = await fetch(`${SERVER_API_BASE}/api/v1/customers/?active_only=false`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  return res.ok ? res.json() : [];
}

export default async function CustomersPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  const customers = await getCustomers(token);
  return (
    <AuthLayout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-sm text-gray-500 mt-1">Manage customer profiles and loyalty points</p>
          </div>
        </div>
        <CustomersClient initialCustomers={customers} />
      </div>
    </AuthLayout>
  );
}
