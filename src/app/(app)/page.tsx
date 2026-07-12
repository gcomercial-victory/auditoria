import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDaysToKey, dateKeyToDate, formatDateKeyLong, todayKey } from "@/lib/date";
import { DARK_STATUS_DOT, DARK_STATUS_LABEL, DARK_STATUS_TEXT } from "@/lib/darkStatus";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, LayersIcon, WarningTriangleIcon } from "@/components/dashboard/icons";
import { BUSINESS_LOGBOOK_RAW_LABEL, SUITES_AUDIT_RAW_LABEL } from "@/lib/checklistLabels";
import type { EntryStatus } from "@prisma/client";

type LabeledResponse = { templateItem: { label: string }; valueText: string | null };

function hasContent(responses: LabeledResponse[], label: string): boolean {
  return Boolean(responses.find((r) => r.templateItem.label === label)?.valueText?.trim());
}

function formatTime(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage({
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

  const businessEntry = business?.logEntries[0];
  const suitesEntry = suites?.logEntries[0];

  const entryIds = [businessEntry?.id, suitesEntry?.id].filter((id): id is string => Boolean(id));
  const processedToday = entryIds.length
    ? await prisma.processedEmail.findMany({
        where: { logEntryId: { in: entryIds } },
        orderBy: { emailDate: "asc" },
        include: { property: true },
      })
    : [];

  const businessLogbookEmail = processedToday.find(
    (p) => p.propertyId === business?.id && (p.emailSubject ?? "").toUpperCase().includes("LOGBOOK")
  );
  const suitesAuditEmail = processedToday.find((p) => p.propertyId === suites?.id);

  const auditRows: { name: string; status: EntryStatus; time: string | null }[] = [
    { name: "Victory Business", status: businessEntry?.status ?? "PENDENTE", time: formatTime(businessEntry?.createdAt) },
    { name: "Victory Suites", status: suitesEntry?.status ?? "PENDENTE", time: formatTime(suitesEntry?.createdAt) },
  ];

  // Central de Reservas isn't a third unit alongside Business/Suites — it
  // audits both of them — so it doesn't get its own row here. Its fields
  // are visible on the dedicated /reservas view instead.
  const logbookRows: { name: string; received: boolean; time: string | null }[] = [
    {
      name: "Business (LOGBOOK)",
      received: businessEntry ? hasContent(businessEntry.responses, BUSINESS_LOGBOOK_RAW_LABEL) : false,
      time: formatTime(businessLogbookEmail?.emailDate),
    },
    {
      name: "Suites (AUDITORIA)",
      received: suitesEntry ? hasContent(suitesEntry.responses, SUITES_AUDIT_RAW_LABEL) : false,
      time: formatTime(suitesAuditEmail?.emailDate),
    },
  ];

  const activities = [...processedToday].reverse().slice(0, 8);

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="mb-2">
          <p className="text-lg font-bold leading-none tracking-wide text-white">VICTORY</p>
          <p className="text-[10px] font-medium tracking-[0.35em] text-zinc-400">HOTÉIS</p>
        </div>
        <h1 className="text-xl font-semibold tracking-wide text-white sm:text-2xl">
          VERIFICAÇÃO DIÁRIA DE AUDITORIA E LOGBOOKS
        </h1>
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">{formatDateKeyLong(dateKey)}</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={`/?date=${addDaysToKey(dateKey, -1)}`}
          className="rounded-full border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>
        <DashboardTabs active="geral" dateKey={dateKey} />
        <Link
          href={`/?date=${addDaysToKey(dateKey, 1)}`}
          className="rounded-full border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>
      {!isToday && (
        <p className="mt-2 text-center">
          <Link href="/" className="text-xs text-zinc-500 underline hover:text-zinc-300">
            Voltar para hoje
          </Link>
        </p>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white">
            <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
            Auditoria Diária
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {auditRows.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-3">
                <span className="text-zinc-300">{row.name}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${DARK_STATUS_TEXT[row.status]}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${DARK_STATUS_DOT[row.status]}`} />
                  {DARK_STATUS_LABEL[row.status]}
                  {row.time && ` (${row.time})`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white">
            <WarningTriangleIcon className="h-4 w-4 text-amber-400" />
            Logbooks do Dia
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {logbookRows.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-3">
                <span className="text-zinc-300">{row.name}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${row.received ? "text-emerald-300" : "text-zinc-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${row.received ? "bg-emerald-400" : "bg-zinc-600"}`} />
                  {row.received ? "Recebido" : "Pendente"}
                  {row.time && ` (${row.time})`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white">
            <LayersIcon className="h-4 w-4 text-sky-400" />
            E-mails Sincronizados
          </div>
          <p className="mt-4 text-xs uppercase tracking-wide text-zinc-500">Total do dia</p>
          <p className="text-3xl font-semibold text-white">{processedToday.length}</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Atividades do Dia</h2>
        <div className="mt-3 space-y-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-white">
                  {activity.emailSubject || "(sem assunto)"} <span className="text-zinc-500">— {activity.property.name}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {activity.emailFrom}
                  {formatTime(activity.emailDate) && ` · ${formatTime(activity.emailDate)}`}
                </p>
              </div>
              <Link
                href={`/properties/${activity.property.slug}/${dateKey}`}
                className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Ver detalhes
              </Link>
            </div>
          ))}
          {activities.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
              Nenhuma atividade registrada neste dia.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
