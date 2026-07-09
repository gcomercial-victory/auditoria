"use client";

import { useActionState } from "react";
import type { EntryStatus } from "@prisma/client";
import { StatusBadge } from "@/components/StatusBadge";
import { reviewEntryAction } from "./actions";

export function ReviewPanel({
  entryId,
  status,
  reviewedByName,
  reviewedAt,
  reviewNotes,
}: {
  entryId: string;
  status: EntryStatus;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string | null;
}) {
  const boundAction = reviewEntryAction.bind(null, entryId);
  const [state, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-900">Auditoria / revisão</h2>
        <StatusBadge status={status} />
      </div>

      {reviewedByName && (
        <p className="mt-1 text-xs text-slate-500">
          Última revisão por {reviewedByName}
          {reviewedAt && ` em ${new Date(reviewedAt).toLocaleString("pt-BR")}`}
        </p>
      )}

      <form action={formAction} className="mt-3 space-y-3">
        <textarea
          name="reviewNotes"
          defaultValue={reviewNotes ?? ""}
          placeholder="Notas da auditoria (opcional)"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="decision"
            value="VERIFICADO"
            disabled={isPending}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            ✓ Marcar verificado
          </button>
          <button
            type="submit"
            name="decision"
            value="DIVERGENCIA"
            disabled={isPending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            ⚠ Marcar divergência
          </button>
          <button
            type="submit"
            name="decision"
            value="PENDENTE"
            disabled={isPending}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Voltar para pendente
          </button>
        </div>
      </form>

      {state && state !== "ok" && <p className="mt-2 text-xs text-red-600">{state}</p>}
    </div>
  );
}
