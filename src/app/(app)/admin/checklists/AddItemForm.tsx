"use client";

import { useActionState } from "react";
import { addChecklistItem } from "./actions";

export function AddItemForm({ propertyId }: { propertyId: string }) {
  const boundAction = addChecklistItem.bind(null, propertyId);
  const [state, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <input
        name="label"
        placeholder="Novo item do checklist"
        required
        className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
      <select name="type" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
        <option value="BOOLEAN">Sim/Não</option>
        <option value="NUMBER">Número</option>
        <option value="TEXT">Texto</option>
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {isPending ? "Adicionando..." : "Adicionar"}
      </button>
      {state && state !== "ok" && <p className="w-full text-xs text-red-600">{state}</p>}
    </form>
  );
}
