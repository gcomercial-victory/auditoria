import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDaysToKey, dateKeyToDate, formatDateKeyLong } from "@/lib/date";
import { StatusBadge } from "@/components/StatusBadge";
import { EntryForm } from "./EntryForm";
import { ImportBox } from "./ImportBox";
import { UploadBox } from "./UploadBox";
import { ReviewPanel } from "./ReviewPanel";

export default async function LogEntryPage({
  params,
}: {
  params: Promise<{ slug: string; date: string }>;
}) {
  const { slug, date: dateKey } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) notFound();

  const property = await prisma.property.findUnique({ where: { slug } });
  if (!property) notFound();

  const date = dateKeyToDate(dateKey);
  const previousDateKey = addDaysToKey(dateKey, -1);
  const previousDate = dateKeyToDate(previousDateKey);

  const [templates, entry, previousEntry] = await Promise.all([
    prisma.checklistItemTemplate.findMany({
      where: { propertyId: property.id, archived: false },
      orderBy: { order: "asc" },
    }),
    prisma.logEntry.findUnique({
      where: { propertyId_date: { propertyId: property.id, date } },
      include: { responses: true, reviewedBy: true },
    }),
    prisma.logEntry.findUnique({
      where: { propertyId_date: { propertyId: property.id, date: previousDate } },
      include: { responses: true },
    }),
  ]);

  const responseByTemplate = new Map(entry?.responses.map((r) => [r.templateItemId, r]) ?? []);
  const previousByTemplate = new Map(previousEntry?.responses.map((r) => [r.templateItemId, r]) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/?date=${dateKey}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar ao painel
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{property.name}</h1>
            <p className="text-sm text-slate-500">{formatDateKeyLong(dateKey)}</p>
          </div>
          <div className="flex items-center gap-2">
            {entry?.sourceType === "EMAIL" && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                ✉️ Importado por e-mail
              </span>
            )}
            <StatusBadge status={entry?.status ?? "PENDENTE"} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Link
            href={`/properties/${slug}/${previousDateKey}`}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
          >
            ← Dia anterior
          </Link>
          <Link
            href={`/properties/${slug}/${addDaysToKey(dateKey, 1)}`}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
          >
            Próximo dia →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ImportBox propertyId={property.id} dateKey={dateKey} />
        <UploadBox propertyId={property.id} dateKey={dateKey} currentFileUrl={entry?.fileUrl} currentFileName={entry?.fileName} />
      </div>

      <EntryForm
        propertyId={property.id}
        dateKey={dateKey}
        templates={templates}
        responseByTemplate={Object.fromEntries(responseByTemplate)}
        previousByTemplate={Object.fromEntries(previousByTemplate)}
        submittedBy={entry?.submittedBy ?? ""}
        notes={entry?.notes ?? ""}
      />

      {entry && (
        <ReviewPanel
          entryId={entry.id}
          status={entry.status}
          reviewedByName={entry.reviewedBy?.name}
          reviewedAt={entry.reviewedAt?.toISOString()}
          reviewNotes={entry.reviewNotes}
        />
      )}
    </div>
  );
}
