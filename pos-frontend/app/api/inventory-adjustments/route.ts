import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/app/lib/server-api";

async function getToken() {
  const store = await cookies();
  return store.get("access_token")?.value;
}

export async function GET(req: NextRequest) {
  const token = await getToken();
  const productId = req.nextUrl.searchParams.get("product_id") ?? "";
  const url = `${SERVER_API_BASE}/api/v1/inventory-adjustments/${productId ? `?product_id=${productId}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(req: NextRequest) {
  const token = await getToken();
  const res = await fetch(`${SERVER_API_BASE}/api/v1/inventory-adjustments/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(await req.json()),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
