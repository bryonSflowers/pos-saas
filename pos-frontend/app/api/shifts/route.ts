import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/app/lib/server-api";

async function getToken() {
  const store = await cookies();
  return store.get("access_token")?.value;
}

export async function GET(req: NextRequest) {
  const token = await getToken();
  const path = req.nextUrl.searchParams.get("current") === "1" ? "/current" : "/";
  const res = await fetch(`${SERVER_API_BASE}/api/v1/shifts${path}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(req: NextRequest) {
  const token = await getToken();
  const body = await req.json();
  const endpoint = body._action === "open" ? "/open" : "/";
  delete body._action;
  const res = await fetch(`${SERVER_API_BASE}/api/v1/shifts${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
