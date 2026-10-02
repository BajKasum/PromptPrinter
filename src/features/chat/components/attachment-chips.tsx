"use client";

import { FileText, ImageIcon, Loader2, X } from "lucide-react";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";
import { formatBytes, type AttachmentView } from "@/shared/lib/chat-attachments";
import { LOCALE_TAGS } from "@/shared/i18n/locales";
import { useLocale, useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

// Wie ein Anhang aussieht: einmal als Entwurf im Composer (mit Entfernen-Knopf),
// einmal an einer abgeschickten Nachricht (zum Anschauen). Beide teilen sich
// die Form eines Bildes (Vorschau) und einer Datei (Name und Grösse).

const THUMB = "h-14 w-14";

function FileChip({ name, sizeBytes, kind }: { name: string; sizeBytes: number; kind: "image" | "text" }) {
  const locale = useLocale();
  const Icon = kind === "image" ? ImageIcon : FileText;
  return (
    <div className="flex h-14 max-w-[220px] items-center gap-2.5 rounded-xl border border-border bg-surface px-3">
      <Icon className="h-4 w-4 shrink-0 text-secondary" strokeWidth={1.8} />
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium leading-tight text-foreground">{name}</span>
        <span className="block text-[11px] leading-tight text-tertiary">
          {formatBytes(sizeBytes, LOCALE_TAGS[locale].intl)}
        </span>
      </span>
    </div>
  );
}

/**
 * Die Anhänge im Composer, über dem Textfeld. Bilder als Vorschau, Dateien mit
 * Name und Grösse, jeder mit einem Knopf zum Entfernen. Während Dateien noch
 * verkleinert werden, steht für jede ein Platzhalter da: sonst wirkte der
 * Moment zwischen "Datei gewählt" und "Vorschau da" wie ein verschluckter Klick.
 */
export function AttachmentTray({
  items,
  pending,
  onRemove,
}: {
  items: DraftAttachment[];
  pending: number;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  if (items.length === 0 && pending === 0) return null;

  return (
    <ul aria-label={t.chat.attachGroupLabel} className="flex flex-wrap gap-2.5 px-3 pb-1 pt-3">
      {items.map((a) => (
        <li key={a.id} className="relative">
          {a.kind === "image" && a.previewUrl ? (
            // Eine data:-Adresse der schon vorhandenen Bytes: kein Netzwerk, und
            // der Bildoptimierer von next/image kann damit ohnehin nichts anfangen.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.previewUrl}
              alt={a.name}
              className={`${THUMB} rounded-xl border border-border object-cover`}
            />
          ) : (
            <FileChip name={a.name} sizeBytes={a.sizeBytes} kind={a.kind} />
          )}
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            aria-label={fmt(t.chat.attachRemove, { name: a.name })}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <X className="h-3 w-3" strokeWidth={2.4} />
          </button>
        </li>
      ))}
      {Array.from({ length: pending }, (_, i) => (
        <li
          key={`pending-${i}`}
          role="status"
          aria-label={t.chat.attachPreparing}
          className={`${THUMB} flex items-center justify-center rounded-xl border border-dashed border-border-strong text-tertiary`}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Die Anhänge einer abgeschickten Nachricht, über ihrer Sprechblase. Ein Bild
 * mit Adresse öffnet in voller Grösse in einem neuen Tab, ohne Adresse (die
 * Vorschau liess sich nicht erzeugen) bleibt es ein Chip mit dem Namen.
 */
export function MessageAttachments({ attachments }: { attachments: AttachmentView[] }) {
  const t = useT();
  if (attachments.length === 0) return null;

  return (
    <ul aria-label={t.chat.attachGroupLabel} className="flex flex-wrap justify-end gap-2">
      {attachments.map((a) => (
        <li key={a.id}>
          {a.kind === "image" && a.url ? (
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={fmt(t.chat.attachOpenImage, { name: a.name })}
              className="block overflow-hidden rounded-xl border border-border transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- data:/signierte Adresse, siehe oben */}
              <img src={a.url} alt={a.name} className="h-28 w-auto max-w-[220px] object-cover" />
            </a>
          ) : (
            <FileChip name={a.name} sizeBytes={a.sizeBytes} kind={a.kind} />
          )}
        </li>
      ))}
    </ul>
  );
}
