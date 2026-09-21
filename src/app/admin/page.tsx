import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  BodyMeasurement,
  Couple,
  DailyStep,
  MealEntry,
  Profile,
  WeightEntry,
  WorkoutLog,
} from "@/lib/types/database";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { user: selectedUserId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) redirect("/");

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at")
    .returns<Profile[]>();

  const { data: allCouples } = await supabase
    .from("couples")
    .select("*")
    .order("created_at")
    .returns<Couple[]>();

  const profilesByCouple = new Map<string, Profile[]>();
  const orphanProfiles: Profile[] = [];
  for (const p of allProfiles ?? []) {
    if (p.couple_id) {
      const list = profilesByCouple.get(p.couple_id) ?? [];
      list.push(p);
      profilesByCouple.set(p.couple_id, list);
    } else if (!p.is_admin) {
      orphanProfiles.push(p);
    }
  }

  const selectedProfile = selectedUserId
    ? (allProfiles ?? []).find((p) => p.id === selectedUserId)
    : null;

  let meals: MealEntry[] = [];
  let weights: WeightEntry[] = [];
  let measurements: BodyMeasurement[] = [];
  let workouts: WorkoutLog[] = [];
  let steps: DailyStep[] = [];

  if (selectedProfile) {
    const [
      { data: mealsData },
      { data: weightsData },
      { data: measurementsData },
      { data: workoutsData },
      { data: stepsData },
    ] = await Promise.all([
      supabase
        .from("meal_entries")
        .select("*")
        .eq("user_id", selectedProfile.id)
        .order("entry_date", { ascending: false })
        .limit(30)
        .returns<MealEntry[]>(),
      supabase
        .from("weight_entries")
        .select("*")
        .eq("user_id", selectedProfile.id)
        .order("measured_on", { ascending: false })
        .returns<WeightEntry[]>(),
      supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", selectedProfile.id)
        .order("measured_on", { ascending: false })
        .returns<BodyMeasurement[]>(),
      supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", selectedProfile.id)
        .order("performed_on", { ascending: false })
        .limit(20)
        .returns<WorkoutLog[]>(),
      supabase
        .from("daily_steps")
        .select("*")
        .eq("user_id", selectedProfile.id)
        .order("recorded_on", { ascending: false })
        .limit(30)
        .returns<DailyStep[]>(),
    ]);
    meals = mealsData ?? [];
    weights = weightsData ?? [];
    measurements = measurementsData ?? [];
    workouts = workoutsData ?? [];
    steps = stepsData ?? [];
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.3em] text-primary">
            SportCouple
          </p>
          <h1 className="text-gradient font-heading text-3xl">
            Admin (lecture seule)
          </h1>
        </div>
        <form action={signOut}>
          <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">
            Déconnexion
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="glass-card p-4">
          <h2 className="font-heading text-lg text-foreground">Couples</h2>
          {(allCouples ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aucun couple pour l&apos;instant.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {(allCouples ?? []).map((c) => (
                <li key={c.id} className="text-sm">
                  <p className="font-numeric text-xs text-muted">
                    Code {c.invite_code} · créé le {c.created_at.slice(0, 10)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(profilesByCouple.get(c.id) ?? []).map((p) => (
                      <Link
                        key={p.id}
                        href={`/admin?user=${p.id}`}
                        className="chip"
                        data-active={selectedProfile?.id === p.id}
                      >
                        {p.first_name} ({p.sex})
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card p-4">
          <h2 className="font-heading text-lg text-foreground">
            Comptes sans couple
          </h2>
          {orphanProfiles.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aucun.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {orphanProfiles.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin?user=${p.id}`}
                  className="chip"
                  data-active={selectedProfile?.id === p.id}
                >
                  {p.first_name} ({p.sex})
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedProfile ? (
        <div className="mt-6 flex flex-col gap-4">
          <h2 className="font-heading text-xl text-foreground">
            Données de {selectedProfile.first_name}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card p-4">
              <h3 className="font-heading text-base text-foreground">
                Repas récents
              </h3>
              {meals.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Aucune donnée.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  {meals.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <span>
                        {m.entry_date} · {m.meal_type} · {m.name}
                        {m.quantity ? ` (${m.quantity})` : ""}
                      </span>
                      {m.calories != null ? (
                        <span className="font-numeric text-foreground">
                          {m.calories} kcal
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="glass-card p-4">
              <h3 className="font-heading text-base text-foreground">Poids</h3>
              {weights.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Aucune donnée.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  {weights.map((w) => (
                    <li key={w.id} className="flex items-center justify-between">
                      <span>{w.measured_on}</span>
                      <span className="font-numeric text-foreground">
                        {w.weight_kg} kg
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="glass-card p-4">
              <h3 className="font-heading text-base text-foreground">
                Mensurations
              </h3>
              {measurements.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Aucune donnée.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  {measurements.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <span>
                        {m.measured_on} · {m.measurement_type}
                      </span>
                      <span className="font-numeric text-foreground">
                        {m.value_cm} cm
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="glass-card p-4">
              <h3 className="font-heading text-base text-foreground">
                Séances de sport
              </h3>
              {workouts.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Aucune donnée.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  {workouts.map((w) => (
                    <li key={w.id} className="flex items-center justify-between">
                      <span>
                        {w.performed_on} · Séance {w.session_code}
                      </span>
                      <span className="text-xs">
                        {w.variant === "avec_halteres" ? "Avec haltères" : "Sans haltères"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="glass-card p-4 md:col-span-2">
              <h3 className="font-heading text-base text-foreground">
                Pas quotidiens
              </h3>
              {steps.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Aucune donnée.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  {steps.map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>{s.recorded_on}</span>
                      <span className="font-numeric text-foreground">
                        {s.steps.toLocaleString("fr-FR")} pas
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Sélectionne une personne ci-dessus pour voir le détail de ses données.
        </p>
      )}
    </div>
  );
}
