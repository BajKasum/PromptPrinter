import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useShareStatus } from "./use-share-status";

const TOKEN = "abcdefghijABCDEFGHIJ0123456789_-";
const fetchMock = vi.fn();
const answer = (token: string | null) => Promise.resolve({ ok: true, json: async () => ({ token }) } as Response);

describe("useShareStatus", () => {
  beforeEach(() => {
    fetchMock.mockReset().mockImplementation(() => answer(null));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fragt bei einer zugeklappten Karte nichts ab", () => {
    const { result } = renderHook(() => useShareStatus("p1", false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.share).toEqual({ status: "loading" });
  });

  it("lädt beim Aufklappen und bei jedem erneuten Aufklappen neu", async () => {
    const { result, rerender } = renderHook(({ open }) => useShareStatus("p1", open), { initialProps: { open: true } });
    await waitFor(() => expect(result.current.share).toEqual({ status: "private" }));

    fetchMock.mockImplementation(() => answer(TOKEN));
    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(result.current.share).toEqual({ status: "shared", token: TOKEN }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("übernimmt eine Änderung aus der Leiste und lädt auf Wunsch neu", async () => {
    const { result } = renderHook(() => useShareStatus("p1", true));
    await waitFor(() => expect(result.current.share).toEqual({ status: "private" }));

    act(() => result.current.setShare({ status: "shared", token: TOKEN }));
    expect(result.current.share).toEqual({ status: "shared", token: TOKEN });

    fetchMock.mockImplementation(() => new Promise(() => {}));
    act(() => result.current.reload());
    expect(result.current.share).toEqual({ status: "loading" });
  });

  it("verwirft eine Antwort, die nach dem Zuklappen ankommt", async () => {
    let finish: (value: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const { result, rerender } = renderHook(({ open }) => useShareStatus("p1", open), { initialProps: { open: true } });
    rerender({ open: false });
    await act(async () => finish({ ok: true, json: async () => ({ token: TOKEN }) } as Response));
    expect(result.current.share).toEqual({ status: "loading" });
  });
});
