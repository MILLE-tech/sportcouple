export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISODate(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function formatFrenchDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
