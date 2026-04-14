import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/app/lib/server-api";
import ZReportClient from "./ZReportClient";

export default async function ZReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  const res = await fetch(`${SERVER_API_BASE}/api/v1/shifts/${id}/report`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!res.ok) redirect("/shifts");
  const report = await res.json();

  return <ZReportClient report={report} />;
}
