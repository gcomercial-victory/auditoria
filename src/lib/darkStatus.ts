import type { EntryStatus } from "@prisma/client";

// Dark-panel status styling for the redesigned Painel (dashboard). Kept
// separate from src/lib/status.ts, which is tuned for the still-light
// History/Property pages.
export const DARK_STATUS_LABEL: Record<EntryStatus, string> = {
  PENDENTE: "Pendente",
  RECEBIDO: "Recebido",
  VERIFICADO: "Verificado",
  DIVERGENCIA: "Divergência",
};

export const DARK_STATUS_DOT: Record<EntryStatus, string> = {
  PENDENTE: "bg-zinc-600",
  RECEBIDO: "bg-sky-400",
  VERIFICADO: "bg-emerald-400",
  DIVERGENCIA: "bg-amber-400",
};

export const DARK_STATUS_TEXT: Record<EntryStatus, string> = {
  PENDENTE: "text-zinc-500",
  RECEBIDO: "text-sky-300",
  VERIFICADO: "text-emerald-300",
  DIVERGENCIA: "text-amber-300",
};
