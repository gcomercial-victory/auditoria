import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDaysToKey, dateKeyToDate, formatDateKeyLong, todayKey } from "@/lib/date";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/dashboard/icons";
import { RESERVAS_NOTES_LABEL, RESERVAS_RAW_LABEL } from "@/lib/checklistLabels";

type LabeledResponse = { templateItem: { label: string }; valueText: string | null };

function findText(responses: LabeledResponse[], label: string): string | null {
  const value = responses.find((r) => r.templateItem.label === label)?.valueText;
  return value?.trim() ? value : null;
}

// Central de Reservas audits both hotels rather than filing its own logbook,
// so this page reads its fields off both properties' entries for the day
// instead of being backed by a "unit" of its own.
export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateKey = date ?? todayKey();
  const isToday = dateKey === todayKey();
  const dateObj = dateKeyToDate(dateKey);

  const [business, suites] = await Promise.all([
    prisma.property.findUnique({
      where: { slug: "victory-business" },
      include: { logEntries: { where: { date: dateObj }, include: { responses: { include: { templateItem: true } } } } },
    }),
    prisma.property.findUnique({
      where: { slug: "victory-suites" },
      include: { logEntries: { where: { date: dateObj }, include: { responses: { include: { templateItem: true } } } } },
    }),
  ]);

  const blocks = [
    { property: business, entry: business?.logEntries[0] },
    { property: suites, entry: suites?.logEntries[0] },
  ];

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="mb-2">
          <p className="text-lg font-bold leading-none tracking-wide text-white">VICTORY</p>
          <p className="text-[10px] font-medium tracking-[0.35em] text-zinc-400">HOTÉIS</p>
        </div>
        <h1 className="text-xl font-semibold tracking-wide text-white sm:text-2xl">CENTRAL DE RESERVAS</h1>
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">{formatDateKeyLong(dateKey)}</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={`/reservas?date=${addDaysToKey(dateKey, -1)}`}
          className="rounded-full border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>
        <DashboardTabs active="reservas" dateKey={dateKey} />
        <Link
          href={`/reservas?date=${addDaysToKey(dateKey, 1)}`}
          className="rounded-full border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>
      {!isToday && (
        <p className="mt-2 text-center">
          <Link href="/reservas" className="text-xs text-zinc-500 underline hover:text-zinc-300">
            Voltar para hoje
          </Link>
        </p>
      )}

      <p className="mx-auto mt-6 max-w-xl text-center text-xs text-zinc-500">
        A Central de Reservas audita as duas unidades — não é uma unidade separada. Os registros abaixo vêm das
        respostas dela nas threads de auditoria de cada hotel.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {blocks.map(({ property, entry }) => {
          if (!property) return null;
          const notes = entry ? findText(entry.responses, RESERVAS_NOTES_LABEL) : null;
          const raw = entry ? findText(entry.responses, RESERVAS_RAW_LABEL) : null;

          return (
            <div key={property.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">{property.name}</h2>
                <Link
                  href={`/properties/${property.slug}/${dateKey}`}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                >
                  Ver entrada completa
                </Link>
              </div>

              {!notes && !raw && (
                <p className="mt-4 rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
                  Central de Reservas ainda não respondeu nesta data.
                </p>
              )}

              {notes && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Instruções/atualizações</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{notes}</p>
                </div>
              )}

              {raw && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Registro bruto da thread</p>
                  <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-3 text-xs text-zinc-300">
                    {raw}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
