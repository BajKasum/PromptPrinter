import { afterEach, describe, expect, it, vi } from "vitest";
import { locationSearchParam, nextPathFromLocation } from "./location-search";

const at = (search: string) => vi.stubGlobal("window", { location: { search } });

afterEach(() => vi.unstubAllGlobals());

describe("locationSearchParam", () => {
  it("liest einen Wert der aktuellen Adresse, dekodiert", () => {
    at("?error=oauth_cancelled&next=%2Fprojects%2F42");
    expect(locationSearchParam("error")).toBe("oauth_cancelled");
    expect(locationSearchParam("next")).toBe("/projects/42");
  });

  it("gibt null, wenn der Wert fehlt", () => {
    at("");
    expect(locationSearchParam("error")).toBeNull();
  });
});

describe("nextPathFromLocation", () => {
  it("nimmt einen Pfad dieser Seite", () => {
    at("?next=/projects/42?tab=chats");
    expect(nextPathFromLocation()).toBe("/projects/42?tab=chats");
  });

  it("fällt ohne next auf den Chat zurück", () => {
    at("");
    expect(nextPathFromLocation()).toBe("/chats/new");
  });

  it.each(["https://evil.example/phish", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "folgt keiner fremden Adresse (%s)",
    (next) => {
      at(`?${new URLSearchParams({ next })}`);
      expect(nextPathFromLocation()).toBe("/chats/new");
    }
  );
});
