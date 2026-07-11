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
        className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
        title="Buscar novos logbooks/auditorias por e-mail"
      >
        {isPending ? "Sincronizando..." : "📥 Sincronizar e-mails"}
      </button>
      {state && (
        <span className={`text-xs ${isError ? "text-red-400" : "text-emerald-400"}`}>
          {state.startsWith("ok:") ? `${state.slice(3)} importado(s)` : state}
        </span>
      )}
    </form>
  );
}
