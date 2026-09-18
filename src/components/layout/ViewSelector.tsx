"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "moi", label: "Moi" },
  { value: "partenaire", label: "Partenaire" },
  { value: "couple", label: "Les deux" },
] as const;

export function ViewSelector({ hasPartner }: { hasPartner: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("vue") ?? "moi";

  function setVue(vue: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("vue", vue);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="glass-card inline-flex gap-1 p-1">
      {OPTIONS.map((opt) => {
        const disabled = opt.value !== "moi" && !hasPartner;
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => setVue(opt.value)}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:text-foreground disabled:opacity-40 disabled:hover:text-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
