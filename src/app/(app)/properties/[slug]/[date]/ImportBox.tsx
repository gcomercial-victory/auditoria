"use client";

import { useActionState } from "react";
import { importFromSheetAction } from "./actions";

export function ImportBox({ propertyId, dateKey }: { propertyId: string; dateKey: string }) {
  const boundAction = importFromSheetAction.bind(null, propertyId, dateKey);
  const [state, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-medium text-slate-900">Importar do Google Sheets</h3>
      <p className="mt-1 text-xs text-slate-500">
        Cole o link da planilha (compartilhada como &quot;qualquer pessoa com o link&quot;). A
        planilha deve ter uma coluna &quot;Data&quot; e uma coluna por item do checklist.
      </p>
      <form action={formAction} className="mt-3 flex gap-2">
        <input
          name="sheetUrl"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          required
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? "Importando..." : "Importar"}
        </button>
      </form>
      {state && state !== "ok" && <p className="mt-2 text-xs text-red-600">{state}</p>}
      {state === "ok" && <p className="mt-2 text-xs text-emerald-600">Importado com sucesso.</p>}
    </div>
  );
}
