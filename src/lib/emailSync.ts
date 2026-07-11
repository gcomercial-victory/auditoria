import { prisma } from "@/lib/prisma";
import { getOrCreateEntry } from "@/lib/logEntry";
import { resolveDateKey } from "@/lib/date";
import { listMessageIds, getMessage, getThreadMessages, type GmailMessageSummary } from "@/lib/gmail";
import { extractFieldsFromText } from "@/lib/emailExtract";
import {
  BUSINESS_LOGBOOK_RAW_LABEL as BUSINESS_RAW_LABEL,
  BUSINESS_AUDIT_RAW_LABEL,
  SUITES_AUDIT_RAW_LABEL as SUITES_RAW_LABEL,
  RESERVAS_RAW_LABEL,
} from "@/lib/checklistLabels";
import type { ChecklistItemTemplate, Property } from "@prisma/client";

const LOOKBACK = "newer_than:15d";

// Vercel Hobby caps a function at ~60s. Each new message costs a Gmail
// fetch + a Claude call, so cap how many we process per invocation — the
// rest catch up on the next cron run or manual click.
const MAX_NEW_PER_RUN = 12;

export interface SyncResult {
  property: string;
  processed: number;
  skipped: number;
  errors: { messageId: string; subject: string; error: string }[];
}

function newResult(propertyName: string): SyncResult {
  return { property: propertyName, processed: 0, skipped: 0, errors: [] };
}

async function applyExtractedValues(
  logEntryId: string,
  templates: ChecklistItemTemplate[],
  extracted: Record<string, string | number | boolean>
) {
  for (const template of templates) {
    const raw = extracted[template.label];
    if (raw === undefined || raw === null || raw === "") continue;

    const values =
      template.type === "NUMBER"
        ? { valueNumber: typeof raw === "number" ? raw : Number(raw), valueBoolean: null, valueText: null }
        : template.type === "BOOLEAN"
          ? { valueBoolean: Boolean(raw), valueNumber: null, valueText: null }
          : { valueText: String(raw), valueNumber: null, valueBoolean: null };

    if (template.type === "NUMBER" && !Number.isFinite(values.valueNumber)) continue;

    await prisma.checklistItemResponse.upsert({
      where: { logEntryId_templateItemId: { logEntryId, templateItemId: template.id } },
      create: { logEntryId, templateItemId: template.id, ...values, status: "OK" },
      update: { ...values, status: "OK" },
    });
  }
}

async function appendRawText(logEntryId: string, templateId: string, headerLine: string, bodyText: string) {
  const existing = await prisma.checklistItemResponse.findUnique({
    where: { logEntryId_templateItemId: { logEntryId, templateItemId: templateId } },
  });
  const block = `--- ${headerLine} ---\n${bodyText.trim()}`;
  const combined = existing?.valueText ? `${existing.valueText}\n\n${block}` : block;

  await prisma.checklistItemResponse.upsert({
    where: { logEntryId_templateItemId: { logEntryId, templateItemId: templateId } },
    create: { logEntryId, templateItemId: templateId, valueText: combined, status: "OK" },
    update: { valueText: combined, status: "OK" },
  });
}

async function processMessage(
  msg: GmailMessageSummary,
  property: Property,
  aiFields: ChecklistItemTemplate[],
  rawTemplate: ChecklistItemTemplate | undefined,
  seenIds: Set<string>,
  dateKeyOverride?: string | null
): Promise<{ outcome: "processed" | "error"; error?: string }> {
  // A message can surface twice in one run (e.g. a Reservas reply matched by
  // more than one thread walk) — filterUnprocessed only checks the DB, not
  // messages already handled earlier in this same invocation.
  if (seenIds.has(msg.id)) return { outcome: "processed" };
  seenIds.add(msg.id);

  const dateKey = dateKeyOverride ?? resolveDateKey(msg.subject, msg.date ? new Date(msg.date) : new Date());

  const entry = await getOrCreateEntry(property.id, dateKey);

  const extracted = await extractFieldsFromText(
    msg.bodyText,
    aiFields.map((f) => ({ label: f.label, type: f.type }))
  );
  await applyExtractedValues(entry.id, aiFields, extracted);

  if (rawTemplate) {
    await appendRawText(entry.id, rawTemplate.id, `${msg.subject} — ${msg.from} — ${msg.date}`, msg.bodyText);
  }

  await prisma.logEntry.update({
    where: { id: entry.id },
    data: {
      sourceType: "EMAIL",
      submittedBy: msg.from,
      status: entry.status === "PENDENTE" ? "RECEBIDO" : entry.status,
    },
  });

  // upsert, not create: guards against a race with another concurrent sync
  // (e.g. cron firing while someone clicks "Sincronizar e-mails") hitting
  // the same message.
  await prisma.processedEmail.upsert({
    where: { gmailMessageId: msg.id },
    create: {
      gmailMessageId: msg.id,
      propertyId: property.id,
      logEntryId: entry.id,
      emailSubject: msg.subject,
      emailFrom: msg.from,
      emailDate: msg.date ? new Date(msg.date) : null,
    },
    update: {},
  });

  return { outcome: "processed" };
}

