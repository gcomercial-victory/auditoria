import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toggleArchiveItem } from "./actions";
import { AddItemForm } from "./AddItemForm";

const TYPE_LABEL: Record<string, string> = {
  BOOLEAN: "Sim/Não",
  NUMBER: "Número",
  TEXT: "Texto",
};

export default async function ChecklistAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/");
  }

  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
    include: { checklistItems: { orderBy: { order: "asc" } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Checklists por unidade</h1>
        <p className="text-sm text-slate-500">
          Defina os itens que a recepção de cada unidade deve reportar diariamente.
        </p>
      </div>

      {properties.map((property) => (
        <div key={property.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-medium text-slate-900">{property.name}</h2>

          <ul className="mt-3 divide-y divide-slate-100">
            {property.checklistItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <div className={item.archived ? "text-slate-400 line-through" : "text-slate-700"}>
                  {item.label}{" "}
                  <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {TYPE_LABEL[item.type]}
                  </span>
                </div>
                <form action={toggleArchiveItem.bind(null, item.id, !item.archived)}>
                  <button
                    type="submit"
                    className="text-xs text-slate-500 underline hover:text-slate-800"
                  >
                    {item.archived ? "reativar" : "arquivar"}
                  </button>
                </form>
              </li>
            ))}
            {property.checklistItems.length === 0 && (
              <li className="py-2 text-sm text-slate-400">Nenhum item cadastrado.</li>
            )}
          </ul>

          <AddItemForm propertyId={property.id} />
        </div>
      ))}
    </div>
  );
}
