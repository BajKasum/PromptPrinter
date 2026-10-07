import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_USER_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import type { AttachmentErrorCode } from "@/features/chat/lib/attachment-store";
import type { classifyLlmFailure } from "@/server/llm";
import type { Messages } from "@/shared/i18n/messages/de";
import { fmt } from "@/shared/i18n/format";

// Wie ein abgewiesener oder gescheiterter Chat-Zug beim Nutzer ankommt: deutsch, handlungsleitend,
// nie mit dem Rohtext des Anbieters. Aus api/chat/route.ts herausgeloest (M7).

// A German, actionable detail for the validation failures a real client can
// actually produce. Everything else stays generic. The rest of QA finding
// U-4 (raw provider error text reaching the client) is handled by
// describeLlmFailure below.
export function describeValidationFailure(
  issues: { code: string; path: readonly PropertyKey[] }[],
  m: Messages["api"],
  intlTag: string
): string {
  const overlongMessage = issues.some(
    (issue) =>
      issue.code === "too_big" && issue.path[0] === "messages" && issue.path.at(-1) === "content"
  );
  if (overlongMessage) {
    return fmt(m.messageTooLong, { max: MAX_USER_MESSAGE_CHARS.toLocaleString(intlTag) });
  }
  return m.unprocessableReload;
}

// Wie ein abgelehnter Anhang beim Nutzer ankommt. Der Dateiname steht bewusst
// NICHT in der Meldung: die Oberflaeche kennt ihn und prueft Format und Groesse
// ohnehin schon vor dem Senden, hier landet nur, was ein direkter POST oder ein
// alter Tab an dieser Pruefung vorbeigeschmuggelt hat.
export function describeAttachmentError(code: AttachmentErrorCode, m: Messages["api"]): string {
  switch (code) {
    case "unsupported":
      return m.attachmentUnsupported;
    case "invalid":
      return m.attachmentInvalid;
    case "tooLarge":
      return m.attachmentTooLarge;
    case "tooLargeTotal":
      return m.attachmentTotalTooLarge;
    case "tooMany":
      return fmt(m.attachmentTooMany, { max: MAX_ATTACHMENTS_PER_MESSAGE });
  }
}

// German, non-leaking text for a failed model call (QA finding U-4). The
// route used to embed err.message verbatim into the client-visible detail —
// raw provider text like "Z.ai 429: Rate limit exceeded for model
// glm-4.5-air", English mid a German product and a small disclosure of which
// model/provider runs underneath. classifyLlmFailure buckets the error;
// captureError (at the call site) still gets the original for the logs.
export function describeLlmFailure(
  kind: ReturnType<typeof classifyLlmFailure>,
  m: Messages["api"]
): string {
  switch (kind) {
    case "rate_limited":
      return m.llm.rate_limited;
    case "auth":
      return m.llm.auth;
    case "unavailable":
      return m.llm.unavailable;
    case "empty":
      return m.llm.empty;
    default:
      return m.llm.other;
  }
}
