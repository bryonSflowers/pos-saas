"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navGroups = [
  {
    label: "Sales",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "▦", exact: false },
      { href: "/orders/new", label: "New Sale", icon: "＋", exact: true },
      { href: "/orders", label: "Orders", icon: "≡", exact: true },
      { href: "/shifts", label: "Cash Shifts", icon: "⊡", exact: false },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: "◫", exact: false },
      { href: "/categories", label: "Categories", icon: "⊞", exact: false },
      { href: "/inventory", label: "Inventory", icon: "◨", exact: false },
      { href: "/suppliers", label: "Suppliers", icon: "⊟", exact: false },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/customers", label: "Customers", icon: "◉", exact: false },
      { href: "/promotions", label: "Promotions", icon: "✦", exact: false },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/locations", label: "Locations", icon: "⌖", exact: false },
      { href: "/users", label: "Team", icon: "⊙", exact: false },
      { href: "/reports", label: "Reports", icon: "▲", exact: false },
      { href: "/settings/billing", label: "Billing", icon: "💳", exact: false },
      { href: "/settings", label: "Settings", icon: "⚙", exact: true },
    ],
  },
];

// Bottom tabs shown on mobile for quick access
const bottomTabs = [
  { href: "/dashboard", label: "Home", icon: "▦", exact: false },
  { href: "/orders/new", label: "Sale", icon: "＋", exact: true },
  { href: "/orders", label: "Orders", icon: "≡", exact: true },
  { href: "/customers", label: "Customers", icon: "◉", exact: false },
];

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <nav className="flex-1 py-3 flex flex-col gap-4 px-3 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{group.label}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active ? "bg-gray-700 text-white font-medium" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <span className="text-base w-4 text-center">{icon}</span>
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-3 pb-4 border-t border-gray-700 pt-3">
        <form action="/logout" method="POST">
          <button type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <span className="w-4 text-center">⎋</span> Sign out
          </button>
        </form>
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Prevent scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex w-56 shrink-0 bg-gray-900 text-gray-100 flex-col min-h-screen">
        <div className="px-6 py-5 border-b border-gray-700">
          <span className="text-lg font-bold tracking-tight">POS SaaS</span>
        </div>
        <NavContent />
      </aside>

      {/* ── Mobile top header ────────────────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-gray-900 text-white flex items-center px-4 h-14 gap-3">
        <button onClick={() => setDrawerOpen(true)} aria-label="Open menu"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-700 text-xl">
          ☰
        </button>
        <span className="font-bold tracking-tight">POS SaaS</span>
        <Link href="/orders/new"
          className="ml-auto px-3 py-1.5 bg-white text-gray-900 text-sm font-semibold rounded-lg">
          + Sale
        </Link>
      </header>

      {/* ── Mobile drawer overlay ─────────────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          {/* Drawer */}
          <aside className="relative w-72 max-w-[85vw] bg-gray-900 text-gray-100 flex flex-col h-full shadow-2xl animate-slide-in">
            <div className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
              <span className="text-lg font-bold tracking-tight">POS SaaS</span>
              <button onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 text-xl">
                ✕
              </button>
            </div>
            <NavContent onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Mobile bottom tab bar ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-900 border-t border-gray-700 flex">
        {bottomTabs.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
                active ? "text-white" : "text-gray-500"
              }`}>
              <span className="text-lg leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
        <button onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs text-gray-500">
          <span className="text-lg leading-none">☰</span>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
