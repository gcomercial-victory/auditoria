import type { EntryStatus } from "@prisma/client";
import { STATUS_CLASSES, STATUS_DOT, STATUS_LABEL } from "@/lib/status";

export function StatusBadge({ status }: { status: EntryStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
