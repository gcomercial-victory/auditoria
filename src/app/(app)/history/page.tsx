import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { dateToKey } from "@/lib/date";
import type { EntryStatus } from "@prisma/client";

const STATUS_OPTIONS: EntryStatus[] = ["PENDENTE", "RECEBIDO", "VERIFICADO", "DIVERGENCIA"];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; status?: string }>;
}) {
  const { property: propertySlug, status } = await searchParams;

  const properties = await prisma.property.findMany({ orderBy: { name: "asc" } });

  const entries = await prisma.logEntry.findMany({
    where: {
      property: propertySlug ? { slug: propertySlug } : undefined,
      status: status && STATUS_OPTIONS.includes(status as EntryStatus) ? (status as EntryStatus) : undefined,
    },
    include: { property: true, reviewedBy: true },
    orderBy: { date: "desc" },
    take: 100,
  });

  // Classify each entry's e-mails by subject so the table can show whether a
  // LOGBOOK, an AUDITORIA report, or both were read into that day's entry.
  const entryIds = entries.map((e) => e.id);
  const processedEmails = entryIds.length
    ? await prisma.processedEmail.findMany({
        where: { logEntryId: { in: entryIds } },
        select: { logEntryId: true, emailSubject: true },
      })
    : [];
  const typesByEntry = new Map<string, Set<"LOGBOOK" | "AUDITORIA">>();
  for (const email of processedEmails) {
    if (!email.logEntryId) continue;
    const subject = (email.emailSubject ?? "").toUpperCase();
    const type = subject.includes("LOGBOOK") ? "LOGBOOK" : subject.includes("AUDITORIA") ? "AUDITORIA" : null;
    if (!type) continue;
    const set = typesByEntry.get(email.logEntryId) ?? new Set();
    set.add(type);
    typesByEntry.set(email.logEntryId, set);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Histórico</h1>
        <p className="text-sm text-slate-500">Últimos 100 registros.</p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <select name="property" defaultValue={propertySlug ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todas as unidades</option>
          {properties.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Unidade</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Revisado por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const dateKey = dateToKey(entry.date);
              const types = typesByEntry.get(entry.id);
              return (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/properties/${entry.property.slug}/${dateKey}`} className="text-blue-600 hover:underline">
                      {dateKey}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{entry.property.name}</td>
                  <td className="px-4 py-2">
                    {types && types.size > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {[...types].map((type) => (
                          <span
                            key={type}
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                              type === "LOGBOOK"
                                ? "border-purple-200 bg-purple-50 text-purple-700"
                                : "border-teal-200 bg-teal-50 text-teal-700"
                            }`}
                          >
                            {type === "LOGBOOK" ? "Logbook" : "Auditoria"}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-500">{entry.reviewedBy?.name ?? "—"}</td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
