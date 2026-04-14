import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/app/lib/server-api";
import AuthLayout from "@/app/components/AuthLayout";
import ShiftsClient from "./ShiftsClient";

async function getData(token: string) {
  const [shiftsRes, locationsRes] = await Promise.all([
    fetch(`${SERVER_API_BASE}/api/v1/shifts/`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    fetch(`${SERVER_API_BASE}/api/v1/locations/`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
  ]);
  return {
    shifts: shiftsRes.ok ? await shiftsRes.json() : [],
    locations: locationsRes.ok ? await locationsRes.json() : [],
  };
}

export default async function ShiftsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  const { shifts, locations } = await getData(token);
  return (
    <AuthLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Cash Shifts</h1>
          <p className="text-sm text-gray-500 mt-1">Open and close cash drawer shifts, track reconciliation</p>
        </div>
        <ShiftsClient initialShifts={shifts} locations={locations} />
      </div>
    </AuthLayout>
  );
}
