import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, formatFrenchDate, todayISODate } from "@/lib/date";
import type { CommonFood, FavoriteFood, MealEntry, MealType } from "@/lib/types/database";
import { FoodEntryFields, type FoodSuggestion } from "@/components/repas/FoodEntryFields";

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

  const canAddFood = columns.some((c) => c.canEdit);
  let suggestions: FoodSuggestion[] = [];
  if (canAddFood) {
    const [{ data: favorites }, { data: commonFoods }] = await Promise.all([
      supabase
        .from("favorite_foods")
        .select("*")
        .eq("user_id", user.id)
        .order("name")
        .returns<FavoriteFood[]>(),
      supabase
        .from("common_foods")
        .select("*")
        .order("sort_order")
        .returns<CommonFood[]>(),
    ]);

    const byName = new Map<string, FoodSuggestion>();
    for (const food of commonFoods ?? []) {
      byName.set(food.name.toLowerCase(), {
        name: food.name,
        quantity: food.default_quantity,
        calories: food.default_calories,
      });
    }
    // Mes propres favoris (historique) priment sur les suggestions génériques.
    for (const food of favorites ?? []) {
      byName.set(food.name.toLowerCase(), {
        name: food.name,
        quantity: food.default_quantity,
        calories: food.default_calories,
      });
    }
    suggestions = Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "fr"),
    );
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

      // Toujours mémoriser l'aliment : la prochaine fois, il est suggéré
      // avec sa quantité et ses calories déjà remplies.
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
        <h1 className="text-gradient font-heading text-3xl">Repas</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/repas?date=${prevDate}&vue=${vue}`}
            className="glass-card glass-card-hover px-3 py-1.5 text-sm text-foreground"
          >
            ← Veille
          </Link>
          <span className="font-numeric text-sm capitalize text-muted">
            {formatFrenchDate(date)}
            {isToday ? " · aujourd'hui" : ""}
          </span>
          <Link
            href={`/repas?date=${nextDate}&vue=${vue}`}
            className="glass-card glass-card-hover px-3 py-1.5 text-sm text-foreground"
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
                <div
                  key={section.code}
                  className="glass-card glass-card-hover p-4"
                >
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
                                className="btn-danger-ghost"
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

                      <FoodEntryFields
                        suggestions={suggestions}
                        listId="favorite-foods"
                      />

                      <button type="submit" className="btn-primary px-4 py-1.5">
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
        {suggestions.map((food) => (
          <option key={food.name} value={food.name} />
        ))}
      </datalist>
    </div>
  );
}
