"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/Badge";

/**
 * Fixed left sidebar — #132420 background, PhysioDesk wordmark,
 * primary-highlighted active nav item, and user profile + logout at the bottom.
 */

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Patients", href: "/patients" },
  { label: "Schedule", href: "/schedule" },
  { label: "Billing", href: "/billing" },
  { label: "Therapists", href: "/therapists" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-secondary">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-display text-lg font-bold text-white shadow-soft"
        >
          P
          <span className="sr-only">PhysioDesk</span>
        </span>
        <span className="font-display text-xl font-bold tracking-tight text-white">
          PhysioDesk
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-primary font-semibold text-white shadow-soft"
                  : "text-white/75 hover:bg-secondary-light hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile snippet */}
      <div className="border-t border-white/10 p-3">
        <div className="rounded-xl bg-secondary-light/60 px-3 py-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-body text-sm font-semibold text-white"
            >
              {(user?.full_name ?? "P U")
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">
                {user?.full_name ?? "Signed out"}
              </div>
              <div className="mt-0.5">
                <Badge variant={user?.role === "ADMIN" ? "success" : "neutral"}>
                  {user?.role ?? "GUEST"}
                </Badge>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