// A property's template can hold more than one "raw text" field (e.g. Suites
// has its own AUDITORIA raw log plus the Reservas thread-reply raw log), so
// callers look up the specific one they need by label.
function splitFields(templates: ChecklistItemTemplate[], rawLabels: string[]) {
  const rawByLabel = new Map(templates.filter((t) => rawLabels.includes(t.label)).map((t) => [t.label, t]));
  const aiFields = templates.filter((t) => !rawByLabel.has(t.label));
  return { rawByLabel, aiFields };
}

// Returns the subset of ids/threadIds not already present in ProcessedEmail.
async function filterUnprocessed<T extends { id: string }>(refs: T[]): Promise<T[]> {
  if (refs.length === 0) return [];
  const already = await prisma.processedEmail.findMany({
    where: { gmailMessageId: { in: refs.map((r) => r.id) } },
    select: { gmailMessageId: true },
  });
  const processedIds = new Set(already.map((a) => a.gmailMessageId));
  return refs.filter((r) => !processedIds.has(r.id));
}

// Shared across properties within a single run so the invocation stays
// under the platform's function-duration limit.
class Budget {
  remaining = MAX_NEW_PER_RUN;
  take(): boolean {
    if (this.remaining <= 0) return false;
    this.remaining--;
    return true;
  }
}

async function syncBusiness(property: Property, budget: Budget, seenIds: Set<string>): Promise<SyncResult> {
  const result = newResult(property.name);

  const templates = await prisma.checklistItemTemplate.findMany({
    where: { propertyId: property.id, archived: false },
  });
  const { rawByLabel, aiFields } = splitFields(templates, [
    BUSINESS_RAW_LABEL,
    BUSINESS_AUDIT_RAW_LABEL,
    RESERVAS_RAW_LABEL,
  ]);
  const logbookRaw = rawByLabel.get(BUSINESS_RAW_LABEL);
  const auditRaw = rawByLabel.get(BUSINESS_AUDIT_RAW_LABEL);
  const reservasRaw = rawByLabel.get(RESERVAS_RAW_LABEL);

  // LOGBOOK: one message per shift, no thread walk needed.
  const logbookRefs = await listMessageIds(`from:recepcao.business@victoryhoteis.com subject:LOGBOOK ${LOOKBACK}`, 60);
  const unprocessedLogbook = await filterUnprocessed(logbookRefs);
  result.skipped += logbookRefs.length - unprocessedLogbook.length;

  for (const ref of unprocessedLogbook) {
    if (!budget.take()) break;
    const msg = await getMessage(ref.id);
    const outcome = await processMessage(msg, property, aiFields, logbookRaw, seenIds);
    if (outcome.outcome === "processed") result.processed++;
    else result.errors.push({ messageId: msg.id, subject: msg.subject, error: outcome.error ?? "Erro desconhecido." });
  }

  // "RELATÓRIOS DE AUDITORIA" / "RESUMO DE AUDITORIA": a separate daily
  // e-mail pair, each its own thread — Central de Reservas occasionally
  // replies on the RESUMO thread, so we still walk the thread for that.
  //
  // We deliberately don't pre-filter these root refs by ProcessedEmail: the
  // search hit's own message id isn't necessarily the id we end up recording
  // (a thread can have more than one business-sent message matching the
  // query), so we check "already processed?" below on the actual message
  // we're about to record instead — otherwise a mismatched id never
  // converges and the same thread gets reprocessed on every run.
  const auditRootRefs = await listMessageIds(
    `from:recepcao.business@victoryhoteis.com subject:AUDITORIA ${LOOKBACK}`,
    30
  );
  const auditThreadIds = Array.from(new Set(auditRootRefs.map((r) => r.threadId)));

  for (const threadId of auditThreadIds) {
    if (budget.remaining <= 0) break;

    const threadMessages = await getThreadMessages(threadId);
    const businessMsg = threadMessages.find((m) => m.from.toLowerCase().includes("recepcao.business@victoryhoteis.com"));
    if (!businessMsg) continue;

    const dateKey = resolveDateKey(businessMsg.subject, businessMsg.date ? new Date(businessMsg.date) : new Date());

    const [unprocessedBusinessMsg] = await filterUnprocessed([businessMsg]);
    if (!unprocessedBusinessMsg) {
      result.skipped++;
    } else if (budget.take()) {
      const outcome = await processMessage(businessMsg, property, aiFields, auditRaw, seenIds, dateKey);
      if (outcome.outcome === "processed") result.processed++;
      else
        result.errors.push({
          messageId: businessMsg.id,
          subject: businessMsg.subject,
          error: outcome.error ?? "Erro desconhecido.",
        });
    }

    const reservasCandidates = threadMessages.filter((m) => m.from.toLowerCase().includes("centraldereservas@victoryhoteis.com"));
    const unprocessedReservas = await filterUnprocessed(reservasCandidates);
    result.skipped += reservasCandidates.length - unprocessedReservas.length;
    for (const rMsg of unprocessedReservas) {
      if (!budget.take()) break;
      const outcome = await processMessage(rMsg, property, aiFields, reservasRaw, seenIds, dateKey);
      if (outcome.outcome === "processed") result.processed++;
      else result.errors.push({ messageId: rMsg.id, subject: rMsg.subject, error: outcome.error ?? "Erro desconhecido." });
    }
  }

  return result;
}

