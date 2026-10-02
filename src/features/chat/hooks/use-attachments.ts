"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  prepareAttachment,
  type DraftAttachment,
  type PrepareDeps,
  type RejectReason,
} from "@/features/chat/lib/prepare-attachment";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENTS_REQUEST_BYTES,
} from "@/shared/lib/chat-limits";

// Die Anhänge, die im Composer auf ihre Nachricht warten.
//
// Eigener Hook statt noch mehr State in chat.tsx: der Orchestrator ist ohnehin
// der längste Teil des Chats, und "Dateien aufbereiten, Limits zählen,
// Ablehnungen melden" ist eine in sich geschlossene Sache.

/** Warum ein Anhang nicht dazukam. Über die Aufbereitung hinaus kennt der Hook zwei eigene Gründe. */
export type AttachRejection =
  | { reason: RejectReason; name: string; maxBytes?: number }
  | { reason: "limit"; name: string }
  | { reason: "totalTooLarge"; name: string };

export function useAttachments(opts: {
  onReject: (rejection: AttachRejection) => void;
  /** Nur für Tests: andere Browser-Fähigkeiten (kein Canvas in jsdom). */
  deps?: PrepareDeps;
}) {
  const [items, setItems] = useState<DraftAttachment[]>([]);
  // Wie viele Dateien gerade verkleinert werden. Zählen mit, damit zwei schnell
  // hintereinander gewählte Auswahlen das Limit nicht gemeinsam überspringen.
  const [pending, setPending] = useState(0);

  // Synchrone Spiegel für `add`: zwei Aufrufe im selben Tick sehen sonst beide
  // den Stand von vor dem ersten.
  const itemsRef = useRef<DraftAttachment[]>([]);
  const pendingRef = useRef(0);
  const mountedRef = useRef(true);
  const onRejectRef = useRef(opts.onReject);
  useEffect(() => {
    onRejectRef.current = opts.onReject;
  });
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const commit = useCallback((next: DraftAttachment[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const add = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;

      const room = Math.max(0, MAX_ATTACHMENTS_PER_MESSAGE - itemsRef.current.length - pendingRef.current);
      const accepted = files.slice(0, room);
      // Eine Meldung genügt: "höchstens 4", egal wie viele darüber hinaus kamen.
      if (files.length > room) onRejectRef.current({ reason: "limit", name: files[room].name });
      if (accepted.length === 0) return;

      pendingRef.current += accepted.length;
      setPending(pendingRef.current);

      const results = await Promise.all(accepted.map((file) => prepareAttachment(file, opts.deps)));

      pendingRef.current -= accepted.length;
      if (!mountedRef.current) return;
      setPending(pendingRef.current);

      // In Auswahl-Reihenfolge übernehmen. Die Gesamtgrenze zählt hier, nicht
      // vorher: erst jetzt sind die Grössen nach dem Verkleinern bekannt.
      const next = [...itemsRef.current];
      let total = next.reduce((sum, a) => sum + a.sizeBytes, 0);
      accepted.forEach((file, i) => {
        const result = results[i];
        if (!result.ok) {
          onRejectRef.current({ reason: result.reason, name: file.name, maxBytes: result.maxBytes });
          return;
        }
        if (total + result.attachment.sizeBytes > MAX_ATTACHMENTS_REQUEST_BYTES) {
          onRejectRef.current({ reason: "totalTooLarge", name: file.name });
          return;
        }
        total += result.attachment.sizeBytes;
        next.push(result.attachment);
      });
      commit(next);
    },
    [commit, opts.deps]
  );

  const remove = useCallback(
    (id: string) => commit(itemsRef.current.filter((a) => a.id !== id)),
    [commit]
  );

  const clear = useCallback(() => commit([]), [commit]);

  /** Stellt Anhänge wieder her, zum Beispiel nach einem gescheiterten Senden. */
  const restore = useCallback((list: DraftAttachment[]) => commit(list), [commit]);

  return { items, pending, add, remove, clear, restore };
}
