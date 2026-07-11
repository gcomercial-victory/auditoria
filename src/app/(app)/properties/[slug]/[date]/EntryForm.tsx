"use client";

import { useActionState } from "react";
import type { ChecklistItemTemplate, ChecklistItemResponse, ItemStatus } from "@prisma/client";
import { saveEntryAction } from "./actions";
import { IMMUTABLE_VALUE_LABELS } from "@/lib/checklistLabels";

const IMMUTABLE_LABELS = new Set(IMMUTABLE_VALUE_LABELS);

const STATUS_OPTIONS: { value: ItemStatus; label: string; activeClass: string }[] = [
  { value: "OK", label: "✓ OK", activeClass: "has-checked:border-emerald-600 has-checked:bg-emerald-600 has-checked:text-white" },
  {
    value: "PENDENTE",
    label: "Pendente",
    activeClass: "has-checked:border-amber-500 has-checked:bg-amber-500 has-checked:text-white",
  },
  { value: "PROBLEMA", label: "Problema", activeClass: "has-checked:border-red-600 has-checked:bg-red-600 has-checked:text-white" },
];

type Props = {
  propertyId: string;
  dateKey: string;
  templates: ChecklistItemTemplate[];
  responseByTemplate: Record<string, ChecklistItemResponse>;
  previousByTemplate: Record<string, ChecklistItemResponse>;
  submittedBy: string;
  notes: string;
};

export function EntryForm({
  propertyId,
  dateKey,
  templates,
  responseByTemplate,
  previousByTemplate,
  submittedBy,
  notes,
}: Props) {
  const boundAction = saveEntryAction.bind(null, propertyId, dateKey);
  const [state, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-medium text-slate-900">Checklist do logbook</h2>
      <p className="mt-1 text-sm text-slate-500">
        Preencha os valores recebidos da recepção e marque a conferência de cada item.
      </p>

      <div className="mt-4 space-y-4">
        {templates.map((item) => {
          const response = responseByTemplate[item.id];
          const previous = previousByTemplate[item.id];
          const isImmutable = IMMUTABLE_LABELS.has(item.label);
          return (
            <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="text-sm font-medium text-slate-800" htmlFor={`item_${item.id}`}>
                  {item.label}
                  {isImmutable && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400">(imutável — definido pelo e-mail)</span>
                  )}
                </label>
                {item.type === "NUMBER" && previous?.valueNumber != null && (
                  <span className="text-xs text-slate-400">
                    Dia anterior: {previous.valueNumber.toLocaleString("pt-BR")}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isImmutable ? (
                  <p className="w-full max-w-md rounded-md border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-700">
                    {response?.valueText || <span className="text-slate-400">(sem valor)</span>}
                  </p>
                ) : (
                  <>
                    {item.type === "BOOLEAN" && (
                      <select
                        id={`item_${item.id}`}
                        name={`item_${item.id}`}
                        defaultValue={response?.valueBoolean == null ? "" : String(response.valueBoolean)}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">—</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    )}
                    {item.type === "NUMBER" && (
                      <input
                        id={`item_${item.id}`}
                        name={`item_${item.id}`}
                        type="number"
                        step="any"
                        defaultValue={response?.valueNumber ?? ""}
                        className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    )}
                    {item.type === "TEXT" && (
                      <textarea
                        id={`item_${item.id}`}
                        name={`item_${item.id}`}
                        defaultValue={response?.valueText ?? ""}
                        rows={2}
                        className="w-full max-w-md rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    )}
                  </>
                )}

                <div className="flex gap-1.5" role="radiogroup" aria-label="Conferência do auditor">
                  {STATUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`cursor-pointer rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition ${opt.activeClass}`}
                    >
                      <input
                        type="radio"
                        name={`status_${item.id}`}
                        value={opt.value}
                        defaultChecked={(response?.status ?? "OK") === opt.value}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                <input
                  name={`note_${item.id}`}
                  defaultValue={response?.note ?? ""}
                  placeholder="observação (opcional)"
                  className="min-w-[10rem] flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="submittedBy">
            Enviado por (recepção)
          </label>
          <input
            id="submittedBy"
            name="submittedBy"
            defaultValue={submittedBy}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="notes">
            Observações gerais
          </label>
          <input
            id="notes"
            name="notes"
            defaultValue={notes}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {state && state !== "ok" && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {state}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {isPending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
