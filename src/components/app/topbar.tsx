"use client";

import { Search, Bell, ChevronDown } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 -mx-6 md:-mx-10 px-6 md:px-10 py-3 flex items-center gap-4 border-b border-white/[0.06] backdrop-blur-xl bg-[#0A0A0A]/70">
      <div className="relative flex-1 max-w-[420px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
        <input
          type="text"
          placeholder="Search projects, prompts, outputs…"
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-white/10 bg-white/[0.02] text-[13px] text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/55 focus:ring-2 focus:ring-violet-500/15"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-white/35">
          <kbd className="px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.03]">⌘</kbd>
          <kbd className="px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.03]">K</kbd>
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="h-9 w-9 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors">
          <Bell className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <button className="flex items-center gap-2 h-9 px-2 pr-3 rounded-lg border border-white/10 bg-white/[0.02] text-[13px] text-white/85 hover:bg-white/[0.05] transition-colors">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-400 to-blue-400" />
          <span className="hidden sm:inline">Workspace</span>
          <ChevronDown className="h-3.5 w-3.5 text-white/55" />
        </button>
      </div>
    </header>
  );
}
