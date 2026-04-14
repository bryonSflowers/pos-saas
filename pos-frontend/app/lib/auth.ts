import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export async function getToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) redirect("/login");
  return token;
}

export async function apiFetchAuth<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
    cache: "no-store",
    ...options,
  });
  if (res.status === 401) redirect("/login");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
