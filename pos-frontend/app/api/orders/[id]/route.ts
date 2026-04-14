import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { SERVER_API_BASE as API_BASE } from "@/app/lib/server-api";

async function proxyPost(orderId: string, action: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${API_BASE}/api/v1/orders/${orderId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await req.json();
  if (!["void", "refund"].includes(action)) {
    return NextResponse.json({ detail: "Invalid action" }, { status: 400 });
  }
  return proxyPost(id, action);
}
