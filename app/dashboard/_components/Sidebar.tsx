"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/summary", label: "Daily summary" },
  { href: "/dashboard/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col border-r border-rule bg-panel px-4 py-6">
      <Link href="/dashboard" className="mb-8 block px-2">
        <span className="font-serif text-lg font-semibold leading-tight text-ink">
          Front Desk
        </span>
        <span className="mt-0.5 block text-xs text-ink-quiet">Call ledger</span>
      </Link>

      <ul className="flex flex-col gap-0.5">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-sm px-2 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-ink text-paper"
                    : "text-ink hover:bg-rule-quiet"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <form action={logout} className="mt-auto pt-6">
        <button type="submit" className="px-2 text-xs text-ink-quiet hover:text-ink hover:underline">
          Log out
        </button>
      </form>
    </nav>
  );
}
