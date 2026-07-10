"use client";

import { useActionState } from "react";
import { syncEmailAction } from "@/app/actions/sync-actions";

export function SyncButton() {
  const [state, formAction, isPending] = useActionState(syncEmailAction, undefined);

  const isError = Boolean(state) && !state?.startsWith("ok:");

  return (
    <form action={formAction} className="flex items-center gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        title="Buscar novos logbooks/auditorias por e-mail"
      >
        {isPending ? "Sincronizando..." : "📥 Sincronizar e-mails"}
      </button>
      {state && (
        <span className={`text-xs ${isError ? "text-red-600" : "text-emerald-600"}`}>
          {state.startsWith("ok:") ? `${state.slice(3)} importado(s)` : state}
        </span>
      )}
    </form>
  );
}
