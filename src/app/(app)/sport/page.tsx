import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, startOfISOWeek, todayISODate } from "@/lib/date";
import type {
  DailyStep,
  ExerciseVariant,
  WorkoutLog,
  WorkoutSessionType,
} from "@/lib/types/database";

type Column = {
  userId: string;
  label: string;
  canEdit: boolean;
  weekCount: number;
  history: WorkoutLog[];
  steps: DailyStep[];
  todaySteps: DailyStep | null;
};

export default async function SportPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; vue?: string; termine?: string }>;
}) {
  const {
    variant: variantParam,
    vue: vueParam,
    termine,
  } = await searchParams;
  const variant: ExerciseVariant =
    variantParam === "avec_halteres" ? "avec_halteres" : "sans_halteres";
  const vue =
    vueParam === "partenaire" || vueParam === "couple" ? vueParam : "moi";

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

  let partner: { id: string; first_name: string } | null = null;
  if (profile.couple_id) {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name")
      .eq("couple_id", profile.couple_id)
      .neq("id", user.id)
      .maybeSingle();
    partner = data;
  }

  const { data: sessionTypes } = await supabase
    .from("workout_session_types")
    .select("*")
    .order("sort_order")
    .returns<WorkoutSessionType[]>();

  const targets: { id: string; label: string; canEdit: boolean }[] = [];
  if (vue === "moi") {
    targets.push({ id: user.id, label: "Moi", canEdit: true });
  } else if (vue === "partenaire") {
    if (partner) {
      targets.push({ id: partner.id, label: partner.first_name, canEdit: false });
    }
  } else {
    targets.push({ id: user.id, label: "Moi", canEdit: true });
    if (partner) {
      targets.push({ id: partner.id, label: partner.first_name, canEdit: false });
    }
  }

  const monday = startOfISOWeek(todayISODate());
  const sunday = addDaysISO(monday, 6);
  const today = todayISODate();

  const columns: Column[] = [];
  for (const target of targets) {
    const { data: history } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", target.id)
      .order("performed_on", { ascending: false })
      .limit(10)
      .returns<WorkoutLog[]>();

    const { count } = await supabase
      .from("workout_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", target.id)
      .gte("performed_on", monday)
      .lte("performed_on", sunday);

    const { data: steps } = await supabase
      .from("daily_steps")
      .select("*")
      .eq("user_id", target.id)
      .order("recorded_on", { ascending: false })
      .limit(7)
      .returns<DailyStep[]>();

    columns.push({
      userId: target.id,
      label: target.label,
      canEdit: target.canEdit,
      weekCount: count ?? 0,
      history: history ?? [],
      steps: steps ?? [],
      todaySteps: (steps ?? []).find((s) => s.recorded_on === today) ?? null,
    });
  }

  async function saveSteps(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const vueValue = String(formData.get("vue"));
    const recordedOn = String(formData.get("recorded_on") || todayISODate());
    const stepsRaw = String(formData.get("steps") ?? "").trim();
    const steps = Number(stepsRaw);

    if (stepsRaw && Number.isFinite(steps) && steps >= 0) {
      await supabase.from("daily_steps").upsert(
        {
          user_id: user.id,
          recorded_on: recordedOn,
          steps,
        },
        { onConflict: "user_id,recorded_on" },
      );
    }

    revalidatePath("/sport");
    redirect(`/sport?vue=${vueValue}&variant=${variant}`);
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-gradient font-heading text-3xl">Sport</h1>
        <div className="glass-card inline-flex gap-1 p-1">
          <Link
            href={`/sport?variant=sans_halteres&vue=${vue}`}
            className="chip"
            data-active={variant === "sans_halteres"}
          >
            Sans haltères
          </Link>
          <Link
            href={`/sport?variant=avec_halteres&vue=${vue}`}
            className="chip"
            data-active={variant === "avec_halteres"}
          >
            Avec haltères
          </Link>
        </div>
      </div>

      {termine ? (
        <p className="mt-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Séance enregistrée, bravo !
        </p>
      ) : null}

      {vue !== "moi" && !partner ? (
        <p className="glass-card mt-6 p-4 text-sm text-muted">
          Ton/ta partenaire n&apos;a pas encore rejoint le couple.
        </p>
      ) : (
        <div
          className={`mt-6 grid gap-4 ${
            columns.length > 1 ? "md:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {columns.map((column) => (
            <div key={column.userId} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl text-foreground">
                  {column.label}
                </h2>
                <span className="font-numeric text-sm text-primary">
                  {column.weekCount}/3 cette semaine
                </span>
              </div>

              {column.canEdit ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(sessionTypes ?? []).map((s) => (
                    <Link
                      key={s.code}
                      href={`/sport/${s.code}?variant=${variant}`}
                      className="glass-card glass-card-hover flex flex-col gap-1 p-4"
                    >
                      <span className="font-heading text-lg text-foreground">
                        {s.code === "D" ? "Séance Bonus" : `Séance ${s.code}`}
                      </span>
                      <span className="text-xs text-muted">{s.focus}</span>
                      <span className="btn-primary mt-3 justify-center text-xs">
                        Commencer
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="glass-card p-4">
                <h3 className="font-heading text-base text-foreground">
                  Historique
                </h3>
                {column.history.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">
                    Aucune séance terminée pour l&apos;instant.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                    {column.history.map((log) => (
                      <li key={log.id} className="flex items-center justify-between">
                        <span>
                          {log.performed_on} ·{" "}
                          {log.session_code === "D"
                            ? "Séance Bonus"
                            : `Séance ${log.session_code}`}
                        </span>
                        <span className="text-xs">
                          {log.variant === "avec_halteres"
                            ? "Avec haltères"
                            : "Sans haltères"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="glass-card p-4">
                <h3 className="font-heading text-base text-foreground">
                  Pas quotidiens
                </h3>

                {column.canEdit ? (
                  <form
                    action={saveSteps}
                    className="mt-2 flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="vue" value={vue} />
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Date
                      <input
                        type="date"
                        name="recorded_on"
                        defaultValue={today}
                        className="input-field py-1.5"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Pas
                      <input
                        type="number"
                        name="steps"
                        min={0}
                        step="1"
                        required
                        defaultValue={column.todaySteps?.steps ?? ""}
                        className="input-field py-1.5"
                      />
                    </label>
                    <button type="submit" className="btn-primary px-4 py-1.5 text-sm">
                      {column.todaySteps ? "Mettre à jour" : "Enregistrer"}
                    </button>
                  </form>
                ) : null}

                {column.steps.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">
                    Aucun pas enregistré pour l&apos;instant.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                    {column.steps.map((s) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
