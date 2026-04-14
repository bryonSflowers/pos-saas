"use server";

import { revalidatePath } from "next/cache";
import { apiFetchAuth } from "@/app/lib/auth";

export type UserFormState = { error: string } | null;

export async function createUserAction(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const body = {
    full_name: formData.get("full_name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    role: formData.get("role") as string,
  };
  if (!body.full_name || !body.email || !body.password) {
    return { error: "All fields are required." };
  }
  try {
    await apiFetchAuth("/api/v1/users/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    revalidatePath("/users");
    return null;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create user." };
  }
}

export async function toggleUserAction(id: string, isActive: boolean): Promise<void> {
  await apiFetchAuth(`/api/v1/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: !isActive }),
  });
  revalidatePath("/users");
}

export async function deleteUserAction(id: string): Promise<void> {
  await apiFetchAuth(`/api/v1/users/${id}`, { method: "DELETE" });
  revalidatePath("/users");
}
