"use client";

import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { useT } from "@/shared/i18n/provider";

/**
 * Die Frage vor dem ersten Diktat: der Browser schickt die Aufnahme zur
 * Erkennung an Google bzw. Microsoft (Chrome, Edge) oder behält sie auf dem
 * Gerät (Safari). Ablehnen ändert nichts, der Chat läuft weiter über die Tastatur.
 */
export function VoiceConsentDialog({
  open,
  onAccept,
  onCancel,
}: {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <ConfirmDialog
      open={open}
      tone="neutral"
      title={t.voice.consentTitle}
      description={
        <>
          {t.voice.consentBody}{" "}
          <a
            href="/datenschutz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-text underline underline-offset-2"
          >
            {t.voice.privacyLink}
          </a>
        </>
      }
      confirmLabel={t.voice.consentAccept}
      busyLabel={t.voice.consentAccept}
      onConfirm={onAccept}
      onCancel={onCancel}
    />
  );
}
