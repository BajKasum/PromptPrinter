"use client";

import "client-only";

import { useState, useEffect } from "react";
import { useAttachments } from "@/features/chat/hooks/use-attachments";
import { ATTACH_NOTICE_MS, describeRejection } from "@/features/chat/lib/chat-wire";
import { useLocale, useT } from "@/shared/i18n/provider";
import { LOCALE_TAGS } from "@/shared/i18n/locales";

// Die Anhaenge des Composers samt dem Hinweis, warum einer nicht dazukam. Aus chat.tsx herausgeloest (M7).
export function useAttachNotice() {
  const t = useT();
  const locale = useLocale();
  // Warum ein Anhang nicht dazukam. Inline über dem Composer, wie die anderen
  // Hinweise des Chats, und kein Toast: so braucht der Chat keinen
  // Toast-Provider um sich.
  const [attachNotice, setAttachNotice] = useState<string | null>(null);
  const attachments = useAttachments({
    onReject: (rejection) => {
      const text = describeRejection(rejection, t.chat, LOCALE_TAGS[locale].intl);
      setAttachNotice((previous) => (previous ? `${previous} ${text}` : text));
    },
  });
  useEffect(() => {
    if (!attachNotice) return;
    const timer = setTimeout(() => setAttachNotice(null), ATTACH_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [attachNotice]);
  function addFiles(files: File[]) {
    setAttachNotice(null);
    void attachments.add(files);
  }
  const clearAttachNotice = () => setAttachNotice(null);
  return { attachments, attachNotice, clearAttachNotice, addFiles };
}
