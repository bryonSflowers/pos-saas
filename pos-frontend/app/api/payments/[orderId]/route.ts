import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SERVER_API_BASE as API_BASE } from "@/app/lib/server-api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  try {
    const res = await fetch(`${API_BASE}/api/v1/payments/orders/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    try {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } catch {
      return NextResponse.json({ detail: `Backend error (${res.status})` }, { status: res.status });
    }
  } catch (e) {
    return NextResponse.json({ detail: `Cannot reach backend: ${e instanceof Error ? e.message : e}` }, { status: 503 });
  }
}
