import { describe, it, expect, vi } from "vitest";
import { STORAGE_REMOVE_BATCH, chunkPaths, removeAllPaths } from "@/lib/storage-cleanup";

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
