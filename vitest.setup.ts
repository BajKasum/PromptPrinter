import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// This setup file also runs for the plain Node test project (src/lib), which
// has no DOM globals at all — only patch the jsdom gaps when jsdom is active.
if (typeof Element !== "undefined") {
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
