import { Wizard } from "@/components/app/wizard";

export const metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="flex flex-col items-center pt-8 md:pt-12 relative">
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-72 bg-gradient-accent opacity-15 blur-3xl -z-10" />
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 mb-5">
          <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300">
            New Project
          </span>
        </div>
        <h1 className="text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.03em] font-semibold text-white max-w-2xl">
          Print a build-ready packet.
        </h1>
        <p className="mt-3 text-[15px] text-white/55 max-w-md mx-auto">
          Five quick questions. We&apos;ll handle the rest.
        </p>
      </div>
      <Wizard />
    </div>
  );
}
