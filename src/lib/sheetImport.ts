import { parseCsv } from "./csv";

// Accepts a normal "shared" Google Sheets URL and rewrites it to the CSV
// export endpoint. Also accepts an already-CSV/pub URL unchanged.
export function toCsvExportUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  if (url.searchParams.get("format") === "csv" || url.searchParams.get("output") === "csv") {
    return url.toString();
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error("URL não parece ser de uma planilha do Google Sheets.");
  }
  const sheetId = match[1];
  const gid = url.hash.match(/gid=(\d+)/)?.[1] ?? url.searchParams.get("gid") ?? "0";

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const DATE_HEADER_CANDIDATES = ["data", "date", "dia"];

function parseCellDate(value: string): string | null {
  const trimmed = value.trim();

  // YYYY-MM-DD
  let m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD/MM/YYYY or DD-MM-YYYY
  m = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    return `${m[3]}-${month}-${day}`;
  }

  return null;
}

export interface SheetRowMatch {
  header: string[];
  row: string[];
}

// Wide format: one row per day, one column per checklist item (matched by
// header label). A "Data" column identifies which row belongs to which day.
export function findRowForDate(rows: string[][], dateKey: string): SheetRowMatch | null {
  if (rows.length < 2) return null;
  const header = rows[0];
  const dateColIndex = header.findIndex((h) => DATE_HEADER_CANDIDATES.includes(normalizeHeader(h)));
  if (dateColIndex === -1) return null;

  for (let i = rows.length - 1; i >= 1; i--) {
    const row = rows[i];
    const cellDate = parseCellDate(row[dateColIndex] ?? "");
    if (cellDate === dateKey) {
      return { header, row };
    }
  }
  return null;
}

export function matchColumnForLabel(header: string[], label: string): number {
  const target = normalizeHeader(label);
  let idx = header.findIndex((h) => normalizeHeader(h) === target);
  if (idx !== -1) return idx;

  // fall back to partial match (e.g. sheet header "Caixa inicial" vs template "Caixa inicial (R$)")
  idx = header.findIndex((h) => {
    const nh = normalizeHeader(h);
    return nh.length > 2 && (target.includes(nh) || nh.includes(target));
  });
  return idx;
}

export { parseCsv };
