"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav, names } from "@/lib/copy/en-GB";
import { cx } from "./ui";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ notesDot }: { notesDot: boolean }) {
  const pathname = usePathname();
  return (
    <>
      {/* Top bar (all sizes) */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            {names.product}
          </Link>
          <nav aria-label="Main" className="hidden gap-1 sm:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(pathname, n.href) ? "page" : undefined}
                className={cx(
                  "relative rounded-full px-3 py-1.5 text-sm",
                  isActive(pathname, n.href) ? "bg-surface-2 text-ink" : "text-muted hover:text-ink",
                )}
              >
                {n.label}
                {n.href === "/notes" && notesDot && (
                  <span aria-label="new" className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" />
                )}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {/* Bottom bar on phones */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="grid grid-cols-6">
          {nav.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={isActive(pathname, n.href) ? "page" : undefined}
                className={cx(
                  "relative flex h-14 items-center justify-center text-[11px]",
                  isActive(pathname, n.href) ? "font-semibold text-ink" : "text-muted",
                )}
              >
                {n.label}
                {n.href === "/notes" && notesDot && (
                  <span aria-label="new" className="absolute right-3 top-3 size-1.5 rounded-full bg-accent" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
