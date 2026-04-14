import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/app/lib/server-api";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  const { orderId } = await params;
  const res = await fetch(`${SERVER_API_BASE}/api/v1/payments/stripe/intent/${orderId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
