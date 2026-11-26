import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rowsClient } from "@tests/support/supabase-rows";
import SettingsPage from "./page";

// Die Einstellungen zeigen die hinterlegten Keys, den aktiven und den eigenen Endpunkt. Das kommt aus EINER Abfrage auf
// user_api_keys, und den Nutzer liefert getSessionUser(): der Client hier hat gar kein `auth`.
const client = rowsClient({
  profiles: [{ id: "user-1", display_name: "Anna", plan: "free", is_admin: false, about_me: "Ich koche." }],
  user_api_keys: [
    { user_id: "user-1", provider: "openai", is_active: false, label: null, base_url: null, model: null },
    { user_id: "user-1", provider: "custom", is_active: true, label: "Mein Gateway", base_url: "https://api.example.com", model: "m" },
    { user_id: "user-2", provider: "anthropic", is_active: true, label: null, base_url: null, model: null },
  ],
});
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ id: "user-1", email: "anna@example.test", app_metadata: {} }),
}));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de };
});
vi.mock("@/shared/motion/fade-in", () => ({ FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
const workspace = vi.fn();
vi.mock("@/features/settings/components/settings-workspace", () => ({
  SettingsWorkspace: (props: Record<string, unknown>) => {
    workspace(props);
    return <p>Arbeitsbereich</p>;
  },
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    client.reads.length = 0;
    workspace.mockClear();
  });

  it("liest user_api_keys genau einmal, auf das Konto eingegrenzt", async () => {
    await SettingsPage();
    const reads = client.reads.filter((read) => read.table === "user_api_keys");
    expect(reads).toHaveLength(1);
    expect(reads[0].filters).toEqual([["eq", "user_id", "user-1"]]);
  });

  it("gibt Anbieter, aktiven Key und Endpunkt dieses Kontos weiter", async () => {
    render(await SettingsPage());
    expect(screen.getByText("Arbeitsbereich")).toBeInTheDocument();
    expect(workspace).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        configuredProviders: ["openai", "custom"],
        activeProvider: "custom",
        customProvider: { label: "Mein Gateway", baseUrl: "https://api.example.com", model: "m" },
        aboutMe: "Ich koche.",
      })
    );
  });
});
