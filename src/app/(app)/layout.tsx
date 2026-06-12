import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/server";

// Auth-gated shell. The middleware already guards these routes; fetching the
// user here is both the defense-in-depth check and the source for the topbar.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <ToastProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:border focus:border-ring/50 focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-[13px] focus:text-foreground"
      >
        Zum Inhalt springen
      </a>
      <div className="min-h-screen">
        <Sidebar />
        <div className="md:ml-[240px] px-6 md:px-10 pt-0 pb-16">
          <Topbar
            email={user.email ?? ""}
            plan={profile?.plan ?? "free"}
            displayName={profile?.display_name ?? null}
            avatarUrl={profile?.avatar_url ?? null}
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
    </ToastProvider>
  );
}
