"use server";

import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/app/lib/server-api";

export type RegisterState = { error: string } | { success: string } | null;

export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const owner_email = formData.get("owner_email") as string;
  const owner_password = formData.get("owner_password") as string;
  const owner_full_name = formData.get("owner_full_name") as string;

  if (!name || !slug || !owner_email || !owner_password || !owner_full_name) {
    return { error: "All fields are required." };
  }

  try {
    const res = await fetch(`${SERVER_API_BASE}/api/v1/tenants/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, owner_email, owner_password, owner_full_name }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { error: data.detail ?? "Registration failed." };
    }
  } catch {
    return { error: "Cannot reach server. Please try again." };
  }

  redirect("/login");
}
