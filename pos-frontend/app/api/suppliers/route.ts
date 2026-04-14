import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/app/lib/server-api";

async function getToken() {
  const store = await cookies();
  return store.get("access_token")?.value;
}

export async function GET() {
  const token = await getToken();
  const res = await fetch(`${SERVER_API_BASE}/api/v1/suppliers/`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(req: NextRequest) {
  const token = await getToken();
  const body = await req.json();
  const endpoint = body._type === "po" ? "/purchase-orders" : "/";
  delete body._type;
  const res = await fetch(`${SERVER_API_BASE}/api/v1/suppliers${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
