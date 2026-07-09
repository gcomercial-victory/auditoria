// LogEntry.date is stored as a UTC midnight Date representing a calendar day
// (no time-of-day meaning). These helpers keep that convention consistent
// between URL params ("YYYY-MM-DD"), the DB, and display.

export function dateKeyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function dateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return dateToKey(new Date());
}

export function addDaysToKey(key: string, days: number): string {
  const date = dateKeyToDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToKey(date);
}

export function formatDateKeyPtBr(key: string): string {
  const date = dateKeyToDate(key);
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateKeyLong(key: string): string {
  const date = dateKeyToDate(key);
  const formatted = date.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
