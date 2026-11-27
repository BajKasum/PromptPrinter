import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Jede Funktion, die einen Anbieter fragt, nimmt genau EIN Objekt (types.ts: ProviderChatCall und die anderen). Modell,
// Systemprompt, Text und Key sind alle Strings: in einer Positionsliste kompilierte ein vertauschter Aufruf weiter.
// Gelesen wird der Quelltext, weil `Function.length` einen Parameter mit Vorgabewert nicht mitzählt.

const DIR = join(process.cwd(), "src/server/llm");
/** Namen wie `geminiAnalyze`, `customCompleteStream` oder `chatCompleteOnce`. */
const CALL_NAME = /(Complete|CompleteStream|Analyze)(Once)?$/;

function providerFunctions(): { name: string; parameters: number }[] {
  return readdirSync(DIR)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .flatMap((file) => {
      const source = ts.createSourceFile(file, readFileSync(join(DIR, file), "utf8"), ts.ScriptTarget.Latest);
      return source.statements
        .filter(ts.isFunctionDeclaration)
        .filter((fn) => CALL_NAME.test(fn.name?.text ?? ""))
        .map((fn) => ({ name: fn.name!.text, parameters: fn.parameters.length }));
    });
}

describe("Aufrufform der Anbieterfunktionen", () => {
  it("findet die Funktionen jedes Anbieters", () => {
    expect(providerFunctions().map((fn) => fn.name)).toEqual(
      expect.arrayContaining([
        "anthropicComplete",
        "anthropicCompleteStream",
        "anthropicAnalyze",
        "openaiComplete",
        "openaiCompleteStream",
        "openaiAnalyze",
        "geminiComplete",
        "geminiCompleteStream",
        "geminiAnalyze",
        "customComplete",
        "customCompleteStream",
        "zaiCompleteStream",
        "openAiCompatibleAnalyze",
      ])
    );
  });

  it("jede nimmt genau ein Objekt, nie eine Liste von Positionsparametern", () => {
    expect(providerFunctions().filter((fn) => fn.parameters !== 1)).toEqual([]);
  });
});
