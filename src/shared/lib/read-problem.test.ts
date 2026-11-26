import { describe, expect, it } from "vitest";
import { UserError, failureText, readJson, readProblem } from "./read-problem";

// #408: acht Komponenten zeigten im Fehlerfall die Meldung des Browsers. Der Helfer liest JSON nur bei einem
// JSON-content-type und übersetzt, was nicht von der Route oder aus dem Wörterbuch kommt.

const texts = { network: "Netz weg.", fallback: "Das ging nicht." };

function jsonResponse(body: string, contentType: string | null, status = 400) {
  return new Response(body, { status, headers: contentType === null ? {} : { "content-type": contentType } });
}

describe("readJson", () => {
  it.each(["application/json", "application/problem+json", "Application/JSON; charset=utf-8", "application/ld+json"])(
    "liest bei content-type %s",
    async (type) => {
      expect(await readJson(jsonResponse('{"detail":"x"}', type))).toEqual({ detail: "x" });
    }
  );

  it.each([["text/html; charset=utf-8"], ["text/plain"], ["application/jsonp"], ["application/octet-stream"], [null]])(
    "liest bei content-type %s nichts, auch wenn der Rumpf JSON wäre",
    async (type) => {
      expect(await readJson(jsonResponse('{"detail":"x"}', type))).toBeNull();
    }
  );

  it.each(["<!DOCTYPE html><html></html>", "", '{"detail":"abgeschn'])(
    "liest bei einem Rumpf, der kein JSON ist (%s), trotz JSON-content-type nichts",
    async (body) => {
      expect(await readJson(jsonResponse(body, "application/json"))).toBeNull();
    }
  );
});

describe("readProblem", () => {
  it("übernimmt detail, kind und code der Route", async () => {
    const problem = await readProblem(
      jsonResponse('{"detail":"Nein.","kind":"unknownProvider","code":"reauth_required"}', "application/problem+json"),
      "Ersatz."
    );
    expect(problem).toBeInstanceOf(UserError);
    expect(problem.message).toBe("Nein.");
    expect(problem.kind).toBe("unknownProvider");
    expect(problem.code).toBe("reauth_required");
  });

  it("nimmt bei einer HTML-Seite (504) den Ersatztext, nicht den Rumpf", async () => {
    const problem = await readProblem(jsonResponse("<!DOCTYPE html><h1>504 Gateway Timeout</h1>", "text/html", 504), "Ersatz.");
    expect(problem.message).toBe("Ersatz.");
    expect(problem.kind).toBeNull();
    expect(problem.code).toBeNull();
  });

  it.each(['{}', '{"detail":""}', '{"detail":42,"kind":7}', "null", "[]"])(
    "nimmt ohne lesbaren Text (%s) den Ersatztext",
    async (body) => {
      const problem = await readProblem(jsonResponse(body, "application/problem+json", 500), "Ersatz.");
      expect(problem.message).toBe("Ersatz.");
      expect(problem.kind).toBeNull();
    }
  );
});

describe("failureText", () => {
  it("zeigt die Meldung eines UserError", () => {
    expect(failureText(new UserError("Von der Route."), texts)).toBe("Von der Route.");
  });

  it("übersetzt einen TypeError (kein Netz) in den Netzwerk-Text", () => {
    expect(failureText(new TypeError("Failed to fetch"), texts)).toBe("Netz weg.");
  });

  it.each([
    ["SyntaxError", new SyntaxError('Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON')],
    ["Error", new Error("duplicate key value violates unique constraint")],
    ["DOMException", new DOMException("The operation was aborted.", "AbortError")],
    ["Zeichenkette", "kaputt"],
    ["nichts", undefined],
  ])("nimmt für %s den Ersatztext der Aktion, nie die Meldung selbst", (_name, thrown) => {
    expect(failureText(thrown, texts)).toBe("Das ging nicht.");
  });
});
