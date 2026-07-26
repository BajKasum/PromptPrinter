"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard with a brief "copied" flash, the exact pattern that
 * used to be duplicated in both the assistant-reply copy button and the
 * code-block copy button (chat.tsx), each with its own copy()/copied/
 * setTimeout trio.
 */
export function useCopyToClipboard(resetDelayMs = 1500) {
  const [copied, setCopied] = useState(false);
  // Bumped on every copy() call regardless of current state, so a caller
  // animating the "copied" flourish (see CopyMoment) can restart it on a
  // rapid re-click, even while `copied` is already true.
  const [copyCount, setCopyCount] = useState(0);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setCopyCount((n) => n + 1);
    setTimeout(() => setCopied(false), resetDelayMs);
  }

  return { copied, copy, copyCount };
}
