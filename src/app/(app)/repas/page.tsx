import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, formatFrenchDate, todayISODate } from "@/lib/date";
import type { FavoriteFood, MealEntry, MealType } from "@/lib/types/database";

const MEAL_SECTIONS: { code: MealType; label: string }[] = [
  { code: "petit_dejeuner", label: "Petit-déjeuner" },
  { code: "dejeuner", label: "Déjeuner" },
  { code: "diner", label: "Dîner" },
  { code: "collation", label: "Collations" },
];

type Column = {
  userId: string;
  label: string;
  canEdit: boolean;
  byType: Record<MealType, MealEntry[]>;
  total: number | null;
};

export default async function RepasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; vue?: string }>;
}) {
  const { date: dateParam, vue: vueParam } = await searchParams;
  const date = dateParam ?? todayISODate();
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
  for (const target of targets) {
    const { data: entries } = await supabase
      .from("meal_entries")
      .select("*")
      .eq("user_id", target.id)
      .eq("entry_date", date)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<MealEntry[]>();

    const byType: Record<MealType, MealEntry[]> = {
      petit_dejeuner: [],
      dejeuner: [],
      diner: [],
      collation: [],
    };
    let total = 0;
    let hasCalories = false;
    for (const entry of entries ?? []) {
      byType[entry.meal_type].push(entry);
      if (entry.calories != null) {
        total += Number(entry.calories);
        hasCalories = true;
      }
    }

    columns.push({
      userId: target.id,
      label: target.label,
      canEdit: target.canEdit,
      byType,
      total: hasCalories ? total : null,
    });
  }

  let favorites: FavoriteFood[] = [];
  if (columns.some((c) => c.canEdit)) {
    const { data } = await supabase
      .from("favorite_foods")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    favorites = data ?? [];
  }

  async function addMealEntry(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const entryDate = String(formData.get("entry_date"));
    const vueValue = String(formData.get("vue"));
    const mealType = String(formData.get("meal_type"));
    const name = String(formData.get("name") ?? "").trim();
    const quantity = String(formData.get("quantity") ?? "").trim();
    const caloriesRaw = String(formData.get("calories") ?? "").trim();
    const saveFavorite = formData.get("save_favorite") === "on";

    if (name) {
      const calories = caloriesRaw ? Number(caloriesRaw) : null;

      await supabase.from("meal_entries").insert({
        user_id: user.id,
        entry_date: entryDate,
        meal_type: mealType,
        name,
        quantity: quantity || null,
        calories,
      });

      if (saveFavorite) {
        await supabase.from("favorite_foods").upsert(
          {
            user_id: user.id,
            name,
            default_quantity: quantity || null,
            default_calories: calories,
          },
          { onConflict: "user_id,name" },
        );
      }
    }

    revalidatePath("/repas");
    redirect(`/repas?date=${entryDate}&vue=${vueValue}`);
  }

  async function deleteMealEntry(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const id = String(formData.get("id"));
    const entryDate = String(formData.get("entry_date"));
    const vueValue = String(formData.get("vue"));

    await supabase.from("meal_entries").delete().eq("id", id);

    revalidatePath("/repas");
    redirect(`/repas?date=${entryDate}&vue=${vueValue}`);
  }

  const prevDate = addDaysISO(date, -1);
  const nextDate = addDaysISO(date, 1);
  const isToday = date === todayISODate();

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl text-foreground">Repas</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/repas?date=${prevDate}&vue=${vue}`}
            className="glass-card px-3 py-1.5 text-sm text-foreground"
          >
            ← Veille
          </Link>
          <span className="font-numeric text-sm capitalize text-muted">
            {formatFrenchDate(date)}
            {isToday ? " · aujourd'hui" : ""}
          </span>
          <Link
            href={`/repas?date=${nextDate}&vue=${vue}`}
            className="glass-card px-3 py-1.5 text-sm text-foreground"
          >
            Lendemain →
          </Link>
        </div>
      </div>

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
                {column.total !== null ? (
                  <span className="font-numeric text-sm text-primary">
                    {column.total} kcal
                  </span>
                ) : null}
              </div>

              {MEAL_SECTIONS.map((section) => (
                <div key={section.code} className="glass-card p-4">
                  <h3 className="font-heading text-lg text-foreground">
                    {section.label}
                  </h3>

                  <ul className="mt-2 flex flex-col gap-1">
                    {column.byType[section.code].map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-foreground">
                          {entry.name}
                          {entry.quantity ? (
                            <span className="text-muted"> · {entry.quantity}</span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-2">
                          {entry.calories != null ? (
                            <span className="font-numeric text-muted">
                              {entry.calories} kcal
                            </span>
                          ) : null}
                          {column.canEdit ? (
                            <form action={deleteMealEntry}>
                              <input type="hidden" name="id" value={entry.id} />
                              <input type="hidden" name="entry_date" value={date} />
                              <input type="hidden" name="vue" value={vue} />
                              <button
                                type="submit"
                                className="text-muted hover:text-danger"
                                aria-label="Supprimer"
                              >
                                ✕
                              </button>
                            </form>
                          ) : null}
                        </span>
                      </li>
                    ))}
                    {column.byType[section.code].length === 0 ? (
                      <li className="text-sm text-muted">
                        Rien pour l&apos;instant.
                      </li>
                    ) : null}
                  </ul>

                  {column.canEdit ? (
                    <form
                      action={addMealEntry}
                      className="mt-3 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="entry_date" value={date} />
                      <input type="hidden" name="vue" value={vue} />
                      <input type="hidden" name="meal_type" value={section.code} />

                      <label className="flex flex-1 basis-32 flex-col gap-1 text-xs text-muted">
                        Aliment
                        <input
                          type="text"
                          name="name"
                          list="favorite-foods"
                          required
                          className="rounded-lg border border-surface-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                        />
                      </label>
                      <label className="flex basis-24 flex-col gap-1 text-xs text-muted">
                        Quantité
                        <input
                          type="text"
                          name="quantity"
                          placeholder="150 g"
                          className="rounded-lg border border-surface-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                        />
                      </label>
                      <label className="flex basis-20 flex-col gap-1 text-xs text-muted">
                        Calories
                        <input
                          type="number"
                          name="calories"
                          min={0}
                          step="1"
                          className="rounded-lg border border-surface-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                        />
                      </label>
                      <label className="flex items-center gap-1 pb-1.5 text-xs text-muted">
                        <input type="checkbox" name="save_favorite" />
                        Favori
                      </label>
                      <button
                        type="submit"
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                      >
                        Ajouter
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <datalist id="favorite-foods">
        {favorites.map((food) => (
          <option key={food.id} value={food.name} />
        ))}
      </datalist>
    </div>
  );
}
