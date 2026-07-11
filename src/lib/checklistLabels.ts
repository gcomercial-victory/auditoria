// Checklist item labels shared between the e-mail sync job (src/lib/emailSync.ts)
// and any UI that needs to look up a specific field's response (e.g. the
// dashboard and the Central de Reservas view) — kept in one place so the
// two never drift apart.

export const BUSINESS_LOGBOOK_RAW_LABEL = "Registro bruto dos e-mails (LOGBOOK)";
// Business also gets a separate daily "RELATÓRIOS DE AUDITORIA" /
// "RESUMO DE AUDITORIA" e-mail pair, distinct from the LOGBOOK thread.
export const BUSINESS_AUDIT_RAW_LABEL = "Registro bruto da auditoria (Business)";
export const SUITES_AUDIT_RAW_LABEL = "Registro bruto do e-mail (AUDITORIA)";

// Central de Reservas audits both hotels rather than filing its own logbook,
// so its replies get folded into whichever property's entry the thread
// belongs to, under these labels.
export const RESERVAS_NOTES_LABEL = "Instruções/atualizações da Central de Reservas";
export const RESERVAS_RAW_LABEL = "Registro bruto da resposta na thread de auditoria";
