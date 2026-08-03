import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULE_HINT,
  PASSWORD_TOO_SHORT_MESSAGE,
  isPasswordLongEnough,
} from "./password";

// Security-Audit finding M-5. The rule used to be the literal 8 copied into
// four files; these lock the single source of truth in place and keep the two
// user-facing sentences derived from it rather than retyped.
describe("password rule", () => {
  it("requires at least 10 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
  });

  it("rejects anything shorter", () => {
    expect(isPasswordLongEnough("x".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
  });

  it("accepts exactly the minimum", () => {
    expect(isPasswordLongEnough("x".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });

  it("accepts longer", () => {
    expect(isPasswordLongEnough("x".repeat(MIN_PASSWORD_LENGTH + 20))).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(isPasswordLongEnough("")).toBe(false);
  });

  // Both strings are shown to users; deriving them means raising the constant
  // can't leave a form telling people the old number.
  it("derives both user-facing sentences from the constant", () => {
    expect(PASSWORD_RULE_HINT).toContain(String(MIN_PASSWORD_LENGTH));
    expect(PASSWORD_TOO_SHORT_MESSAGE).toContain(String(MIN_PASSWORD_LENGTH));
  });
});
