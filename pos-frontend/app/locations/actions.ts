"use server";

import { revalidatePath } from "next/cache";
import { apiFetchAuth } from "@/app/lib/auth";

export type LocationFormState = { error: string } | null;

export async function createLocationAction(
  _prev: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const body = {
    name: formData.get("name") as string,
    address: (formData.get("address") as string) || null,
    phone: (formData.get("phone") as string) || null,
    currency: (formData.get("currency") as string) || "USD",
    tax_rate: parseFloat((formData.get("tax_rate") as string) || "0"),
  };
  if (!body.name) return { error: "Name is required." };
  try {
    await apiFetchAuth("/api/v1/locations/", { method: "POST", body: JSON.stringify(body) });
    revalidatePath("/locations");
    return null;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create location." };
  }
}

export async function updateLocationAction(
  id: string,
  _prev: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const body = {
    name: formData.get("name") as string,
    address: (formData.get("address") as string) || null,
    phone: (formData.get("phone") as string) || null,
    currency: (formData.get("currency") as string) || "USD",
    tax_rate: parseFloat((formData.get("tax_rate") as string) || "0"),
  };
  try {
    await apiFetchAuth(`/api/v1/locations/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    revalidatePath("/locations");
    return null;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update location." };
  }
}

export async function deleteLocationAction(id: string): Promise<void> {
  await apiFetchAuth(`/api/v1/locations/${id}`, { method: "DELETE" });
  revalidatePath("/locations");
}
