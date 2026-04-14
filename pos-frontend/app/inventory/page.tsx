import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/app/lib/server-api";
import AuthLayout from "@/app/components/AuthLayout";
import InventoryClient from "./InventoryClient";

async function getData(token: string) {
  const [productsRes, adjustmentsRes] = await Promise.all([
    fetch(`${SERVER_API_BASE}/api/v1/products/?limit=200`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    fetch(`${SERVER_API_BASE}/api/v1/inventory-adjustments/?limit=100`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
  ]);
  return {
    products: productsRes.ok ? await productsRes.json() : [],
    adjustments: adjustmentsRes.ok ? await adjustmentsRes.json() : [],
  };
}

export default async function InventoryPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  const { products, adjustments } = await getData(token);
  return (
    <AuthLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track stock levels, log adjustments, and audit inventory history</p>
        </div>
        <InventoryClient initialProducts={products} initialAdjustments={adjustments} />
      </div>
    </AuthLayout>
  );
}
