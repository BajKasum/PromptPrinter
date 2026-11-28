import "@testing-library/jest-dom/vitest";
import * as webStreams from "node:stream/web";
import { afterAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// Im Pool `vmThreads` bekommt jede Datei ein eigenes Fenster, `process.env` teilen sich aber alle Dateien eines
// Workers. Ohne das Zurücksetzen gilt etwa ein gesetzter Turnstile-Schlüssel in der nächsten Datei weiter.
const environment = { ...process.env };
afterAll(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in environment)) delete process.env[key];
  }
  Object.assign(process.env, environment);
});

// This setup file also runs for the plain Node test project (src/lib), which
// has no DOM globals at all — only patch the jsdom gaps when jsdom is active.
if (typeof Element !== "undefined") {
  // Dem vm-Kontext (Pool `vmThreads`) fehlen die Web-Streams von Node, `@google/genai` braucht sie schon beim Laden.
  for (const name of ["ReadableStream", "WritableStream", "TransformStream", "TextDecoderStream", "TextEncoderStream"] as const) {
    if (!(name in globalThis)) {
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: webStreams[name] });
    }
  }

  // jsdom doesn't implement the Blob-URL APIs — several components (file
  // download buttons) call these, so stub them once globally instead of in
  // every test file that touches a download button.
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = () => "blob:mock";
  }
  if (typeof URL.revokeObjectURL !== "function") {
    URL.revokeObjectURL = () => {};
  }

  // jsdom doesn't implement scroll methods either — several components call
  // scrollIntoView to keep the chat transcript in view.
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
}
