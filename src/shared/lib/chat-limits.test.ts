import { describe, it, expect } from "vitest";
import { LIST_LOAD_LIMIT, splitAtLimit, truncate } from "@/shared/lib/chat-limits";

// The list pages read LIST_LOAD_LIMIT + 1 rows via .range(0, LIST_LOAD_LIMIT)
// so they can tell "exactly full" from "there is more" without a second count
// query. splitAtLimit is the half of that contract that can be tested without
// a database; the .range() call itself is asserted by the page code reading
// the same constant.
describe("splitAtLimit", () => {
  it("keeps everything and reports no more when under the cap", () => {
    const { items, hasMore } = splitAtLimit([1, 2, 3], 10);
    expect(items).toEqual([1, 2, 3]);
    expect(hasMore).toBe(false);
  });

  it("reports no more when the result lands exactly on the cap", () => {
    // The case a plain .limit(n) cannot distinguish from "there are more",
    // which is the whole reason the queries over-fetch by one.
    const rows = Array.from({ length: 10 }, (_, i) => i);
    const { items, hasMore } = splitAtLimit(rows, 10);
    expect(items).toHaveLength(10);
    expect(hasMore).toBe(false);
  });

  it("trims the probe row and reports more when the cap is exceeded", () => {
    const rows = Array.from({ length: 11 }, (_, i) => i);
    const { items, hasMore } = splitAtLimit(rows, 10);
    expect(items).toHaveLength(10);
    // The extra row exists only to answer "is there more" — it must never be
    // rendered, or every capped list would show one row too many.
    expect(items).not.toContain(10);
    expect(hasMore).toBe(true);
  });

  it("handles an empty result", () => {
    expect(splitAtLimit([], 10)).toEqual({ items: [], hasMore: false });
  });

  it("defaults to LIST_LOAD_LIMIT", () => {
    const rows = Array.from({ length: LIST_LOAD_LIMIT + 1 }, (_, i) => i);
    const { items, hasMore } = splitAtLimit(rows);
    expect(items).toHaveLength(LIST_LOAD_LIMIT);
    expect(hasMore).toBe(true);
  });

  it("does not mutate the input", () => {
    const rows = [1, 2, 3];
    splitAtLimit(rows, 2);
    expect(rows).toEqual([1, 2, 3]);
  });
});

describe("truncate", () => {
  it("caps at max INCLUDING the ellipsis", () => {
    // Guards the off-by-one this function's own comment documents: appending
    // the ellipsis after slicing to max produced max + 1, exactly enough to
    // push a clamped reply back over the schema limit it was clamped to.
    expect(truncate("abcdefghij", 5)).toHaveLength(5);
  });

  it("leaves anything already short enough untouched", () => {
    expect(truncate("abc", 10)).toBe("abc");
  });
});
