import { NextResponse } from "next/server";

export async function GET() {
  const apiUrl = process.env.API_URL;
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const resolvedUrl = apiUrl ?? publicApiUrl ?? "NOT SET — will use http://localhost:8000";

  let health = "not tested";
  let dbTables: string[] = [];
  let loginResult = "not tested";
  let loginBody = "";

  if (apiUrl || publicApiUrl) {
    const base = apiUrl ?? publicApiUrl!;

    try {
      const h = await fetch(`${base}/health`, { cache: "no-store" });
      health = `${h.status} ${await h.text()}`;
    } catch (e) {
      health = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
    }

    try {
      const d = await fetch(`${base}/health/db`, { cache: "no-store" });
      const j = await d.json();
      health += ` | DB: ${j.status}`;
      dbTables = j.tables ?? [];
    } catch (e) {
      health += ` | DB check failed: ${e instanceof Error ? e.message : String(e)}`;
    }

    try {
      const r = await fetch(`${base}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@test.com", password: "test", tenant_slug: "test" }),
        cache: "no-store",
      });
      loginResult = `${r.status}`;
      loginBody = await r.text();
    } catch (e) {
      loginResult = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    env: {
      API_URL: apiUrl ?? "NOT SET",
      NEXT_PUBLIC_API_URL: publicApiUrl ?? "NOT SET",
      resolved_to: resolvedUrl,
    },
    health,
    db_tables: dbTables,
    login_endpoint: { status: loginResult, body: loginBody },
    fix_instructions: !apiUrl && !publicApiUrl
      ? "Go to Vercel → Project → Settings → Environment Variables → add API_URL = https://your-railway-url.up.railway.app"
      : "API_URL is set — check health/login_endpoint for connection errors",
  });
}
