import AuthLayout from "@/app/components/AuthLayout";
import LocationsClient from "./LocationsClient";
import { apiFetchAuth } from "@/app/lib/auth";

type Location = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  currency: string;
  tax_rate: number;
  is_active: boolean;
};

export default async function LocationsPage() {
  const locations = await apiFetchAuth<Location[]>("/api/v1/locations/").catch(() => [] as Location[]);

  return (
    <AuthLayout>
      <div className="p-8">
        <LocationsClient locations={locations} />
      </div>
    </AuthLayout>
  );
}
