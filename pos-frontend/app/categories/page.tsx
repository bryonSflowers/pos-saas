import AuthLayout from "@/app/components/AuthLayout";
import CategoriesClient from "./CategoriesClient";
import { apiFetchAuth } from "@/app/lib/auth";

type Category = { id: string; name: string; color: string | null };

export default async function CategoriesPage() {
  const categories = await apiFetchAuth<Category[]>("/api/v1/categories/").catch(() => [] as Category[]);
  return (
    <AuthLayout>
      <div className="p-8">
        <CategoriesClient categories={categories} />
      </div>
    </AuthLayout>
  );
}
