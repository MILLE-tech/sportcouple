import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

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
      <div className="glass-card w-full max-w-sm p-6">
        <h1 className="font-heading text-3xl text-foreground">
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
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-lg border border-surface-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Mot de passe
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="rounded-lg border border-surface-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90"
          >
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
