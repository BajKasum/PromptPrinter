import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormError } from "./form-error";

describe("FormError", () => {
  it("meldet den Text als Alert", () => {
    render(<FormError>Das hat nicht geklappt.</FormError>);
    expect(screen.getByRole("alert")).toHaveTextContent("Das hat nicht geklappt.");
  });

  it.each([null, ""])("zeigt ohne Text nichts (%j)", (message) => {
    const { container } = render(<FormError>{message}</FormError>);
    expect(container).toBeEmptyDOMElement();
  });
});
