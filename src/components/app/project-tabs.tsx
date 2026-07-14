"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Download, FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, downloadFile } from "@/lib/utils";

// A tab is just an output key + its display label. The caller (the project page)
// supplies the right set for the project's pack, software gets the 10-artifact
// list, the general pack gets prompt + variants, so this component stays
// agnostic to what's being shown.
export type ProjectTab = { id: string; label: string; group?: string };

export function ProjectTabs({
  projectName,
  tabs,
  outputs,
  /** PDF export is a Pro/Team feature (pricing-preview.tsx), Free only gets
   * Markdown. Admin bypasses the same way it bypasses every other plan gate. */
  canExportPdf,
}: {
  projectName: string;
  tabs: ProjectTab[];
  outputs: Record<string, string>;
  canExportPdf: boolean;
}) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const text = outputs[active] ?? "";
  const activeLabel = tabs.find((t) => t.id === active)?.label ?? projectName;
  const slug = projectName.toLowerCase().replace(/\s+/g, "-");

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportMd() {
    downloadFile(`${slug}.${active}.md`, text, "text/markdown");
  }

  // jsPDF is a large, PDF-only dependency, loaded on demand instead of a
  // static import so Free-plan visitors (who can never trigger this) never
  // pay for it in the route's initial bundle.
  async function exportPdf() {
    const { downloadMarkdownAsPdf } = await import("@/lib/pdf-export");
    downloadMarkdownAsPdf(`${slug}.${active}.pdf`, `${projectName}, ${activeLabel}`, text);
  }

  function bundle() {
    return tabs.map((t) => `\n\n# ${t.label}\n\n${outputs[t.id] ?? ""}`).join("").trim();
  }

  function exportAll() {
    downloadFile(`${slug}.bundle.md`, bundle(), "text/markdown");
  }

  async function exportAllPdf() {
    const { downloadMarkdownAsPdf } = await import("@/lib/pdf-export");
    downloadMarkdownAsPdf(`${slug}.bundle.pdf`, projectName, bundle());
  }

  return (
    <div className="grid lg:grid-cols-[240px_1fr] gap-6">
      <nav className="lg:sticky lg:top-20 self-start">
        <div className="card-surface p-2">
          <ul className="space-y-0.5">
            {tabs.map((t, i) => {
              const showGroup = t.group && t.group !== tabs[i - 1]?.group;
              return (
                <li key={t.id}>
                  {showGroup && (
                    <div className="px-3 pt-3 pb-1 text-[10px] font-mono uppercase tracking-[0.08em] text-foreground/35">
                      {t.group}
                    </div>
                  )}
                  <button
                    onClick={() => setActive(t.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors",
                      active === t.id
                        ? "bg-accent-subtle text-accent-text font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                    )}
                  >
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <Button variant="ghost" className="w-full mt-3" onClick={exportAll}>
          <Download className="h-4 w-4" />
          Alle exportieren (Markdown)
        </Button>
        {canExportPdf ? (
          <Button variant="ghost" className="w-full mt-2" onClick={exportAllPdf}>
            <FileDown className="h-4 w-4" />
            Alle exportieren (PDF)
          </Button>
        ) : (
          <a
            href="/billing"
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF-Export · Pro
          </a>
        )}
      </nav>

      <div className="card-surface p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-[13px] font-medium text-foreground truncate">{activeLabel}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Kopiert" : "Kopieren"}
            </Button>
            {canExportPdf && (
              <Button size="sm" variant="ghost" onClick={exportPdf}>
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={exportMd}>
              <Download className="h-3.5 w-3.5" />
              Export
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
            className="p-6 text-[13px] leading-[1.7] font-mono text-foreground/85 whitespace-pre-wrap overflow-x-auto max-h-[70vh] overflow-y-auto"
          >
            {text}
          </motion.pre>
        </AnimatePresence>
      </div>
    </div>
  );
}
