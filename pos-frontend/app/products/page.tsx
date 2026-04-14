import AuthLayout from "@/app/components/AuthLayout";
import ProductsClient from "./ProductsClient";
import { apiFetchAuth } from "@/app/lib/auth";

type Product = { id: string; name: string; sku: string | null; price: string; stock_qty: number; is_active: boolean; description: string | null; category_id: string | null };
type Category = { id: string; name: string; color: string | null };

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    apiFetchAuth<Product[]>("/api/v1/products/").catch(() => [] as Product[]),
    apiFetchAuth<Category[]>("/api/v1/categories/").catch(() => [] as Category[]),
  ]);

  return (
    <AuthLayout>
      <div className="p-8">
        <ProductsClient products={products} categories={categories} />
      </div>
    </AuthLayout>
  );
}
