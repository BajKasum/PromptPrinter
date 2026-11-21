import { describe, expect, it, vi } from "vitest";
import { adoptPrefilledCheck, adoptPrefilledValue } from "./prefilled-input";

const field = (props: Partial<HTMLInputElement>) => props as HTMLInputElement;

describe("adoptPrefilledValue", () => {
  it("gibt einen eingetragenen Wert weiter", () => {
    const adopt = vi.fn();
    adoptPrefilledValue(field({ value: "user@example.com" }), adopt);
    expect(adopt).toHaveBeenCalledWith("user@example.com");
  });

  it("lässt ein leeres Feld und ein fehlendes Feld in Ruhe", () => {
    const adopt = vi.fn();
    adoptPrefilledValue(field({ value: "" }), adopt);
    adoptPrefilledValue(null, adopt);
    expect(adopt).not.toHaveBeenCalled();
  });
});

describe("adoptPrefilledCheck", () => {
  it("gibt ein gesetztes Häkchen weiter", () => {
    const adopt = vi.fn();
    adoptPrefilledCheck(field({ checked: true }), adopt);
    expect(adopt).toHaveBeenCalledWith(true);
  });

  it("lässt ein leeres Häkchen und ein fehlendes Feld in Ruhe", () => {
    const adopt = vi.fn();
    adoptPrefilledCheck(field({ checked: false }), adopt);
    adoptPrefilledCheck(null, adopt);
    expect(adopt).not.toHaveBeenCalled();
  });
});
