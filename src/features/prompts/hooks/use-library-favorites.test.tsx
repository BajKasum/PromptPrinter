import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { failedWrite, okWrite, type QueryChain } from "@tests/support/supabase-query";
import { useLibraryFavorites } from "@/features/prompts/hooks/use-library-favorites";
import type { LibraryItem } from "@/features/prompts/hooks/use-library-filter";
import { de } from "@/shared/i18n/messages/de";

// Favoriten der Projektliste: der Stern wechselt sofort, und scheitert das Schreiben, geht er zurück und es steht ein
// Hinweis. Geschrieben wird nur die eigene Zeile (RLS und zusätzlich user_id).

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();
const from = vi.fn();
let write: QueryChain<{ error: { message: string } | null }>;

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      from(table);
      return {
        update: (patch: unknown) => {
          update(patch);
          return write;
        },
      };
    },
  }),
}));

const item = (id: string, isFavorite: boolean): LibraryItem => ({
  id,
  name: id,
  updatedAt: "2026-11-01T10:00:00.000Z",
  savedPromptCount: 0,
  chatCount: 0,
  isFavorite,
});

const setup = () => renderHook(() => useLibraryFavorites([item("p-fav", true), item("p-plain", false)], "user-1"));
const favorites = (result: ReturnType<typeof setup>["result"]) => [...result.current.favorites].sort();

beforeEach(() => {
  refresh.mockReset();
  toast.mockReset();
  update.mockReset();
  from.mockReset();
  write = okWrite();
});

describe("useLibraryFavorites", () => {
  it("beginnt mit den Favoriten der Liste", () => {
    const { result } = setup();
    expect(favorites(result)).toEqual(["p-fav"]);
  });

  it.each([
    ["setzt", "p-plain", true, ["p-fav", "p-plain"]],
    ["nimmt zurück", "p-fav", false, []],
  ])("%s den Favoriten und schreibt nur die eigene Zeile", async (_name, id, value, expected) => {
    const { result } = setup();

    await act(() => result.current.toggleFavorite(id));

    expect(favorites(result)).toEqual(expected);
    expect(from).toHaveBeenCalledWith("projects");
    expect(update).toHaveBeenCalledWith({ is_favorite: value });
    expect(write.calls).toEqual([
      ["id", id],
      ["user_id", "user-1"],
    ]);
    // Die angepinnten Projekte der Seitenleiste rendert der Server.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it("zeigt den neuen Stand sofort, bevor die Datenbank geantwortet hat", async () => {
    let answer!: (value: { error: null }) => void;
    const pending = new Promise<{ error: null }>((resolve) => {
      answer = resolve;
    });
    write.then = (resolve) => pending.then(resolve);
    const { result } = setup();

    let done!: Promise<void>;
    act(() => {
      done = result.current.toggleFavorite("p-plain");
    });
    expect(favorites(result)).toEqual(["p-fav", "p-plain"]);
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      answer({ error: null });
      await done;
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["beim Setzen", "p-plain"],
    ["beim Zurücknehmen", "p-fav"],
  ])("geht bei einem Fehler %s zurück, meldet ihn und lädt nichts neu", async (_name, id) => {
    write = failedWrite("permission denied");
    const { result } = setup();

    await act(() => result.current.toggleFavorite(id));

    expect(favorites(result)).toEqual(["p-fav"]);
    expect(toast).toHaveBeenCalledWith({
      title: de.library.favoriteFailed,
      description: de.library.tryAgain,
      variant: "error",
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
