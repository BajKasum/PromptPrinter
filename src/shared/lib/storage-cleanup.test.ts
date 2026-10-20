import { describe, it, expect, vi } from "vitest";
import {
  POSTGREST_PAGE_SIZE,
  STORAGE_REMOVE_BATCH,
  chunkPaths,
  collectStoragePaths,
  removeAllPaths,
} from "@/shared/lib/storage-cleanup";

describe("chunkPaths", () => {
  it("splits into batches of the given size", () => {
    expect(chunkPaths(["a", "b", "c", "d", "e"], 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  it("returns nothing for an empty list", () => {
    expect(chunkPaths([], 10)).toEqual([]);
  });

  it("keeps a list shorter than the batch in one chunk", () => {
    expect(chunkPaths(["a"], STORAGE_REMOVE_BATCH)).toEqual([["a"]]);
  });

  it("rejects a size that would loop forever", () => {
    expect(() => chunkPaths(["a"], 0)).toThrow();
  });
});

describe("removeAllPaths", () => {
  it("passes every path exactly once, in batches", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const paths = Array.from({ length: 250 }, (_, i) => `p${i}`);

    const result = await removeAllPaths(remove, paths, 100);

    expect(remove).toHaveBeenCalledTimes(3);
    expect(remove.mock.calls.flatMap((c) => c[0])).toEqual(paths);
    expect(result).toEqual({ removed: 250, failed: 0 });
  });

  it("does nothing when there is nothing to remove", async () => {
    const remove = vi.fn();
    expect(await removeAllPaths(remove, [], 10)).toEqual({ removed: 0, failed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("keeps going after a batch reports an error and counts it", async () => {
    // The point of batching independently: one bad batch must not strand the
    // rest, or a single hiccup leaves an entire account's files behind.
    const remove = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "boom" } })
      .mockResolvedValueOnce(undefined);

    const result = await removeAllPaths(remove, ["a", "b", "c", "d"], 2);

    expect(remove).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ removed: 2, failed: 2 });
  });

  it("keeps going after a batch throws", async () => {
    const remove = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);

    const result = await removeAllPaths(remove, ["a", "b"], 1);

    expect(remove).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ removed: 1, failed: 1 });
  });
});

describe("collectStoragePaths", () => {
  const rows = (n: number, prefix = "p") =>
    Array.from({ length: n }, (_, i) => ({ storage_path: `${prefix}${i}` }));

  it("stops after a page shorter than the page size", async () => {
    const page = vi.fn().mockResolvedValue({ data: rows(3), error: null });
    expect(await collectStoragePaths(page, 5)).toEqual(["p0", "p1", "p2"]);
    expect(page).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledWith(0, 4);
  });

  it("reads the next page after a full one, with inclusive ranges", async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: rows(5, "a"), error: null })
      .mockResolvedValueOnce({ data: rows(2, "b"), error: null });

    const paths = await collectStoragePaths(page, 5);

    expect(page.mock.calls).toEqual([
      [0, 4],
      [5, 9],
    ]);
    expect(paths).toEqual(["a0", "a1", "a2", "a3", "a4", "b0", "b1"]);
  });

  it("asks once more after exactly one full page, and stops at the empty one", async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: rows(5), error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    expect(await collectStoragePaths(page, 5)).toHaveLength(5);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list for no rows, and treats null data as no rows", async () => {
    expect(await collectStoragePaths(vi.fn().mockResolvedValue({ data: [], error: null }), 5)).toEqual([]);
    expect(await collectStoragePaths(vi.fn().mockResolvedValue({ data: null, error: null }), 5)).toEqual([]);
  });

  it("uses PostgREST's page size of 1000 by default", async () => {
    const page = vi.fn().mockResolvedValue({ data: [], error: null });
    await collectStoragePaths(page);
    expect(POSTGREST_PAGE_SIZE).toBe(1000);
    expect(page).toHaveBeenCalledWith(0, 999);
  });

  it("throws on a read error instead of returning half a list", async () => {
    const boom = new Error("relation does not exist");
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: rows(5), error: null })
      .mockResolvedValueOnce({ data: null, error: boom });
    await expect(collectStoragePaths(page, 5)).rejects.toBe(boom);
  });

  it("rejects a page size that would loop forever", async () => {
    await expect(collectStoragePaths(vi.fn(), 0)).rejects.toThrow();
  });
});
