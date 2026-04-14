import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/app/lib/server-api";

export async function POST() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  const res = await fetch(`${SERVER_API_BASE}/api/v1/payments/stripe/connection-token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
