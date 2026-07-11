import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/app/actions/auth-actions";
import { SyncButton } from "@/components/SyncButton";

export async function Nav() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="leading-none">
            <p className="text-sm font-bold tracking-wide text-white">VICTORY</p>
            <p className="text-[8px] font-medium tracking-[0.3em] text-zinc-500">HOTÉIS</p>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <Link href="/" className="hover:text-white">
              Painel
            </Link>
            <Link href="/history" className="hover:text-white">
              Histórico
            </Link>
            {isAdmin && (
              <Link href="/admin/checklists" className="hover:text-white">
                Checklists
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <SyncButton />
          {session?.user?.name && <span>{session.user.name}</span>}
          <form action={logout}>
            <button
              type="submit"
              className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
