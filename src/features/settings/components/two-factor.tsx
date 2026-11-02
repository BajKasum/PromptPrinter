"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/toast";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

type Status = { enabled: boolean; recoveryCodesLeft: number | null };
type Enrollment = { factorId: string; qrCode: string; secret: string };
type Step =
  | { kind: "idle" }
  | { kind: "enroll"; enrollment: Enrollment }
  | { kind: "confirm"; action: "renew-codes" | "disable" }
  | { kind: "codes"; codes: string[] | null };

async function post(payload: Record<string, string>) {
  const res = await fetch("/api/auth/mfa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { res, body };
}

/**
 * Der zweite Faktor in den Einstellungen: einrichten (QR-Code oder Schlüssel, dann ein Code aus der App), die
 * Wiederherstellungscodes einmal zeigen, ausschalten und neue Codes nur mit einem Code aus der App (api/auth/mfa).
 */
export function TwoFactor() {
  const t = useT();
  const { toast } = useToast();
  const c = t.settings.twoFactor;
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/auth/mfa").catch(() => null);
      const body = res?.ok ? ((await res.json().catch(() => null)) as Status | null) : null;
      if (!cancelled && body) setStatus({ enabled: body.enabled, recoveryCodesLeft: body.recoveryCodesLeft });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function reset(next: Step = { kind: "idle" }) {
    setStep(next);
    setCode("");
    setError(null);
  }

  async function run(payload: Record<string, string>, onDone: (body: Record<string, unknown>) => void) {
    setBusy(true);
    setError(null);
    try {
      const { res, body } = await post(payload);
      if (res.ok && body) onDone(body);
      else setError(typeof body?.detail === "string" ? body.detail : c.failed);
    } catch {
      setError(c.failed);
    } finally {
      setBusy(false);
    }
  }

  const startEnroll = () =>
    run({ action: "enroll" }, (body) => reset({ kind: "enroll", enrollment: body as unknown as Enrollment }));

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind === "enroll") {
      void run({ action: "activate", factorId: step.enrollment.factorId, code }, (body) => {
        setStatus({ enabled: true, recoveryCodesLeft: null });
        reset({ kind: "codes", codes: (body.recoveryCodes as string[] | null) ?? null });
      });
    } else if (step.kind === "confirm" && step.action === "renew-codes") {
      void run({ action: "renew-codes", code }, (body) => reset({ kind: "codes", codes: body.recoveryCodes as string[] }));
    } else if (step.kind === "confirm") {
      void run({ action: "disable", code }, () => {
        setStatus({ enabled: false, recoveryCodesLeft: null });
        reset();
        toast({ title: c.disabled, variant: "success" });
      });
    }
  }

  async function copy(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast({ title: c.copied, variant: "success" });
    } catch {
      toast({ title: c.failed, variant: "error" });
    }
  }

  if (!status) return <Loader2 className="h-4 w-4 animate-spin text-tertiary" aria-hidden />;

  const codeForm = (
    <form onSubmit={submitCode} className="space-y-3">
      <div className="max-w-xs space-y-1.5">
        <label htmlFor="two-factor-code" className="block text-[13px] font-medium text-foreground">
          {c.codeLabel}
        </label>
        <Input
          id="two-factor-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="font-mono tracking-[0.2em]"
        />
      </div>
      {error && (
        <p className="text-[13px] text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || code.length !== 6}>
          {c.confirm}
        </Button>
        <Button type="button" variant="ghost" onClick={() => reset()} disabled={busy}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );

  if (step.kind === "enroll") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-secondary">{c.scan}</p>
        {/* Das Bild kommt als data:-Adresse von Supabase Auth, next/image hat dafür nichts zu tun. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={step.enrollment.qrCode} alt={c.qrAlt} width={176} height={176} className="rounded-lg bg-white p-2" />
        <div>
          <p className="text-[13px] text-secondary">{c.secretLabel}</p>
          <code data-testid="totp-secret" className="break-all font-mono text-[13px] text-foreground">
            {step.enrollment.secret}
          </code>
        </div>
        {codeForm}
      </div>
    );
  }

  if (step.kind === "codes") {
    const codes = step.codes;
    return (
      <div className="space-y-3">
        {codes ? (
          <>
            <p className="text-[14px] font-medium text-foreground">{c.codesTitle}</p>
            <p className="text-[13px] leading-relaxed text-secondary">{c.codesHint}</p>
            <ul data-testid="recovery-codes" className="grid gap-1 font-mono text-[13px] text-foreground sm:grid-cols-2">
              {codes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => void copy(codes)}>
                <Copy className="h-4 w-4" />
                {c.copy}
              </Button>
              <Button
                onClick={() => {
                  setStatus((current) => current && { ...current, recoveryCodesLeft: codes.length });
                  reset();
                }}
              >
                {c.saved}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-destructive" role="alert">
              {c.codesMissing}
            </p>
            <Button variant="ghost" onClick={() => reset()}>
              {c.saved}
            </Button>
          </>
        )}
      </div>
    );
  }

  if (step.kind === "confirm") {
    return (
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-secondary">{c.confirmAction}</p>
        {codeForm}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-secondary">{status.enabled ? c.on : c.off}</p>
        {status.enabled ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="ghost" onClick={() => reset({ kind: "confirm", action: "renew-codes" })}>
              {c.renew}
            </Button>
            <Button variant="ghost" onClick={() => reset({ kind: "confirm", action: "disable" })}>
              {c.disable}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="shrink-0" onClick={() => void startEnroll()} disabled={busy}>
            {c.enable}
          </Button>
        )}
      </div>
      {status.enabled && status.recoveryCodesLeft !== null && (
        <p className="text-[12px] text-tertiary">{fmt(c.codesLeft, { count: status.recoveryCodesLeft })}</p>
      )}
      {status.enabled && <p className="text-[12px] text-tertiary">{c.terminalNote}</p>}
      {error && (
        <p className="text-[13px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
