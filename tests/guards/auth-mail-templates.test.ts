import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Die deutschen Auth-Mail-Vorlagen (supabase/templates/*.html, Betriebs-Audit M9).
//
// Sie liegen im Repository, weil sie ein Teil des Vertrags mit der App sind und im
// Dashboard sonst ungeprüft stehen: ein Link, der nicht über /auth/callback läuft,
// bricht den Passwort-Reset und die Bestätigung STUMM, erst in Produktion (lokal
// ist Mail aus). Dieser Test hält fest, was die Route erwartet
// (src/app/auth/callback/route.ts): `token_hash` + `type`, ein `next`, das ein
// App-Pfad ist, und keinen Weg an der Route vorbei.
//
// Dashboard und Repository können trotzdem auseinanderlaufen: der Test sieht nur
// die Dateien. Wer eine Vorlage ändert, fügt sie im Dashboard neu ein
// (docs/SETUP.md, "Auth-Mails").

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replaceAll("\r\n", "\n");

/** Vorlage → erwarteter `type` der Route (EmailOtpType) und ob die App sie auslöst. */
const TEMPLATES = {
  confirmation: { type: "signup", triggeredByApp: true },
  recovery: { type: "recovery", triggeredByApp: true },
  email_change: { type: "email_change", triggeredByApp: false },
  invite: { type: "invite", triggeredByApp: false },
} as const;

const config = read("supabase/config.toml");

describe("Auth-Mail-Vorlagen", () => {
  it("es gibt genau diese vier Dateien, keine vergessene", () => {
    const files = readdirSync(join(ROOT, "supabase", "templates"))
      .filter((f) => f.endsWith(".html"))
      .sort();
    expect(files).toEqual(Object.keys(TEMPLATES).map((n) => `${n}.html`).sort());
  });

  describe.each(Object.entries(TEMPLATES))("%s", (name, { type, triggeredByApp }) => {
    const html = read(`supabase/templates/${name}.html`);
    const links = [...html.matchAll(/href="([^"]*token_hash[^"]*)"/g)].map((m) => m[1]);

    it("verlinkt über /auth/callback mit token_hash und dem richtigen type", () => {
      // Knopf UND sichtbarer Link zum Kopieren: zwei Stellen, dieselbe Adresse.
      expect(links.length).toBeGreaterThanOrEqual(2);
      expect(new Set(links).size, "Knopf und Kopier-Link müssen gleich sein").toBe(1);
      const link = links[0];
      expect(link).toContain("{{ .TokenHash }}");
      expect(link).toContain(`type=${type}`);
      if (triggeredByApp) {
        // Die App übergibt redirectTo = <App>/auth/callback?next=…, die Vorlage
        // hängt token_hash und type an. So gilt die Adresse der Umgebung, und das
        // `next` der App bleibt erhalten.
        expect(link).toMatch(/^\{\{ \.RedirectTo \}\}&token_hash=\{\{ \.TokenHash \}\}&type=/);
      } else {
        // Diese beiden löst die App nie aus (Einladung nur über das Dashboard,
        // E-Mail-Änderung gibt es nicht). Ohne redirectTo wäre .RedirectTo die
        // blanke Site-URL und der Link kaputt, deshalb fest verdrahtet.
        expect(link).toMatch(/^\{\{ \.SiteURL \}\}\/auth\/callback\?token_hash=\{\{ \.TokenHash \}\}&type=\w+&next=\/[\w/-]*$/);
      }
    });

    it("hat keinen Weg an der Route vorbei und keine fremde Adresse", () => {
      // ConfirmationURL führt über Supabases /verify und braucht den PKCE-Cookie
      // desselben Browsers: der Link bräche in einem anderen Browser.
      expect(html).not.toContain(".ConfirmationURL");
      expect(html).not.toContain(".Token }}");
      // Jede Adresse kommt aus einer Vorlagenvariable, nie fest eingetragen.
      expect(html).not.toMatch(/https?:\/\//);
      // Kein Bild, kein Skript, kein Tracking-Pixel: eine Mail mit externer
      // Ressource wäre ein Empfänger mehr in der Datenschutzerklärung.
      expect(html).not.toMatch(/<(img|script|iframe|link|style)\b/i);
    });

    it("ist deutsch und trägt den Hinweis für den Fall, dass die Mail nicht angefordert war", () => {
      expect(html).toMatch(/<html lang="de">/);
      expect(html).toMatch(/ignoriere diese Mail/);
      expect(html).toContain("{{ .SiteURL }}/impressum");
    });

    it("steht in supabase/config.toml mit Betreff und diesem Pfad", () => {
      const block = config.match(new RegExp(`\\[auth\\.email\\.template\\.${name}\\]\\n([^\\[]*)`));
      expect(block, `kein [auth.email.template.${name}] in config.toml`).not.toBeNull();
      expect(block![1]).toMatch(/^subject = "[^"]{8,}"$/m);
      expect(block![1]).toContain(`content_path = "./supabase/templates/${name}.html"`);
      expect(existsSync(join(ROOT, "supabase", "templates", `${name}.html`))).toBe(true);
    });
  });

  it("jeder Betreff ist einmalig (sonst sind zwei Mails im Postfach nicht auseinanderzuhalten)", () => {
    const subjects = [...config.matchAll(/\[auth\.email\.template\.\w+\]\nsubject = "([^"]+)"/g)].map((m) => m[1]);
    expect(subjects).toHaveLength(Object.keys(TEMPLATES).length);
    expect(new Set(subjects).size).toBe(subjects.length);
  });

  it("die Route nimmt genau diese types an (EmailOtpType), und die App-Seite kennt den Weg", () => {
    const route = read("src/app/auth/callback/route.ts");
    // Die Route reicht `type` ungeprüft an verifyOtp: gültig sind nur die von
    // Supabase benannten. Hier festgehalten, damit ein Vorlagen-type, den
    // verifyOtp nicht kennt, nicht erst in Produktion auffällt.
    expect(route).toContain("verifyOtp({ type, token_hash: tokenHash })");
    const valid = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];
    for (const { type } of Object.values(TEMPLATES)) expect(valid).toContain(type);
  });
});
