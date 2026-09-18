import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getISOWeek, todayISODate } from "@/lib/date";
import type { WeightEntry } from "@/lib/types/database";

type Column = {
  userId: string;
  label: string;
  canEdit: boolean;
  entries: WeightEntry[];
  current: WeightEntry | null;
  totalDelta: number | null;
};

export default async function PoidsPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const { vue: vueParam } = await searchParams;
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

  const columns: Column[] = [];
  const { isoYear, isoWeek } = getISOWeek(todayISODate());

  for (const target of targets) {
    const { data: entries } = await supabase
      .from("weight_entries")
      .select("*")
      .eq("user_id", target.id)
      .order("measured_on", { ascending: false })
      .returns<WeightEntry[]>();

    const rows = entries ?? [];
    const current =
      rows.find((e) => e.iso_year === isoYear && e.iso_week === isoWeek) ?? null;
    const first = rows.length > 0 ? rows[rows.length - 1] : null;
    const latest = rows[0] ?? null;
    const totalDelta =
      latest && first && latest.id !== first.id
        ? Number(latest.weight_kg) - Number(first.weight_kg)
        : null;

    columns.push({
      userId: target.id,
      label: target.label,
      canEdit: target.canEdit,
      entries: rows,
      current,
      totalDelta,
    });
  }

  async function saveWeight(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const vueValue = String(formData.get("vue"));
    const measuredOn = String(formData.get("measured_on") || todayISODate());
    const weightRaw = String(formData.get("weight_kg") ?? "").trim();
    const weight = Number(weightRaw);

    if (weightRaw && Number.isFinite(weight) && weight > 0) {
      await supabase.from("weight_entries").upsert(
        {
          user_id: user.id,
          measured_on: measuredOn,
          weight_kg: weight,
        },
        { onConflict: "user_id,iso_year,iso_week" },
      );
    }

    revalidatePath("/poids");
    redirect(`/poids?vue=${vueValue}`);
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-gradient font-heading text-3xl">Poids</h1>
      <p className="mt-1 text-sm text-muted">
        Semaine ISO {isoWeek} · {isoYear}
      </p>

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
              <h2 className="font-heading text-xl text-foreground">
                {column.label}
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card p-4">
                  <p className="text-xs text-muted">Dernier poids</p>
                  <p className="font-numeric text-2xl text-foreground">
                    {column.entries[0]
                      ? `${column.entries[0].weight_kg} kg`
                      : "—"}
                  </p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs text-muted">
                    Variation depuis la 1ère pesée
                  </p>
                  <p
                    className={`font-numeric text-2xl ${
                      column.totalDelta === null
                        ? "text-foreground"
                        : column.totalDelta < 0
                          ? "text-success"
                          : column.totalDelta > 0
                            ? "text-danger"
                            : "text-foreground"
                    }`}
                  >
                    {column.totalDelta === null
                      ? "—"
                      : `${column.totalDelta > 0 ? "+" : ""}${column.totalDelta.toFixed(1)} kg`}
                  </p>
                </div>
              </div>

              {column.canEdit ? (
                <form
                  action={saveWeight}
                  className="glass-card flex flex-wrap items-end gap-3 p-4"
                >
                  <input type="hidden" name="vue" value={vue} />
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Date
                    <input
                      type="date"
                      name="measured_on"
                      defaultValue={column.current?.measured_on ?? todayISODate()}
                      className="input-field py-1.5"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Poids (kg)
                    <input
                      type="number"
                      name="weight_kg"
                      min={0}
                      step="0.1"
                      required
                      defaultValue={column.current?.weight_kg ?? ""}
                      className="input-field py-1.5"
                    />
                  </label>
                  <button type="submit" className="btn-primary">
                    {column.current
                      ? "Mettre à jour cette semaine"
                      : "Enregistrer cette semaine"}
                  </button>
                </form>
              ) : null}

              <div className="glass-card p-4">
                <h3 className="font-heading text-base text-foreground">
                  Historique
                </h3>
                {column.entries.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">
                    Aucune pesée enregistrée.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {column.entries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between text-muted"
                      >
                        <span>
                          {entry.measured_on}{" "}
                          <span className="text-xs">
                            (S{entry.iso_week} · {entry.iso_year})
                          </span>
                        </span>
                        <span className="font-numeric text-foreground">
                          {entry.weight_kg} kg
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
