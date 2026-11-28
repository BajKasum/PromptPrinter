import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Sidebar, type SidebarChat, type SidebarProject } from "@/shell/components/sidebar";
import { MobileNav } from "@/shell/components/mobile-nav";
import { ToastProvider } from "@/shared/ui/toast";
import { ThemeProvider } from "@/shared/providers/theme-provider";
import { createClient } from "@/server/supabase/server";
import { getSessionProfile, getSessionUser } from "@/server/session";
import { I18nProvider } from "@/shared/i18n/provider";
import { DEFAULT_LOCALE, LOCALE_COOKIE, toLocale } from "@/shared/i18n/locales";
import { localeFromSettings, messagesFor } from "@/server/i18n";
import { captureError } from "@/shared/lib/observability";

type SidebarChatRow = { id: string; title: string };
type SidebarProjectRow = { id: string; name: string; is_favorite: boolean | null };

// Auth-gated shell. The proxy already guards these routes; fetching the
// user here is both the defense-in-depth check and the source for the
// sidebar's account menu.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Je Request gecacht: dieselbe Antwort bedient auch getProject() und die Seiten darunter, statt dass jede selbst
  // nachfragt.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Der CSP-Nonce für das Inline-Skript von next-themes, das ein Aufblitzen des falschen Themas verhindert. Er wird
  // hier gelesen, nicht im Root-Layout: dort machte er jede Seite dynamisch, auch die Rechtstexte. Dieses Layout ist
  // durch die Prüfung der Sitzung oben ohnehin dynamisch, hier kostet er nichts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // The sidebar's collapse state and user-chosen width both live in cookies
  // so the server renders the correct size on first paint, no client-side
  // snap after hydration for either.
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get("pp-sidebar")?.value === "1";
  const sidebarWidthCookie = Number(cookieStore.get("pp-sidebar-width")?.value);
  const sidebarWidth =
    Number.isFinite(sidebarWidthCookie) && sidebarWidthCookie > 0 ? sidebarWidthCookie : 264;

  // Die Seitenleiste: die neuesten Chats ohne Projekt (Projekt-Chats stehen in ihrem Workspace) und die Projekte,
  // Favoriten zuerst. Beide Listen grenzt RLS ein und zusätzlich user_id aus der geprüften Sitzung: ginge eine Policy
  // zu weit, zeigte die Seitenleiste sonst fremde Titel. Das Profil kommt aus getSessionProfile(), dessen Zeile die
  // Seiten darunter im selben Request wiederverwenden, und wird parallel zu den beiden Listen gelesen.
  const [profile, rawChatsResult, rawProjectsResult] = await Promise.all([
    getSessionProfile(),
    supabase
      .from("conversations")
      .select("id, title")
      .eq("user_id", user.id)
      .is("project_id", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("projects")
      .select("id, name, is_favorite")
      .eq("user_id", user.id)
      .order("is_favorite", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);
  // Die beiden Listen sind Abkürzungen: scheitert ihr Lesen, bleibt die Sidebar leer und die Seite darunter geht auf,
  // statt dass die ganze App in global-error fällt. Die Seiten selbst lesen ihre Daten mit orThrow.
  if (rawChatsResult.error) captureError("sidebar.chats_read_failed", rawChatsResult.error);
  if (rawProjectsResult.error) captureError("sidebar.projects_read_failed", rawProjectsResult.error);
  const rawChats = rawChatsResult.error ? null : rawChatsResult.data;
  const rawProjects = rawProjectsResult.error ? null : rawProjectsResult.data;

  // Sprache: Cookie zuerst, sonst die im Profil gespeicherte
  // Wahl (neues Gerät), sonst Deutsch. Das Profil kam oben ohnehin, die
  // Entscheidung kostet also keine weitere Abfrage. Kam sie aus dem Profil,
  // schreibt der Provider den Cookie nach, damit auch die API-Routen (die nur
  // den Cookie lesen) ab jetzt in dieser Sprache antworten.
  const cookieLocale = toLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const locale = cookieLocale ?? localeFromSettings(profile?.settings) ?? DEFAULT_LOCALE;
  const t = messagesFor(locale);

  const sidebarChats: SidebarChat[] = ((rawChats as SidebarChatRow[] | null) ?? []).map(
    (c) => ({ id: c.id, title: c.title })
  );
  const sidebarProjects: SidebarProject[] = (
    (rawProjects as SidebarProjectRow[] | null) ?? []
  ).map((p) => ({ id: p.id, name: p.name, isFavorite: p.is_favorite ?? false }));

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <I18nProvider
        locale={locale}
        messages={t}
        persistCookie={!cookieLocale && locale !== DEFAULT_LOCALE}
      >
        <ToastProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-200 focus:rounded-lg focus:border focus:border-ring/50 focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-[13px] focus:text-foreground"
          >
            {t.shell.skipToContent}
          </a>
          <div className="min-h-screen md:flex">
            <Sidebar
              initialCollapsed={sidebarCollapsed}
              initialWidth={sidebarWidth}
              chats={sidebarChats}
              projects={sidebarProjects}
              email={user.email ?? ""}
              isAdmin={profile?.is_admin ?? false}
              displayName={profile?.display_name ?? null}
            />
            <div className="min-w-0 flex-1 px-6 md:px-10 pb-16">
              {/* Mobile-only nav trigger, the desktop sidebar is hidden below md
                  so this is the sole way to move between sections on a phone.
                  Sticky so it stays reachable while a long chat thread scrolls. */}
              <div className="sticky top-0 z-30 -mx-6 bg-background/70 px-6 pb-2 pt-3 backdrop-blur-xl md:hidden">
                <MobileNav chats={sidebarChats} projects={sidebarProjects} />
              </div>
              <main
                id="main-content"
                tabIndex={-1}
                className="mx-auto w-full max-w-container pt-6 md:pt-8 focus:outline-hidden"
              >
                {children}
              </main>
            </div>
          </div>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
