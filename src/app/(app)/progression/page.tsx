import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subtractMonthsISO, todayISODate } from "@/lib/date";
import { ProgressionChart } from "@/components/progression/ProgressionChart";
import type {
  BodyMeasurement,
  MeasurementCode,
  MeasurementType,
  Sex,
  WeightEntry,
} from "@/lib/types/database";

const RANGES = [
  { value: "1m", label: "1 mois" },
  { value: "3m", label: "3 mois" },
  { value: "6m", label: "6 mois" },
  { value: "all", label: "Tout" },
] as const;

function rangeCutoff(range: string): string | null {
  const today = todayISODate();
  if (range === "1m") return subtractMonthsISO(today, 1);
  if (range === "3m") return subtractMonthsISO(today, 3);
  if (range === "6m") return subtractMonthsISO(today, 6);
  return null;
}

export default async function ProgressionPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; mesure?: string }>;
}) {
  const { range: rangeParam, mesure: mesureParam } = await searchParams;
  const range = RANGES.some((r) => r.value === rangeParam) ? rangeParam! : "3m";
  const cutoff = rangeCutoff(range);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, sex, couple_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  let partner: { id: string; first_name: string; sex: Sex } | null = null;
  if (profile.couple_id) {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, sex")
      .eq("couple_id", profile.couple_id)
      .neq("id", user.id)
      .maybeSingle();
    partner = data;
  }

  // --- Poids ---
  let weightQuery = supabase
    .from("weight_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("measured_on", { ascending: true });
  if (cutoff) weightQuery = weightQuery.gte("measured_on", cutoff);
  const { data: myWeights } = await weightQuery.returns<WeightEntry[]>();

  let partnerWeights: WeightEntry[] = [];
  if (partner) {
    let q = supabase
      .from("weight_entries")
      .select("*")
      .eq("user_id", partner.id)
      .order("measured_on", { ascending: true });
    if (cutoff) q = q.gte("measured_on", cutoff);
    const { data } = await q.returns<WeightEntry[]>();
    partnerWeights = data ?? [];
  }

  const weightDates = new Set<string>();
  (myWeights ?? []).forEach((w) => weightDates.add(w.measured_on));
  partnerWeights.forEach((w) => weightDates.add(w.measured_on));
  const myWeightMap = new Map((myWeights ?? []).map((w) => [w.measured_on, Number(w.weight_kg)]));
  const partnerWeightMap = new Map(partnerWeights.map((w) => [w.measured_on, Number(w.weight_kg)]));
  const weightChartData = Array.from(weightDates)
    .sort()
    .map((date) => ({
      date,
      a: myWeightMap.get(date) ?? null,
      b: partnerWeightMap.get(date) ?? null,
    }));

  // --- Résumé ---
  const { data: allMyWeights } = await supabase
    .from("weight_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("measured_on", { ascending: true })
    .returns<WeightEntry[]>();
  const currentWeight = allMyWeights?.[allMyWeights.length - 1]?.weight_kg ?? null;
  const totalVariation =
    allMyWeights && allMyWeights.length > 1
      ? Number(allMyWeights[allMyWeights.length - 1].weight_kg) -
        Number(allMyWeights[0].weight_kg)
      : null;

  const monthStart = todayISODate().slice(0, 7) + "-01";
  const { count: sessionsThisMonth } = await supabase
    .from("workout_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("performed_on", monthStart);

  // --- Mensurations secondaires ---
  const { data: allTypes } = await supabase
    .from("measurement_types")
    .select("*")
    .order("sort_order")
    .returns<MeasurementType[]>();

  const relevantTypes = (allTypes ?? []).filter(
    (t) =>
      t.applies_to === "tous" ||
      t.applies_to === profile.sex ||
      (partner && t.applies_to === partner.sex),
  );

  const selectedType: MeasurementCode =
    (relevantTypes.find((t) => t.code === mesureParam)?.code as MeasurementCode) ??
    relevantTypes[0]?.code;

  let measurementChartData: { date: string; a: number | null; b: number | null }[] = [];
  if (selectedType) {
    let myQuery = supabase
      .from("body_measurements")
      .select("*")
      .eq("user_id", user.id)
      .eq("measurement_type", selectedType)
      .order("measured_on", { ascending: true });
    if (cutoff) myQuery = myQuery.gte("measured_on", cutoff);
    const { data: myMeasurements } = await myQuery.returns<BodyMeasurement[]>();

    let partnerMeasurements: BodyMeasurement[] = [];
    if (partner) {
      let q = supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", partner.id)
        .eq("measurement_type", selectedType)
        .order("measured_on", { ascending: true });
      if (cutoff) q = q.gte("measured_on", cutoff);
      const { data } = await q.returns<BodyMeasurement[]>();
      partnerMeasurements = data ?? [];
    }

    const mDates = new Set<string>();
    (myMeasurements ?? []).forEach((m) => mDates.add(m.measured_on));
    partnerMeasurements.forEach((m) => mDates.add(m.measured_on));
    const myMap = new Map((myMeasurements ?? []).map((m) => [m.measured_on, Number(m.value_cm)]));
    const partnerMap = new Map(partnerMeasurements.map((m) => [m.measured_on, Number(m.value_cm)]));
    measurementChartData = Array.from(mDates)
      .sort()
      .map((date) => ({
        date,
        a: myMap.get(date) ?? null,
        b: partnerMap.get(date) ?? null,
      }));
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-gradient font-heading text-3xl">Progression</h1>
        <div className="glass-card inline-flex gap-1 p-1">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/progression?range=${r.value}${selectedType ? `&mesure=${selectedType}` : ""}`}
              className="chip"
              data-active={range === r.value}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass-card p-4">
          <p className="text-xs text-muted">Poids actuel</p>
          <p className="font-numeric text-2xl text-foreground">
            {currentWeight !== null ? `${currentWeight} kg` : "—"}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted">Variation totale</p>
          <p
            className={`font-numeric text-2xl ${
              totalVariation === null
                ? "text-foreground"
                : totalVariation < 0
                  ? "text-success"
                  : totalVariation > 0
                    ? "text-danger"
                    : "text-foreground"
            }`}
          >
            {totalVariation === null
              ? "—"
              : `${totalVariation > 0 ? "+" : ""}${totalVariation.toFixed(1)} kg`}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted">Séances ce mois</p>
          <p className="font-numeric text-2xl text-foreground">
            {sessionsThisMonth ?? 0}
          </p>
        </div>
      </div>

      <div className="glass-card mt-6 p-4">
        <h2 className="font-heading text-lg text-foreground">
          Évolution du poids
        </h2>
        <div className="mt-2">
          <ProgressionChart
            data={weightChartData}
            labelA="Moi"
            labelB={partner ? partner.first_name : null}
            unit=" kg"
          />
        </div>
      </div>

      {relevantTypes.length > 0 ? (
        <div className="glass-card mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg text-foreground">
              Mensuration
            </h2>
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="range" value={range} />
              <select
                name="mesure"
                defaultValue={selectedType}
                className="input-field py-1.5 text-sm"
              >
                {relevantTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label_fr}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                Afficher
              </button>
            </form>
          </div>
          <div className="mt-2">
            <ProgressionChart
              data={measurementChartData}
              labelA="Moi"
              labelB={partner ? partner.first_name : null}
              unit=" cm"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
