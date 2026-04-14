import AuthLayout from "@/app/components/AuthLayout";
import POSTerminal from "./POSTerminal";
import { apiFetchAuth } from "@/app/lib/auth";

type Product = { id: string; name: string; price: string; stock_qty: number; sku: string | null; barcode: string | null; is_active: boolean; category_id: string | null };
type Location = { id: string; name: string; currency: string; tax_rate: number };
type Category = { id: string; name: string; color: string | null };

export default async function NewOrderPage() {
  const [products, locations, categories] = await Promise.all([
    apiFetchAuth<Product[]>("/api/v1/products/").catch(() => [] as Product[]),
    apiFetchAuth<Location[]>("/api/v1/locations/").catch(() => [] as Location[]),
    apiFetchAuth<Category[]>("/api/v1/categories/").catch(() => [] as Category[]),
  ]);

  return (
    <AuthLayout>
      <div className="p-6 flex flex-col h-screen">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">New Sale</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.filter(p => p.is_active).length} products available</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <POSTerminal products={products} locations={locations} categories={categories} />
        </div>
      </div>
    </AuthLayout>
  );
}
