import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/app/lib/server-api";

export async function POST(req: NextRequest) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  const body = await req.json();
  const res = await fetch(`${SERVER_API_BASE}/api/v1/payments/stripe/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
