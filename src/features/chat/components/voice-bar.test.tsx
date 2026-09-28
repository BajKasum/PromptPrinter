import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoiceBar } from "./voice-bar";

// The bar's real work (microphone, Web Speech API, canvas waveform) has no
// jsdom equivalent. Stubbing the three hooks and the canvas keeps this test
// about what the bar tells the user, which is what the notice below is.
const speech = { final: "", interim: "", supported: true, error: null as string | null, reset: vi.fn() };

vi.mock("@/features/chat/hooks/use-mic-analyser", () => ({
  useMicAnalyser: () => ({ status: "live", error: null, readHalf: () => 0 }),
}));
vi.mock("@/features/chat/hooks/use-speech-recognition", () => ({
  useSpeechRecognition: () => speech,
}));
vi.mock("@/features/chat/hooks/use-visual-viewport-inset", () => ({
  useVisualViewportInset: () => 0,
}));
vi.mock("@/features/chat/components/voice-waveform", () => ({
  VoiceWaveform: () => null,
}));

describe("VoiceBar", () => {
  beforeEach(() => {
    speech.supported = true;
  });

  // Chrome and Edge stream the microphone to Google/Microsoft for recognition.
  // The user has to learn that where the recording starts, not only in the
  // privacy policy (Rechts-Audit 28.09.2026).
  it("says where the recording goes and links the privacy policy", () => {
    render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(async () => null)} />);

    expect(screen.getByText(/an Google bzw\. Microsoft/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Datenschutz" });
    expect(link).toHaveAttribute("href", "/datenschutz");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("drops the notice when the browser cannot recognise speech at all", () => {
    speech.supported = false;
    render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(async () => null)} />);

    expect(screen.queryByText(/an Google bzw\. Microsoft/)).not.toBeInTheDocument();
    expect(screen.getByText(/kann noch nicht mithören/)).toBeInTheDocument();
  });
});
