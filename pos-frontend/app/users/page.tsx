import AuthLayout from "@/app/components/AuthLayout";
import UsersClient from "./UsersClient";
import { apiFetchAuth } from "@/app/lib/auth";

type User = { id: string; full_name: string; email: string; role: string; is_active: boolean };

export default async function UsersPage() {
  const users = await apiFetchAuth<User[]>("/api/v1/users/").catch(() => [] as User[]);
  return (
    <AuthLayout>
      <div className="p-8">
        <UsersClient users={users} />
      </div>
    </AuthLayout>
  );
}
