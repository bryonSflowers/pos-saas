import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/app/lib/server-api";

export async function GET(req: NextRequest) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  const days = req.nextUrl.searchParams.get("days") ?? "30";
  const res = await fetch(`${SERVER_API_BASE}/api/v1/reports/top-products?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
