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

// Extracts a DD/MM, DD/MM/YY or DD/MM/YYYY date embedded in an e-mail subject
// (e.g. "LOGBOOK 10/07", "AUDITORIA 09/07/2026"), using referenceDate to fill
// in a missing year. Returns a "YYYY-MM-DD" key, or null if no date is found.
export function parseDateFromSubject(subject: string, referenceDate: Date): string | null {
  const match = subject.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  let year: number;
  if (match[3]) {
    year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  } else {
    year = referenceDate.getUTCFullYear();
    const candidate = new Date(Date.UTC(year, month - 1, day));
    const diffDays = (candidate.getTime() - referenceDate.getTime()) / 86_400_000;
    if (diffDays > 60) year -= 1;
  }

  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
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
