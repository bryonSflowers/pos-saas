import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/app/lib/server-api";

async function getToken() {
  const store = await cookies();
  return store.get("access_token")?.value;
}

export async function GET(req: NextRequest) {
  const token = await getToken();
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const url = `${SERVER_API_BASE}/api/v1/customers/?search=${encodeURIComponent(search)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const token = await getToken();
  const body = await req.json();
  const res = await fetch(`${SERVER_API_BASE}/api/v1/customers/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
