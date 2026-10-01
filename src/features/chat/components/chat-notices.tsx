"use client";

import { RotateCcw } from "lucide-react";
import { ChatKeyNotice } from "@/features/chat/components/chat-key-notice";
import { formatRetryDelay } from "@/features/chat/lib/chat-wire";
import { useLocale, useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

// Die Hinweise unter dem Verlauf: fehlender Key, Fehler mit "Erneut senden", abgelehnter Anhang, Warnung beim
// Speichern. Reine Darstellung. Aus chat.tsx herausgeloest (M7).
export function ChatNotices({
  keyRequired,
  onKeyConnected,
  error,
  retryAfter,
  input,
  busy,
  onResend,
  attachNotice,
  persistWarning,
}: {
  keyRequired: boolean;
  onKeyConnected: () => void;
  error: string | null;
  retryAfter: number | null;
  input: string;
  busy: boolean;
  onResend: () => Promise<string | null>;
  attachNotice: string | null;
  persistWarning: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
          {keyRequired && <ChatKeyNotice onConnected={onKeyConnected} />}

          {error && (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
            >
              <span>
                {error}
                {retryAfter !== null &&
                  ` ${fmt(t.chat.retryIn, { delay: formatRetryDelay(retryAfter, t.chat, locale) })}`}
              </span>
              {/* The failed message is back in the composer, so this just sends it
                  again — the banner used to be a dead end with the input already
                  cleared. Hidden while rate-limited: retrying then only produces
                  the same 429. */}
              {retryAfter === null && input.trim() && (
                <button
                  type="button"
                  onClick={() => void onResend()}
                  disabled={busy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1 text-[12.5px] font-medium transition-colors hover:bg-destructive/10 disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                  {t.chat.resend}
                </button>
              )}
            </div>
          )}

          {attachNotice && (
            <div
              role="alert"
              className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning"
            >
              {attachNotice}
            </div>
          )}

          {persistWarning && (
            <div
              role="status"
              className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning"
            >
              {persistWarning}
            </div>
          )}
    </>
  );
}