// Central de Reservas replies inside the same thread as the Suites AUDITORIA
// e-mail, so both messages land on the Suites property's daily entry — just
// under different "raw text" fields.
async function syncSuites(suites: Property, budget: Budget, seenIds: Set<string>): Promise<SyncResult> {
  const result = newResult(suites.name);

  const templates = await prisma.checklistItemTemplate.findMany({
    where: { propertyId: suites.id, archived: false },
  });
  const { rawByLabel, aiFields } = splitFields(templates, [SUITES_RAW_LABEL, RESERVAS_RAW_LABEL]);
  const suitesRaw = rawByLabel.get(SUITES_RAW_LABEL);
  const reservasRaw = rawByLabel.get(RESERVAS_RAW_LABEL);

  // Same reasoning as syncBusiness's audit thread walk: don't pre-filter
  // root refs by ProcessedEmail, since the search hit's id can differ from
  // the message we actually record. Check "already processed?" on the real
  // message right before recording it.
  const rootRefs = await listMessageIds(
    `from:recepcao.suites@victoryhoteis.com subject:AUDITORIA ${LOOKBACK}`,
    30
  );
  const threadIds = Array.from(new Set(rootRefs.map((r) => r.threadId)));

  for (const threadId of threadIds) {
    if (budget.remaining <= 0) break;

    const threadMessages = await getThreadMessages(threadId);
    const suitesMsg = threadMessages.find((m) => m.from.toLowerCase().includes("recepcao.suites@victoryhoteis.com"));
    if (!suitesMsg) continue;

    const dateKey = resolveDateKey(suitesMsg.subject, suitesMsg.date ? new Date(suitesMsg.date) : new Date());

    const [unprocessedSuitesMsg] = await filterUnprocessed([suitesMsg]);
    if (!unprocessedSuitesMsg) {
      result.skipped++;
    } else if (budget.take()) {
      const suitesOutcome = await processMessage(suitesMsg, suites, aiFields, suitesRaw, seenIds, dateKey);
      if (suitesOutcome.outcome === "processed") result.processed++;
      else
        result.errors.push({
          messageId: suitesMsg.id,
          subject: suitesMsg.subject,
          error: suitesOutcome.error ?? "Erro desconhecido.",
        });
    }

    const reservasCandidates = threadMessages.filter((m) => m.from.toLowerCase().includes("centraldereservas@victoryhoteis.com"));
    const unprocessedReservas = await filterUnprocessed(reservasCandidates);
    result.skipped += reservasCandidates.length - unprocessedReservas.length;
    for (const rMsg of unprocessedReservas) {
      if (!budget.take()) break;
      const outcome = await processMessage(rMsg, suites, aiFields, reservasRaw, seenIds, dateKey);
      if (outcome.outcome === "processed") result.processed++;
      else
        result.errors.push({
          messageId: rMsg.id,
          subject: rMsg.subject,
          error: outcome.error ?? "Erro desconhecido.",
        });
    }
  }

  return result;
}

export async function runEmailSync(): Promise<SyncResult[]> {
  const properties = await prisma.property.findMany();
  const bySlug = new Map(properties.map((p) => [p.slug, p]));

  const results: SyncResult[] = [];
  const budget = new Budget();
  const seenIds = new Set<string>();

  const business = bySlug.get("victory-business");
  if (business) results.push(await syncBusiness(business, budget, seenIds));

  const suites = bySlug.get("victory-suites");
  if (suites) results.push(await syncSuites(suites, budget, seenIds));

  return results;
}
