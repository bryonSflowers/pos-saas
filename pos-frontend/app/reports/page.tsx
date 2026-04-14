import AuthLayout from "@/app/components/AuthLayout";
import ReportsClient from "./ReportsClient";
import { apiFetchAuth } from "@/app/lib/auth";

type SalesSummary = { date: string; order_count: number; revenue: string; tax: string; refunds: number };
type InventoryItem = { id: string; name: string; sku: string | null; stock_qty: number; price: string; is_active: boolean; low_stock_threshold: number | null };
type TopProduct = { product_name: string; quantity_sold: number; revenue: string };

export default async function ReportsPage() {
  const [sales, inventory, topProducts] = await Promise.all([
    apiFetchAuth<SalesSummary[]>("/api/v1/reports/sales?days=30").catch(() => [] as SalesSummary[]),
    apiFetchAuth<InventoryItem[]>("/api/v1/reports/inventory").catch(() => [] as InventoryItem[]),
    apiFetchAuth<TopProduct[]>("/api/v1/reports/top-products?days=30").catch(() => [] as TopProduct[]),
  ]);

  return (
    <AuthLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales performance and inventory overview</p>
        </div>
        <ReportsClient initialSales={sales} inventory={inventory} initialTopProducts={topProducts} />
      </div>
    </AuthLayout>
  );
}
