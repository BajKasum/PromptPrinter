"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, downloadFile } from "@/lib/utils";

export type ProjectOutputs = {
  overview: string;
  brief: string;
  prd: string;
  master: string;
  frontend: string;
  backend: string;
  schema: string;
  security: string;
  marketing: string;
  seo: string;
  deployment: string;
};

const TABS: { id: keyof ProjectOutputs; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "brief", label: "Product Brief" },
  { id: "prd", label: "PRD" },
  { id: "master", label: "Master Prompt" },
  { id: "frontend", label: "Frontend Prompt" },
  { id: "backend", label: "Backend Prompt" },
  { id: "schema", label: "Database Schema" },
  { id: "security", label: "Security Checklist" },
  { id: "marketing", label: "Marketing Copy" },
  { id: "seo", label: "SEO Plan" },
  { id: "deployment", label: "Deployment Guide" },
];

export function ProjectTabs({
  projectName,
  outputs,
}: {
  projectName: string;
  outputs: ProjectOutputs;
}) {
  const [active, setActive] = useState<keyof ProjectOutputs>("overview");
  const [copied, setCopied] = useState(false);
  const text = outputs[active];

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportMd() {
    const filename = `${projectName.toLowerCase().replace(/\s+/g, "-")}.${active}.md`;
    downloadFile(filename, text, "text/markdown");
  }

  function exportAll() {
    const bundle = TABS.map((t) => `\n\n# ${t.label}\n\n${outputs[t.id]}`).join("");
    const filename = `${projectName.toLowerCase().replace(/\s+/g, "-")}.bundle.md`;
    downloadFile(filename, bundle.trim(), "text/markdown");
  }

  return (
    <div className="grid lg:grid-cols-[240px_1fr] gap-6">
      <nav className="lg:sticky lg:top-20 self-start">
        <div className="card-surface p-2">
          <ul className="space-y-0.5">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors",
                    active === t.id
                      ? "bg-white/[0.06] text-white"
                      : "text-white/65 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Button variant="ghost" className="w-full mt-3" onClick={exportAll}>
          <Download className="h-4 w-4" />
          Export all (Markdown)
        </Button>
      </nav>

      <div className="card-surface p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-white/55" />
            <span className="text-[13px] text-white/75">
              {TABS.find((t) => t.id === active)?.label}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/35">
              .md
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={exportMd}>
              <Download className="h-3.5 w-3.5" />
              .md
            </Button>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.pre
            key={active}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="p-6 text-[13px] leading-[1.7] font-mono text-white/80 whitespace-pre-wrap overflow-x-auto max-h-[70vh] overflow-y-auto"
          >
            {text}
          </motion.pre>
        </AnimatePresence>
      </div>
    </div>
  );
}
