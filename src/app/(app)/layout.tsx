import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Sidebar, type SidebarChat, type SidebarProject } from "@/shell/components/sidebar";
import { MobileNav } from "@/shell/components/mobile-nav";
import { ToastProvider } from "@/shared/ui/toast";
import { ThemeProvider } from "@/shared/providers/theme-provider";
import { Onboarding } from "@/features/onboarding/components/onboarding";
import { createClient } from "@/server/supabase/server";
import { getSessionProfile, getSessionUser } from "@/server/session";

type SidebarChatRow = { id: string; title: string };
type SidebarProjectRow = { id: string; name: string; is_favorite: boolean | null };

// Auth-gated shell. The middleware already guards these routes; fetching the
// user here is both the defense-in-depth check and the source for the
// sidebar's account menu.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Request-gecacht (Planpunkt B-3): dieselbe Antwort bedienen auch
  // getProject() und die Seiten darunter, statt je einmal nachzufragen.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Der CSP-Nonce fuer next-themes' Anti-Flash-Inline-Script. Der stand bis
  // Planpunkt B-2 im Root-Layout und machte damit ALLE 38 Routen dynamisch,
  // auch die unveraenderlichen Rechtstexte. Hier gelesen kostet er nichts:
  // dieses Layout ist durch die Auth-Pruefung oben ohnehin dynamisch.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // The sidebar's collapse state and user-chosen width both live in cookies
  // so the server renders the correct size on first paint, no client-side
  // snap after hydration for either.
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get("pp-sidebar")?.value === "1";
  const sidebarWidthCookie = Number(cookieStore.get("pp-sidebar-width")?.value);
  const sidebarWidth =
    Number.isFinite(sidebarWidthCookie) && sidebarWidthCookie > 0 ? sidebarWidthCookie : 264;

  // Recents for the sidebar: the latest global chats (project chats live in
  // their workspace) and pinned-then-recent projects. RLS scopes both reads.
  // Das Profil kommt aus getSessionProfile() (B-3), damit die Seiten darunter
  // dieselbe Zeile bekommen statt sie erneut zu holen — bis zu drei Ebenen
  // fragten vorher unabhaengig voneinander nach display_name bzw. plan.
  // Bleibt im selben Promise.all: die Abfrage laeuft dadurch weiterhin
  // parallel zu den beiden Listen, nur eben genau einmal pro Request.
  const [profile, { data: rawChats }, { data: rawProjects }] = await Promise.all([
    getSessionProfile(),
    supabase
      .from("conversations")
      .select("id, title")
      .is("project_id", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("projects")
      .select("id, name, is_favorite")
      .order("is_favorite", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const sidebarChats: SidebarChat[] = ((rawChats as SidebarChatRow[] | null) ?? []).map(
    (c) => ({ id: c.id, title: c.title })
  );
  const sidebarProjects: SidebarProject[] = (
    (rawProjects as SidebarProjectRow[] | null) ?? []
  ).map((p) => ({ id: p.id, name: p.name, isFavorite: p.is_favorite ?? false }));

  // First-login tour: auto-start until profiles.settings.onboarding_done is set.
  const rawSettings = profile?.settings;
  const tourDone =
    !!rawSettings &&
    typeof rawSettings === "object" &&
    !Array.isArray(rawSettings) &&
    (rawSettings as Record<string, unknown>).onboarding_done === true;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <ToastProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:border focus:border-ring/50 focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-[13px] focus:text-foreground"
        >
          Zum Inhalt springen
        </a>
        <div className="min-h-screen md:flex">
          <Sidebar
            initialCollapsed={sidebarCollapsed}
            initialWidth={sidebarWidth}
            chats={sidebarChats}
            projects={sidebarProjects}
            email={user.email ?? ""}
            plan={profile?.plan ?? "free"}
            isAdmin={profile?.is_admin ?? false}
            displayName={profile?.display_name ?? null}
            avatarUrl={profile?.avatar_url ?? null}
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
              className="mx-auto w-full max-w-[1200px] pt-6 md:pt-8 focus:outline-none"
            >
              {children}
            </main>
          </div>
        </div>
        <Onboarding userId={user.id} initialDone={tourDone} />
      </ToastProvider>
    </ThemeProvider>
  );
}
