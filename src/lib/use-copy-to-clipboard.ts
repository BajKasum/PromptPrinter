"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard with a brief "copied" flash — the exact pattern that
 * used to be duplicated in both the assistant-reply copy button and the
 * code-block copy button (chat.tsx), each with its own copy()/copied/
 * setTimeout trio.
 */
export function useCopyToClipboard(resetDelayMs = 1500) {
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), resetDelayMs);
  }

  return { copied, copy };
}
