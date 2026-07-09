import type { EntryStatus } from "@prisma/client";

export const STATUS_LABEL: Record<EntryStatus, string> = {
  PENDENTE: "Pendente",
  RECEBIDO: "Recebido",
  VERIFICADO: "Verificado",
  DIVERGENCIA: "Divergência",
};

export const STATUS_CLASSES: Record<EntryStatus, string> = {
  PENDENTE: "bg-slate-100 text-slate-600 border-slate-200",
  RECEBIDO: "bg-blue-50 text-blue-700 border-blue-200",
  VERIFICADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DIVERGENCIA: "bg-red-50 text-red-700 border-red-200",
};

export const STATUS_DOT: Record<EntryStatus, string> = {
  PENDENTE: "bg-slate-400",
  RECEBIDO: "bg-blue-500",
  VERIFICADO: "bg-emerald-500",
  DIVERGENCIA: "bg-red-500",
};
