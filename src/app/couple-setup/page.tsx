import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Couple } from "@/lib/types/database";

function mapRpcError(message: string): string {
  switch (message) {
    case "already_in_couple":
      return "Tu fais déjà partie d'un couple.";
    case "invalid_code":
      return "Ce code d'invitation est invalide.";
    case "couple_full":
      return "Ce couple compte déjà deux membres.";
    default:
      return "Une erreur est survenue, réessaie.";
  }
}

export default async function CoupleSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  let couple: Couple | null = null;
  if (profile.couple_id) {
    const { data } = await supabase
      .from("couples")
      .select("*")
      .eq("id", profile.couple_id)
      .single();
    couple = data;
  }

  async function createCoupleAction() {
    "use server";
    const supabase = await createClient();
    const { error: rpcError } = await supabase.rpc("create_couple");
    if (rpcError) {
      redirect(
        "/couple-setup?error=" + encodeURIComponent(mapRpcError(rpcError.message)),
      );
    }
    redirect("/couple-setup");
  }

  async function joinCoupleAction(formData: FormData) {
    "use server";
    const code = String(formData.get("invite_code") ?? "");
    const supabase = await createClient();
    const { error: rpcError } = await supabase.rpc("join_couple", {
      p_invite_code: code,
    });
    if (rpcError) {
      redirect(
        "/couple-setup?error=" + encodeURIComponent(mapRpcError(rpcError.message)),
      );
    }
    redirect("/couple-setup");
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-sm p-6">
        <h1 className="font-heading text-3xl text-foreground">Ton couple</h1>

        {error ? (
          <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {couple ? (
          <div className="mt-6 flex flex-col gap-4">
            <p className="text-sm text-muted">
              Partage ce code à ton/ta partenaire pour qu&apos;il/elle
              rejoigne votre espace commun.
            </p>
            <p className="font-numeric text-center text-4xl tracking-[0.3em] text-primary">
              {couple.invite_code}
            </p>
            <Link
              href="/repas"
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-center font-medium text-primary-foreground transition hover:opacity-90"
            >
              Continuer vers l&apos;application
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            <div>
              <h2 className="font-heading text-xl">Créer un couple</h2>
              <p className="mt-1 text-sm text-muted">
                Génère un code à partager avec ton/ta partenaire.
              </p>
              <form action={createCoupleAction} className="mt-3">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90"
                >
                  Créer mon couple
                </button>
              </form>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-surface-border" />
              ou
              <span className="h-px flex-1 bg-surface-border" />
            </div>

            <div>
              <h2 className="font-heading text-xl">Rejoindre un couple</h2>
              <p className="mt-1 text-sm text-muted">
                Saisis le code à 6 caractères reçu de ton/ta partenaire.
              </p>
              <form
                action={joinCoupleAction}
                className="mt-3 flex flex-col gap-3"
              >
                <input
                  type="text"
                  name="invite_code"
                  required
                  maxLength={6}
                  placeholder="ABC123"
                  className="rounded-lg border border-surface-border bg-background px-3 py-2 text-center font-numeric text-lg uppercase tracking-[0.3em] text-foreground outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-surface-border px-4 py-2 font-medium text-foreground transition hover:border-primary"
                >
                  Rejoindre
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
