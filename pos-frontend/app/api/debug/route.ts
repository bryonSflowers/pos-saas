import { NextResponse } from "next/server";

export async function GET() {
  const apiUrl = process.env.API_URL ?? "NOT SET";

  let healthTest = "unknown";
  let dbHealth = "unknown";
  let loginTest = "unknown";
  let loginBody = "unknown";

  try {
    const h = await fetch(`${apiUrl}/health`, { cache: "no-store" });
    healthTest = `${h.status} - ${await h.text()}`;
  } catch (err) {
    healthTest = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  try {
    const d = await fetch(`${apiUrl}/health/db`, { cache: "no-store" });
    dbHealth = await d.text();
  } catch (err) {
    dbHealth = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  try {
    const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "x@x.com", password: "x", tenant_slug: "x" }),
      cache: "no-store",
    });
    loginTest = `${res.status}`;
    loginBody = await res.text();
  } catch (err) {
    loginTest = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({ API_URL: apiUrl, health: healthTest, db: dbHealth, login_status: loginTest, login_body: loginBody });
}
