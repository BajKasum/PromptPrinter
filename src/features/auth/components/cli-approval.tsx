"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useLocale, useT } from "@/shared/i18n/provider";
import { LOCALE_TAGS } from "@/shared/i18n/locales";
import { fmt } from "@/shared/i18n/format";
import { USER_CODE_ALPHABET, USER_CODE_LENGTH, formatUserCode, normalizeUserCode } from "@/shared/lib/cli-user-code";

type Pending = { userCode: string; clientName: string; createdAt: string };
type Step = { kind: "enter" } | { kind: "confirm"; pending: Pending } | { kind: "done"; approved: boolean };

/** Was getippt wurde, auf die erlaubten Zeichen gekürzt und als `XXXX-XXXX` gezeigt. */
function maskCode(raw: string): string {
  const chars = [...raw.toUpperCase()].filter((c) => USER_CODE_ALPHABET.includes(c)).slice(0, USER_CODE_LENGTH);
  const code = chars.join("");
  return code.length > 4 ? formatUserCode(code.padEnd(USER_CODE_LENGTH)).trimEnd() : code;
}

/**
 * Die Seite, auf der man die Anmeldung seines Terminals bestätigt (/cli). Der Code wird ABGETIPPT: weder
 * die Adresse noch sonst etwas füllt ihn vor, sonst könnte jemand einem Nutzer den Code seines eigenen
 * Geräts unterschieben. Erst `lookup` (zeigt Gerätename und Uhrzeit), dann `approve` oder `deny`.
 */
export function CliApproval() {
  const t = useT();
  const locale = useLocale();
  const c = t.cliLogin;
  const [step, setStep] = useState<Step>({ kind: "enter" });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = normalizeUserCode(input);

  async function send(userCode: string, action: "lookup" | "approve" | "deny") {
    const res = await fetch("/api/cli/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userCode, action }),
    });
    const body = (await res.json().catch(() => null)) as { detail?: string } & Record<string, unknown> | null;
    return { res, body };
  }

  async function lookup() {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const { res, body } = await send(code, "lookup");
      if (res.ok && body && typeof body.clientName === "string" && typeof body.createdAt === "string") {
        setStep({ kind: "confirm", pending: { userCode: code, clientName: body.clientName, createdAt: body.createdAt } });
      } else {
        setError(body?.detail ?? c.errors.network);
      }
    } catch {
      setError(c.errors.network);
    } finally {
      setBusy(false);
    }
  }

  async function decide(pending: Pending, action: "approve" | "deny") {
    setBusy(true);
    setError(null);
    try {
      const { res, body } = await send(pending.userCode, action);
      if (res.ok) {
        setStep({ kind: "done", approved: action === "approve" });
      } else {
        // Abgelaufen oder schon entschieden: zurück zur Eingabe, mit dem Satz des Servers.
        setError(body?.detail ?? c.errors.network);
        if (res.status === 404) setStep({ kind: "enter" });
      }
    } catch {
      setError(c.errors.network);
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setInput("");
    setError(null);
    setStep({ kind: "enter" });
  }

  const time = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[locale].intl, { timeStyle: "short" }).format(new Date(iso));

  return (
    <section className="max-w-lg rounded-2xl border border-border bg-surface-raised p-6 md:p-7">
      {step.kind === "enter" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="cli-code" className="mb-1.5 block text-[13px] font-medium text-foreground">
              {c.codeLabel}
            </label>
            <Input
              id="cli-code"
              value={input}
              onChange={(e) => setInput(maskCode(e.target.value))}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              className="font-mono tracking-[0.2em]"
              aria-describedby="cli-code-hint"
            />
            <p id="cli-code-hint" className="mt-1.5 text-[13px] text-secondary">
              {c.codeHint}
            </p>
          </div>
          <Button type="submit" disabled={busy || !code}>
            {busy ? c.checking : c.check}
          </Button>
        </form>
      )}

      {step.kind === "confirm" && (
        <div className="space-y-4">
          <div>
            <p className="text-[13px] text-secondary">{c.device}</p>
            <p className="mt-0.5 break-words text-[16px] font-medium text-foreground">
              {step.pending.clientName || c.unnamed}
            </p>
            <p className="mt-0.5 text-[13px] text-secondary">{fmt(c.requestedAt, { time: time(step.pending.createdAt) })}</p>
          </div>
          <p className="text-[14px] leading-relaxed text-foreground" role="note">
            {c.warning}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void decide(step.pending, "approve")} disabled={busy}>
              {c.approve}
            </Button>
            <Button variant="ghost" onClick={() => void decide(step.pending, "deny")} disabled={busy}>
              {c.deny}
            </Button>
          </div>
        </div>
      )}

      {step.kind === "done" && (
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-foreground" role="status">
            {step.approved ? c.approved : c.denied}
          </p>
          <Button variant="ghost" onClick={again}>
            {c.another}
          </Button>
        </div>
      )}

      {error && (
        <p
          className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
}
