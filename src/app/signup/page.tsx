import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Sex } from "@/lib/types/database";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function signup(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const firstName = String(formData.get("first_name") ?? "").trim();
    const sex = String(formData.get("sex") ?? "") as Sex;
    const birthDate = String(formData.get("birth_date") ?? "");
    const heightCm = String(formData.get("height_cm") ?? "");

    if (!email || !password || !firstName || !sex || !birthDate || !heightCm) {
      redirect(
        "/signup?error=" +
          encodeURIComponent("Merci de remplir tous les champs."),
      );
    }

    const supabase = await createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          sex,
          birth_date: birthDate,
          height_cm: Number(heightCm),
        },
      },
    });

    if (signUpError) {
      redirect("/signup?error=" + encodeURIComponent(signUpError.message));
    }

    if (data.session) {
      redirect("/couple-setup");
    }

    redirect(
      "/login?message=" +
        encodeURIComponent(
          "Compte créé ! Vérifie tes emails pour confirmer ton adresse, puis connecte-toi.",
        ),
    );
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-sm p-6">
        <h1 className="font-heading text-3xl text-foreground">
          Créer un compte
        </h1>
        <p className="mt-1 text-sm text-muted">
          Un profil par personne, un couple partagé.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <form action={signup} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Prénom
            <input
              type="text"
              name="first_name"
              required
              className="rounded-lg border border-surface-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>

          <fieldset className="flex flex-col gap-1 text-sm">
            <legend>Sexe</legend>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2">
                <input type="radio" name="sex" value="femme" required />
                Femme
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="sex" value="homme" required />
                Homme
              </label>
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            Date de naissance
            <input
              type="date"
              name="birth_date"
              required
              className="rounded-lg border border-surface-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Taille (cm)
            <input
              type="number"
              name="height_cm"
              min={100}
              max={250}
              step="0.1"
              required
              className="rounded-lg border border-surface-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>

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
              minLength={6}
              autoComplete="new-password"
              className="rounded-lg border border-surface-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90"
          >
            Créer mon compte
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
