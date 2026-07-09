import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { addDaysToKey, dateKeyToDate, formatDateKeyLong, todayKey } from "@/lib/date";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateKey = date ?? todayKey();
  const isToday = dateKey === todayKey();

  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
    include: {
      logEntries: {
        where: { date: dateKeyToDate(dateKey) },
        include: { _count: { select: { responses: true } } },
      },
      _count: { select: { checklistItems: { where: { archived: false } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Painel diário</h1>
          <p className="text-sm text-slate-500">{formatDateKeyLong(dateKey)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/?date=${addDaysToKey(dateKey, -1)}`}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            ← Dia anterior
          </Link>
          {!isToday && (
            <Link
              href="/"
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Hoje
            </Link>
          )}
          <Link
            href={`/?date=${addDaysToKey(dateKey, 1)}`}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Próximo dia →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {properties.map((property) => {
          const entry = property.logEntries[0];
          const totalItems = property._count.checklistItems;
          const filledItems = entry?._count.responses ?? 0;

          return (
            <Link
              key={property.id}
              href={`/properties/${property.slug}/${dateKey}`}
              className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="flex items-start justify-between">
                <h2 className="font-medium text-slate-900">{property.name}</h2>
                <StatusBadge status={entry?.status ?? "PENDENTE"} />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {entry ? `${filledItems} de ${totalItems} itens preenchidos` : "Logbook ainda não recebido"}
              </p>
              {entry?.reviewedAt && (
                <p className="mt-1 text-xs text-slate-400">
                  Revisado em {new Date(entry.reviewedAt).toLocaleString("pt-BR")}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
