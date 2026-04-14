"use server";

import { revalidatePath } from "next/cache";
import { apiFetchAuth } from "@/app/lib/auth";

export type CategoryFormState = { error: string } | null;

export async function createCategoryAction(
  _prev: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const name = formData.get("name") as string;
  const color = (formData.get("color") as string) || null;
  if (!name) return { error: "Name is required." };
  try {
    await apiFetchAuth("/api/v1/categories/", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    });
    revalidatePath("/categories");
    return null;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create category." };
  }
}

export async function deleteCategoryAction(id: string): Promise<void> {
  await apiFetchAuth(`/api/v1/categories/${id}`, { method: "DELETE" });
  revalidatePath("/categories");
}
