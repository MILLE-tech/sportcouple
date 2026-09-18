"use client";

import { useEffect, useState } from "react";

type Exercise = {
  id: string;
  name: string;
  target_muscles: string;
  sets: number;
  reps: string | null;
  duration_seconds: number | null;
  rest_seconds: number;
  description: string;
};

export function SessionPlayer({ exercises }: { exercises: Exercise[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [restRemaining, setRestRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (restRemaining === null || restRemaining <= 0) return;
    const timer = setTimeout(() => setRestRemaining((r) => (r ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [restRemaining]);

  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <p className="text-sm text-muted">
        {doneCount} / {exercises.length} exercices cochés
      </p>

      {exercises.map((ex) => (
        <div key={ex.id} className="glass-card flex flex-col gap-2 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={!!checked[ex.id]}
              onChange={(e) =>
                setChecked((c) => ({ ...c, [ex.id]: e.target.checked }))
              }
              className="mt-1 h-5 w-5 accent-primary"
            />
            <span className="flex-1">
              <span
                className={`font-heading text-lg ${
                  checked[ex.id] ? "text-muted line-through" : "text-foreground"
                }`}
              >
                {ex.name}
              </span>
              <span className="block text-xs text-muted">
                {ex.target_muscles}
              </span>
            </span>
          </label>

          <p className="text-sm text-muted">{ex.description}</p>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="chip">{ex.sets} séries</span>
            <span className="chip">
              {ex.duration_seconds ? `${ex.duration_seconds}s` : ex.reps}
            </span>
            <span className="chip">Repos {ex.rest_seconds}s</span>
          </div>

          <button
            type="button"
            onClick={() => setRestRemaining(ex.rest_seconds)}
            className="btn-ghost self-start px-3 py-1.5 text-xs"
          >
            Démarrer le repos
          </button>
        </div>
      ))}

      {restRemaining !== null ? (
        <div className="glass-card fixed bottom-24 left-1/2 z-20 -translate-x-1/2 px-8 py-4 text-center shadow-2xl md:bottom-8">
          <p className="text-xs uppercase tracking-widest text-muted">Repos</p>
          <p className="font-numeric text-4xl text-primary">
            {restRemaining}s
          </p>
        </div>
      ) : null}
    </div>
  );
}
