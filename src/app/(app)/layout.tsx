import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV_ITEMS = [
  { href: "/repas", label: "Repas", icon: "🍽️" },
  { href: "/mensurations", label: "Mensurations", icon: "📏" },
  { href: "/poids", label: "Poids", icon: "⚖️" },
  { href: "/sport", label: "Sport", icon: "🏋️" },
  { href: "/progression", label: "Progression", icon: "📈" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, couple_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  if (!profile.couple_id) redirect("/couple-setup");

  const { data: partner } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("couple_id", profile.couple_id)
    .neq("id", user.id)
    .maybeSingle();

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden md:flex md:w-60 md:flex-shrink-0 md:flex-col md:border-r md:border-surface-border md:p-4">
        <div className="mb-8">
          <p className="font-heading text-2xl text-foreground">
            SportCouple
          </p>
          <p className="text-sm text-muted">
            {profile.first_name}
            {partner ? ` & ${partner.first_name}` : ""}
          </p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="glass-card flex items-center gap-3 px-3 py-2 text-sm text-foreground transition hover:border-primary"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-auto pt-4">
          <button
            type="submit"
            className="text-sm text-muted transition hover:text-danger"
          >
            Déconnexion
          </button>
        </form>
      </aside>

      <header className="flex items-center justify-between border-b border-surface-border p-4 md:hidden">
        <p className="font-heading text-xl text-foreground">SportCouple</p>
        <form action={signOut}>
          <button type="submit" className="text-sm text-muted">
            Déconnexion
          </button>
        </form>
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-surface-border bg-surface/90 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted"
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
