"use server";

import { revalidatePath } from "next/cache";
import { apiFetchAuth } from "@/app/lib/auth";

export type ProductFormState = { error: string } | null;

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const body: Record<string, unknown> = {
    name: formData.get("name") as string,
    price: parseFloat(formData.get("price") as string),
    stock_qty: parseInt((formData.get("stock_qty") as string) || "0"),
    sku: (formData.get("sku") as string) || null,
    description: (formData.get("description") as string) || null,
    category_id: (formData.get("category_id") as string) || null,
    track_inventory: formData.get("track_inventory") !== "false",
  };
  try {
    await apiFetchAuth("/api/v1/products/", { method: "POST", body: JSON.stringify(body) });
    revalidatePath("/products");
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create product.";
    try { return { error: JSON.parse(msg).detail ?? msg }; } catch { return { error: msg }; }
  }
}

export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const id = formData.get("id") as string;
  const body: Record<string, unknown> = {
    name: formData.get("name") as string,
    price: parseFloat(formData.get("price") as string),
    stock_qty: parseInt((formData.get("stock_qty") as string) || "0"),
    is_active: formData.get("is_active") === "true",
    category_id: (formData.get("category_id") as string) || null,
    description: (formData.get("description") as string) || null,
  };
  try {
    await apiFetchAuth(`/api/v1/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    revalidatePath("/products");
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update product.";
    try { return { error: JSON.parse(msg).detail ?? msg }; } catch { return { error: msg }; }
  }
}

export async function deleteProductAction(id: string): Promise<void> {
  await apiFetchAuth(`/api/v1/products/${id}`, { method: "DELETE" });
  revalidatePath("/products");
}
