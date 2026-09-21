import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Identifiant technique fixe du compte admin (pas un secret : voir
// supabase/migrations/0005_admin_account_seed.sql). Jamais affiché ni
// demandé dans l'appli.
const ADMIN_ACCOUNT_EMAIL = "admin@sportcouple.internal";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  async function login(formData: FormData) {
    "use server";

    let email = String(formData.get("email") ?? "").trim();
    let password = String(formData.get("password") ?? "");

    // Raccourci "admin" / "admin" : substitue le vrai compte admin (créé
    // directement en base, voir migration 0005) sans jamais afficher ni
    // demander d'email dans le formulaire.
    if (
      email.toLowerCase() === "admin" &&
      password === "admin" &&
      process.env.ADMIN_SHORTCUT_PASSWORD
    ) {
      email = ADMIN_ACCOUNT_EMAIL;
      password = process.env.ADMIN_SHORTCUT_PASSWORD;
    }

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      redirect(
        "/login?error=" +
          encodeURIComponent("Email ou mot de passe incorrect."),
      );
    }

    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-sm p-8">
        <p className="font-heading text-sm uppercase tracking-[0.3em] text-primary">
          SportCouple
        </p>
        <h1 className="text-gradient mt-1 font-heading text-4xl">
          Connexion
        </h1>
        <p className="mt-1 text-sm text-muted">
          Retrouve ton suivi sportif et nutritionnel.
        </p>

        {message ? (
          <p className="mt-4 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <form action={login} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="text"
              name="email"
              required
              autoComplete="email"
              className="input-field"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Mot de passe
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="input-field"
            />
          </label>
          <button type="submit" className="btn-primary mt-2 w-full">
            Se connecter
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
