import { beforeEach, describe, expect, it, vi } from "vitest";
import { de } from "@/shared/i18n/messages/de";

// Der Fehlerweg der Gedächtnis-Analyse: welcher Code nach aussen und in die Zeile geht, nie der Wortlaut des Fehlers,
// und dass ein gescheitertes Schreiben des Status die Antwort nicht ändert.

const captureError = vi.fn();
vi.mock("@/shared/lib/observability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/observability")>();
  return { ...actual, captureError: (...a: unknown[]) => captureError(...a) };
});

import { reportAnalysisFailure } from "./analysis-failure";
import { BrainAnalysisError } from "./analyze";
import { GithubImportError } from "./github";

type Admin = Parameters<typeof reportAnalysisFailure>[1]["admin"];
type Update = { table: string; values: Record<string, unknown>; filters: [string, unknown][] };

/** Ein Service-Role-Client, der nur update kennt und mitschreibt, was er schreiben soll. */
function adminWith(error: unknown = null) {
  const updates: Update[] = [];
  const admin = {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => {
        const update: Update = { table, values, filters: [] };
        updates.push(update);
        const chain = {
          eq: (column: string, value: unknown) => {
            update.filters.push([column, value]);
            return chain;
          },
          then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error }),
        };
        return chain;
      },
    }),
  };
  return { admin: admin as unknown as Admin, updates };
}

const context = (admin: Admin) => ({ admin, projectId: "p1", userId: "u1", byok: false, startedAt: Date.now(), m: de.api });

describe("reportAnalysisFailure", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["einem GitHub-Fehler", new GithubImportError("repo_not_found", "404 von api.github.com/repos/acme/geheim"), "repo_not_found", de.api.brainErrors.repo_not_found],
    ["einem Fehler der Analyse", new BrainAnalysisError("analysis_unparsable", "glm-4.5-air lieferte kein JSON"), "analysis_unparsable", de.api.brainErrors.analysis_unparsable],
    ["jedem anderen Fehler", new Error('relation "project_brains" does not exist'), "analysis_failed", de.api.brainErrors.other],
  ])("nimmt bei %s den stabilen Code und den Text dazu, nie den Wortlaut", async (_label, err, code, detail) => {
    const { admin, updates } = adminWith();

    const res = await reportAnalysisFailure(err, context(admin));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toMatchObject({ status: 502, code, detail });
    expect(JSON.stringify(body)).not.toContain(err.message);
    expect(updates).toEqual([
      {
        table: "project_brains",
        values: expect.objectContaining({ status: "failed", error_code: code }),
        filters: [
          ["project_id", "p1"],
          ["user_id", "u1"],
        ],
      },
    ]);
    expect(JSON.stringify(updates)).not.toContain(err.message);
    expect(captureError).toHaveBeenCalledWith("brain.analysis_failed", err, expect.objectContaining({ code, userId: "u1" }));
  });

  it("antwortet gleich, wenn der Status nicht geschrieben werden kann, und meldet das", async () => {
    const writeError = { message: "connection reset" };
    const { admin } = adminWith(writeError);

    const res = await reportAnalysisFailure(new Error("boom"), context(admin));

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "analysis_failed", detail: de.api.brainErrors.other });
    expect(captureError).toHaveBeenCalledWith("brain.failed_status_write_failed", writeError, { userId: "u1", projectId: "p1" });
  });
});
