"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/app/lib/server-api";

export type LoginState = { error: string } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const tenant_slug = formData.get("tenant_slug") as string;

  if (!email || !password || !tenant_slug) {
    return { error: "All fields are required." };
  }

  let token: string;
  try {
    const res = await fetch(`${SERVER_API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, tenant_slug }),
    });
    if (!res.ok) {
      try {
        const data = await res.json();
        return { error: data.detail ?? `Login failed (${res.status}).` };
      } catch {
        return { error: `Server error (${res.status}). Please try again.` };
      }
    }
    const data = await res.json();
    token = data.access_token;
  } catch (err) {
    return { error: `Cannot reach server: ${err instanceof Error ? err.message : String(err)}` };
  }

  const cookieStore = await cookies();
  cookieStore.set("access_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  redirect("/dashboard");
}
