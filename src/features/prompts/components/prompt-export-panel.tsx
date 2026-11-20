"use client";

import { useId, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard";
import { cn, downloadFile } from "@/shared/lib/utils";
import type { PlaceholderFill } from "@/shared/lib/placeholders";
import {
  BASE_URL_ENV,
  KEY_ENV,
  MODEL_PLACEHOLDER,
  canSplitSystem,
  exportCode,
  exportJson,
  exportPromptFile,
  promptFileName,
  toTemplate,
  type ExportTarget,
} from "@/shared/lib/prompt-export";
import { fmt } from "@/shared/i18n/format";
import { useT } from "@/shared/i18n/provider";

// Der Export eines gespeicherten Prompts (shared/lib/prompt-export.ts) als aufgeklapptes Feld in der Karte: Format,
// Schnittstelle, Systemnachricht, Vorschau, Kopieren oder Herunterladen. Alles bleibt im Browser. Was im Formular der
// Platzhalter eingetragen ist, geht direkt in den Text, leere Platzhalter werden Variablen.

type Format = "json" | "curl" | "python" | "javascript" | "file";
const FORMATS: Format[] = ["json", "curl", "python", "javascript", "file"];
const FORMAT_LABEL: Record<Format, string> = {
  json: "JSON",
  curl: "curl",
  python: "Python",
  javascript: "JavaScript",
  file: ".prompt.md",
};
const TARGETS: ExportTarget[] = ["openai", "anthropic", "gemini"];

function ToggleRow<T extends string>({
  label,
  options,
  value,
  onChange,
  labelOf,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (next: T) => void;
  labelOf: (option: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[12px] text-tertiary">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "touch-hit-y relative rounded-md border px-2 py-0.5 text-[12.5px] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50",
            value === option
              ? "border-accent bg-accent-subtle font-medium text-accent-text"
              : "border-border text-secondary hover:bg-surface-hover hover:text-foreground"
          )}
        >
          {labelOf(option)}
        </button>
      ))}
    </div>
  );
}

export function PromptExportPanel({
  id,
  prompt,
  title,
  fill,
}: {
  id: string;
  prompt: string;
  title: string;
  fill?: PlaceholderFill;
}) {
  const t = useT();
  const splitId = useId();
  const { copied, copy } = useCopyToClipboard();
  const [format, setFormat] = useState<Format>("json");
  const [target, setTarget] = useState<ExportTarget>("openai");
  const [split, setSplit] = useState(false);
  const splittable = canSplitSystem(prompt);

  const input = { prompt, title, fill, systemFromFirstParagraph: split && splittable };
  const output =
    format === "file"
      ? exportPromptFile(input)
      : format === "json"
        ? exportJson(target, input)
        : exportCode(target, format, input);
  const firstVariable = toTemplate(prompt, fill).variables[0];

  const hints: string[] = [];
  if (format === "python") hints.push(t.prompts.export.runPython);
  if (format === "javascript") hints.push(t.prompts.export.runJavaScript);
  if (format === "file") hints.push(t.prompts.export.fileHint);
  if (format !== "file") hints.push(fmt(t.prompts.export.modelHint, { model: MODEL_PLACEHOLDER }));
  if (format !== "file" && format !== "json") hints.push(fmt(t.prompts.export.keyHint, { env: KEY_ENV[target] }));
  if (format !== "file" && format !== "json" && target === "openai") {
    hints.push(fmt(t.prompts.export.baseUrlHint, { env: BASE_URL_ENV }));
  }
  if (firstVariable) hints.push(fmt(t.prompts.export.variablesHint, { example: `{{${firstVariable.name}}}` }));

  return (
    <div id={id} role="group" aria-label={t.prompts.export.title} className="space-y-2.5 border-t border-border px-4 py-3">
      <ToggleRow label={t.prompts.export.format} options={FORMATS} value={format} onChange={setFormat} labelOf={(f) => FORMAT_LABEL[f]} />
      {format !== "file" && (
        <ToggleRow
          label={t.prompts.export.target}
          options={TARGETS}
          value={target}
          onChange={setTarget}
          labelOf={(target) => t.prompts.export.targets[target]}
        />
      )}
      <div>
        <label htmlFor={splitId} className="inline-flex items-center gap-2 text-[13px] text-foreground/85">
          <input
            id={splitId}
            type="checkbox"
            checked={split && splittable}
            disabled={!splittable}
            onChange={(e) => setSplit(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          {t.prompts.export.systemSplit}
        </label>
        {!splittable && <p className="mt-0.5 text-[12px] text-tertiary">{t.prompts.export.systemSplitNone}</p>}
      </div>

      <pre
        tabIndex={0}
        aria-label={t.prompts.export.preview}
        className="max-h-72 overflow-auto whitespace-pre rounded-lg border border-border bg-surface px-3 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/85 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {output}
      </pre>

      <ul className="space-y-0.5 text-[12px] leading-relaxed text-secondary">
        {hints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="accent" onClick={() => void copy(output)}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? t.common.copied : t.common.copy}
        </Button>
        {format === "file" && (
          <Button variant="ghost" onClick={() => downloadFile(promptFileName(title), output, "text/markdown")}>
            <Download className="h-4 w-4" />
            {t.prompts.export.download}
          </Button>
        )}
      </div>
    </div>
  );
}
