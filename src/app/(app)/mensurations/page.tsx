import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISODate } from "@/lib/date";
import type { BodyMeasurement, MeasurementType, Sex } from "@/lib/types/database";

type TypeEntry = {
  measured_on: string;
  value_cm: number;
  delta: number | null;
};

type TypeHistory = {
  type: MeasurementType;
  entries: TypeEntry[];
};

type Column = {
  userId: string;
  label: string;
  canEdit: boolean;
  histories: TypeHistory[];
};

export default async function MensurationsPage({
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

  const { data: allTypes } = await supabase
    .from("measurement_types")
    .select("*")
    .order("sort_order")
    .returns<MeasurementType[]>();

  const targets: { id: string; label: string; sex: Sex; canEdit: boolean }[] = [];
  if (vue === "moi") {
    targets.push({ id: user.id, label: "Moi", sex: profile.sex, canEdit: true });
  } else if (vue === "partenaire") {
    if (partner) {
      targets.push({
        id: partner.id,
        label: partner.first_name,
        sex: partner.sex,
        canEdit: false,
      });
    }
  } else {
    targets.push({ id: user.id, label: "Moi", sex: profile.sex, canEdit: true });
    if (partner) {
      targets.push({
        id: partner.id,
        label: partner.first_name,
        sex: partner.sex,
        canEdit: false,
      });
    }
  }

  const columns: Column[] = [];
  for (const target of targets) {
    const relevantTypes = (allTypes ?? []).filter(
      (t) => t.applies_to === "tous" || t.applies_to === target.sex,
    );

    const { data: measurements } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("user_id", target.id)
      .order("measured_on", { ascending: true })
      .returns<BodyMeasurement[]>();

    const histories: TypeHistory[] = relevantTypes.map((type) => {
      const rows = (measurements ?? []).filter(
        (m) => m.measurement_type === type.code,
      );
      const entries: TypeEntry[] = rows.map((row, i) => ({
        measured_on: row.measured_on,
        value_cm: Number(row.value_cm),
        delta: i === 0 ? null : Number(row.value_cm) - Number(rows[i - 1].value_cm),
      }));
      entries.reverse();
      return { type, entries };
    });

    columns.push({
      userId: target.id,
      label: target.label,
      canEdit: target.canEdit,
      histories,
    });
  }

  async function addMeasurements(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const measuredOn = String(formData.get("measured_on") || todayISODate());
    const vueValue = String(formData.get("vue"));

    const codes: MeasurementType["code"][] = [
      "poitrine",
      "pectoraux",
      "taille",
      "hanches",
      "cuisses",
      "mollets",
      "bras",
    ];

    const rows = codes
      .map((code) => {
        const raw = String(formData.get(code) ?? "").trim();
        if (!raw) return null;
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) return null;
        return {
          user_id: user.id,
          measurement_type: code,
          measured_on: measuredOn,
          value_cm: value,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length > 0) {
      await supabase
        .from("body_measurements")
        .upsert(rows, { onConflict: "user_id,measurement_type,measured_on" });
    }

    revalidatePath("/mensurations");
    redirect(`/mensurations?vue=${vueValue}`);
  }

  const editableTypes =
    columns.find((c) => c.canEdit)?.histories.map((h) => h.type) ?? [];

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-gradient font-heading text-3xl">Mensurations</h1>
      <p className="mt-1 text-sm text-muted">
        Le poids se gère dans l&apos;onglet Poids.
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

              {column.canEdit ? (
                <form
                  action={addMeasurements}
                  className="glass-card flex flex-col gap-3 p-4"
                >
                  <input type="hidden" name="vue" value={vue} />
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Date
                    <input
                      type="date"
                      name="measured_on"
                      defaultValue={todayISODate()}
                      className="input-field py-1.5"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {editableTypes.map((type) => (
                      <label
                        key={type.code}
                        className="flex flex-col gap-1 text-xs text-muted"
                      >
                        {type.label_fr} (cm)
                        <input
                          type="number"
                          name={type.code}
                          min={0}
                          step="0.1"
                          className="input-field py-1.5"
                        />
                      </label>
                    ))}
                  </div>
                  <button type="submit" className="btn-primary mt-1 self-start">
                    Enregistrer
                  </button>
                </form>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {column.histories.map(({ type, entries }) => {
                  const latest = entries[0];
                  return (
                    <div
                      key={type.code}
                      className="glass-card glass-card-hover p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-heading text-base text-foreground">
                          {type.label_fr}
                        </h3>
                        {latest ? (
                          <span className="font-numeric text-lg text-foreground">
                            {latest.value_cm} cm
                          </span>
                        ) : null}
                      </div>

                      {entries.length === 0 ? (
                        <p className="mt-2 text-sm text-muted">
                          Aucune mesure enregistrée.
                        </p>
                      ) : (
                        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                          {entries.slice(0, 5).map((entry) => {
                            const improving =
                              entry.delta !== null &&
                              (type.lower_is_better
                                ? entry.delta < 0
                                : entry.delta > 0);
                            const worsening =
                              entry.delta !== null &&
                              (type.lower_is_better
                                ? entry.delta > 0
                                : entry.delta < 0);
                            return (
                              <li
                                key={entry.measured_on}
                                className="flex items-center justify-between"
                              >
                                <span>{entry.measured_on}</span>
                                <span className="flex items-center gap-2">
                                  <span className="font-numeric text-foreground">
                                    {entry.value_cm} cm
                                  </span>
                                  {entry.delta !== null ? (
                                    <span
                                      className={`font-numeric ${
                                        improving
                                          ? "text-success"
                                          : worsening
                                            ? "text-danger"
                                            : "text-muted"
                                      }`}
                                    >
                                      {entry.delta > 0 ? "+" : ""}
                                      {entry.delta.toFixed(1)}
                                    </span>
                                  ) : null}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
