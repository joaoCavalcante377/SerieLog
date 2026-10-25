import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logoutAction } from "@/features/auth/actions/auth-actions";
import { SITE_NAME } from "@/config/site";
import { messages } from "@/lib/messages/pt-BR";
import { SearchBox } from "@/features/series/components/search-box";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/series", label: messages.nav.series },
  { href: "/listas", label: messages.nav.lists },
] as const;

const linkClass = "text-muted hover:text-foreground";

export async function Header() {
  const session = await auth();
  const userId = session?.user?.id;
  const signedIn = Boolean(userId);
  const username = userId
    ? (await db.user.findUnique({ where: { id: userId }, select: { username: true } }))?.username
    : null;

  return (
    <header className="border-border bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {SITE_NAME}
        </Link>
        <nav
          aria-label={messages.common.mainNavigation}
          className="flex items-center gap-4 text-sm"
        >
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </Link>
          ))}
          {signedIn ? (
            <Link href="/diario" className={linkClass}>
              {messages.nav.diary}
            </Link>
          ) : null}
          {signedIn ? (
            <Link href="/watchlist" className={linkClass}>
              {messages.nav.watchlist}
            </Link>
          ) : null}
          {username ? (
            <Link href={`/${username}`} className={linkClass}>
              {messages.nav.profile}
            </Link>
          ) : null}
        </nav>
        <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto sm:max-w-xs sm:flex-1">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm sm:ml-0">
          {signedIn ? (
            <>
              <Link href="/configuracoes" className={linkClass}>
                {messages.nav.settings}
              </Link>
              <form action={logoutAction}>
                <button type="submit" className={`${linkClass} h-11`}>
                  {messages.nav.logout}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/entrar" className={linkClass}>
                {messages.nav.login}
              </Link>
              <Link
                href="/cadastro"
                className="bg-accent text-accent-foreground rounded-md px-3 py-2 font-medium"
              >
                {messages.nav.signup}
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
