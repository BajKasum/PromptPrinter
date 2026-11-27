import { describe, expect, it } from "vitest";
import { avatarStoragePath } from "./avatar";

describe("avatarStoragePath", () => {
  // Migration 0027 legt Altobjekte auf genau diesen Namen fest; das Löschen eines Kontos räumt nur ihn weg.
  it("baut den einen Pfad, unter dem ein Profilbild liegen kann", () => {
    expect(avatarStoragePath("1f2dec37-0c95-49b2-a6af-554a47ea171c")).toBe(
      "1f2dec37-0c95-49b2-a6af-554a47ea171c/avatar"
    );
  });
});
