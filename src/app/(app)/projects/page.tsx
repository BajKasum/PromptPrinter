import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="max-w-[1200px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
            All projects
          </h1>
          <p className="mt-1 text-[14px] text-white/55">Browse every build packet you&apos;ve printed.</p>
        </div>
        <Button asChild>
          <Link href="/new">
            <Plus className="h-4 w-4" />
            New project
          </Link>
        </Button>
      </div>

      <div className="card-surface p-12 text-center">
        <p className="text-[14.5px] text-white/65">Project list comes online once Supabase is configured.</p>
        <p className="mt-2 text-[13px] text-white/40">
          See <code className="font-mono text-violet-300">/dashboard</code> for sample state, or create a new project to test the flow.
        </p>
      </div>
    </div>
  );
}
