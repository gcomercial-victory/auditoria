"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runEmailSync } from "@/lib/emailSync";

export async function syncEmailAction(
  _prevState: string | undefined,
  _formData: FormData
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) return "Não autenticado.";

  try {
    const results = await runEmailSync();
    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/properties/[slug]/[date]", "page");

    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    if (totalErrors > 0) {
      const firstError = results.flatMap((r) => r.errors)[0];
      return `${totalProcessed} e-mail(s) importado(s), ${totalErrors} com erro (ex: "${firstError?.error}").`;
    }
    return `ok:${totalProcessed}`;
  } catch (err) {
    return err instanceof Error ? err.message : "Erro ao sincronizar e-mails.";
  }
}
