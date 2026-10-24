"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", match: "/", label: "カレンダー" },
  { href: "/analytics", match: "/analytics", label: "分析" },
  { href: "/settings/exercises", match: "/settings", label: "設定" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-background dark:border-neutral-800">
      <ul className="mx-auto flex max-w-md">
        {ITEMS.map(({ href, match, label }) => {
          const active = match === "/" ? pathname === "/" : pathname.startsWith(match);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 items-center justify-center text-sm ${
                  active ? "font-bold text-blue-600" : "text-neutral-500"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
