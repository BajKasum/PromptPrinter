import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildModelHistory } from "./model-history";

const loadAttachmentRecords = vi.hoisted(() => vi.fn());
vi.mock("@/features/chat/lib/attachment-store", () => ({
  loadAttachmentRecords,
  groupByMessage: () => new Map(),
  downloadAttachment: vi.fn(),
}));

const ID = "0b6f1c2e-6a1d-4c8e-9f0a-1b2c3d4e5f60";

const history = (ids: string[]) =>
  buildModelHistory({
    supabase: {} as never,
    userId: "u1",
    conversationId: "c1",
    window: ids.map((id) => ({ id, role: "user" as const, content: "hallo" })),
    newMessageId: null,
  });

beforeEach(() => {
  loadAttachmentRecords.mockReset();
  loadAttachmentRecords.mockResolvedValue([]);
});

describe("buildModelHistory: welche IDs an die Datenbank gehen", () => {
  // Die IDs kommen aus der Anfrage. Postgres lehnte eine erfundene mit einem Fehler ab, und damit alle Anhänge des Zugs.
  it("fragt nur nach IDs, die eine UUID sind", async () => {
    await history(["erfunden", ID]);

    expect(loadAttachmentRecords).toHaveBeenCalledExactlyOnceWith({}, "u1", "c1", [ID]);
  });

  it("fragt gar nicht, wenn keine ID eine UUID ist", async () => {
    const { messages } = await history(["erfunden"]);

    expect(loadAttachmentRecords).not.toHaveBeenCalled();
    expect(messages).toEqual([{ role: "user", content: "hallo" }]);
  });
});
