import { redirect } from "next/navigation";
import { Wizard } from "@/components/app/wizard";
import { createClient } from "@/lib/supabase/server";
import { parseToolDefaults } from "@/lib/tools";

export const metadata = { title: "Neues Projekt" };

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const initialTools = parseToolDefaults(profile?.settings);

  return (
    <div className="flex flex-col items-center pt-8 md:pt-12 relative">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 mb-5">
          <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300">
            Neues Projekt
          </span>
        </div>
        <h1 className="text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.03em] font-semibold text-white max-w-2xl">
          Drucke ein build-fertiges Packet.
        </h1>
        <p className="mt-3 text-[15px] text-white/55 max-w-md mx-auto">
          Fünf kurze Fragen. Den Rest übernehmen wir.
        </p>
      </div>
      <Wizard initialTools={initialTools} />
    </div>
  );
}
