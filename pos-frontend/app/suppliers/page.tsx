import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/app/lib/server-api";
import AuthLayout from "@/app/components/AuthLayout";
import SuppliersClient from "./SuppliersClient";

async function getData(token: string) {
  const [suppliersRes, poRes, productsRes] = await Promise.all([
    fetch(`${SERVER_API_BASE}/api/v1/suppliers/`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    fetch(`${SERVER_API_BASE}/api/v1/suppliers/purchase-orders`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    fetch(`${SERVER_API_BASE}/api/v1/products/?limit=200`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
  ]);
  return {
    suppliers: suppliersRes.ok ? await suppliersRes.json() : [],
    purchaseOrders: poRes.ok ? await poRes.json() : [],
    products: productsRes.ok ? await productsRes.json() : [],
  };
}

export default async function SuppliersPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  const { suppliers, purchaseOrders, products } = await getData(token);
  return (
    <AuthLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Suppliers & Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage vendors, create purchase orders, and receive stock</p>
        </div>
        <SuppliersClient initialSuppliers={suppliers} initialPOs={purchaseOrders} products={products} />
      </div>
    </AuthLayout>
  );
}
