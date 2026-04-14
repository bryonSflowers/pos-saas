import AuthLayout from "@/app/components/AuthLayout";
import { apiFetchAuth } from "@/app/lib/auth";
import SettingsClient from "./SettingsClient";
import { redirect } from "next/navigation";
import Link from "next/link";

type Me = { id: string; full_name: string; email: string; role: string };

export default async function SettingsPage() {
  const me = await apiFetchAuth<Me>("/api/v1/users/me").catch(() => null);
  if (!me) redirect("/login");
  return (
    <AuthLayout>
      <div className="p-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your account and preferences</p>
        </div>

        {/* Account info card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Account</h2>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{me.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-900">{me.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Role</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                {me.role}
              </span>
            </div>
          </div>
        </div>

        <SettingsClient userId={me.id} />

        {/* Billing shortcut */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Billing & Subscription</h3>
            <p className="text-xs text-gray-500 mt-0.5">Manage your plan, view usage, and update payment info.</p>
          </div>
          <Link href="/settings/billing"
            className="shrink-0 ml-4 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
            Manage Billing →
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
