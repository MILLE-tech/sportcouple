"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  icon,
  label,
  variant,
}: {
  href: string;
  icon: string;
  label: string;
  variant: "sidebar" | "bottom";
}) {
  const pathname = usePathname();
  const active = pathname === href;

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
          active ? "text-primary" : "text-muted"
        }`}
      >
        <span className="text-lg">{icon}</span>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`glass-card glass-card-hover flex items-center gap-3 px-3 py-2 text-sm transition ${
        active ? "border-primary/60 text-primary" : "text-foreground"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
