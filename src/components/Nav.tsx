import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/app/actions/auth-actions";

export async function Nav() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            Auditoria Diária
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/" className="hover:text-slate-900">
              Painel
            </Link>
            <Link href="/history" className="hover:text-slate-900">
              Histórico
            </Link>
            {isAdmin && (
              <Link href="/admin/checklists" className="hover:text-slate-900">
                Checklists
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-600">
          {session?.user?.name && <span>{session.user.name}</span>}
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
