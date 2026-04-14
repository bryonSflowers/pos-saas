import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/app/lib/server-api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  const { id } = await params;
  const res = await fetch(`${SERVER_API_BASE}/api/v1/shifts/${id}/report`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
