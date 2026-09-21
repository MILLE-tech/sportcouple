"use client";

import { useState } from "react";

export type FoodSuggestion = {
  name: string;
  quantity: string | null;
  calories: number | null;
};

const QUICK_UNITS = ["g", "c. à café", "c. à soupe", "ml", "pièce"];

export function FoodEntryFields({
  suggestions,
  listId,
}: {
  suggestions: FoodSuggestion[];
  listId: string;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [calories, setCalories] = useState("");

  function handleNameChange(value: string) {
    setName(value);
    const match = suggestions.find(
      (s) => s.name.toLowerCase() === value.trim().toLowerCase(),
    );
    if (match) {
      setQuantity(match.quantity ?? "");
      setCalories(match.calories != null ? String(match.calories) : "");
    }
  }

  function applyUnit(unit: string) {
    const leadingNumber = quantity.match(/^(\d+(?:[.,]\d+)?)/)?.[1] ?? "1";
    setQuantity(`${leadingNumber} ${unit}`);
  }

  return (
    <>
      <label className="flex flex-1 basis-32 flex-col gap-1 text-xs text-muted">
        Aliment
        <input
          type="text"
          name="name"
          list={listId}
          required
          autoComplete="off"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="input-field py-1.5"
        />
      </label>
      <label className="flex basis-32 flex-col gap-1 text-xs text-muted">
        Quantité
        <input
          type="text"
          name="quantity"
          placeholder="150 g"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="input-field py-1.5"
        />
        <div className="flex flex-wrap gap-1 pt-0.5">
          {QUICK_UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => applyUnit(unit)}
              className="chip px-2 py-0.5 text-[10px]"
            >
              {unit}
            </button>
          ))}
        </div>
      </label>
      <label className="flex basis-20 flex-col gap-1 text-xs text-muted">
        Calories
        <input
          type="number"
          name="calories"
          min={0}
          step="1"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          className="input-field py-1.5"
        />
      </label>
    </>
  );
}
