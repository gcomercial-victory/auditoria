"use client";

import { useActionState } from "react";
import { uploadEntryFileAction } from "./actions";

export function UploadBox({
  propertyId,
  dateKey,
  currentFileUrl,
  currentFileName,
}: {
  propertyId: string;
  dateKey: string;
  currentFileUrl?: string | null;
  currentFileName?: string | null;
}) {
  const boundAction = uploadEntryFileAction.bind(null, propertyId, dateKey);
  const [state, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-medium text-slate-900">Arquivo original do logbook</h3>
      <p className="mt-1 text-xs text-slate-500">
        Anexe o PDF/foto/planilha recebido da recepção como referência.
      </p>

      {currentFileUrl && (
        <a
          href={currentFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          📎 {currentFileName ?? "Ver arquivo anexado"}
        </a>
      )}

      <form action={formAction} className="mt-3 flex gap-2">
        <input
          type="file"
          name="file"
          required
          className="flex-1 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {isPending ? "Enviando..." : "Enviar"}
        </button>
      </form>
      {state && state !== "ok" && <p className="mt-2 text-xs text-red-600">{state}</p>}
    </div>
  );
}
