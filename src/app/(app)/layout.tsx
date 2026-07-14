import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sidebar, type SidebarChat, type SidebarProject } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { Onboarding } from "@/components/onboarding/onboarding";
import { createClient } from "@/lib/supabase/server";

type SidebarChatRow = { id: string; title: string };
type SidebarProjectRow = { id: string; name: string; is_favorite: boolean | null };

// Auth-gated shell. The middleware already guards these routes; fetching the
// user here is both the defense-in-depth check and the source for the topbar.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
  const [{ data: profile }, { data: rawChats }, { data: rawProjects }] = await Promise.all([
    supabase
      .from("profiles")
      .select("plan, is_admin, display_name, avatar_url, settings")
      .eq("id", user.id)
      .maybeSingle(),
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
        />
        <div className="min-w-0 flex-1 px-6 md:px-10 pb-16">
          <Topbar
            email={user.email ?? ""}
            plan={profile?.plan ?? "free"}
            isAdmin={profile?.is_admin ?? false}
            displayName={profile?.display_name ?? null}
            avatarUrl={profile?.avatar_url ?? null}
            chats={sidebarChats}
            projects={sidebarProjects}
          />
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
  );
}
