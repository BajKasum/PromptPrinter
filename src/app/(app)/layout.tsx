import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
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
    .select("plan, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:ml-[240px] px-6 md:px-10 pt-0 pb-16">
        <Topbar
          email={user.email ?? ""}
          plan={profile?.plan ?? "free"}
          displayName={profile?.display_name ?? null}
        />
        <div className="pt-6 md:pt-8">{children}</div>
      </div>
    </div>
  );
}
