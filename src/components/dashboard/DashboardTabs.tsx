import Link from "next/link";

type TabKey = "geral" | "business" | "suites" | "reservas";

function tabClasses(isActive: boolean) {
  return isActive
    ? "rounded-full bg-white px-4 py-1.5 text-sm font-medium text-zinc-900"
    : "rounded-full px-4 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200";
}

export function DashboardTabs({ active, dateKey }: { active: TabKey; dateKey: string }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-zinc-900 p-1 text-center">
      <Link href={`/?date=${dateKey}`} className={tabClasses(active === "geral")}>
        Visão Geral
      </Link>
      <Link href={`/properties/victory-business/${dateKey}`} className={tabClasses(active === "business")}>
        Victory Business
      </Link>
      <Link href={`/properties/victory-suites/${dateKey}`} className={tabClasses(active === "suites")}>
        Victory Suites
      </Link>
      <Link href={`/reservas?date=${dateKey}`} className={tabClasses(active === "reservas")}>
        Central de Reservas
      </Link>
    </div>
  );
}
