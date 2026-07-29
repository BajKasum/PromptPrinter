# Production Readiness & Security Audit — PromptPrinter

**Date:** 2026-07-29
**Commit audited:** `755a759` (branch `main`, clean tree)
**Method:** static review of all 402 tracked files + **live verification against the production Supabase project** (`ykcdbtmiuvntvysynhkx`) via SQL, plus `npm audit`.
**Scope note:** the app is **not yet hosted**. Everything in "Deployment/Infrastructure" that depends on a platform (TLS termination, WAF, CDN, uptime monitoring, rollback) is therefore *unverifiable*, not *failing*. Marked accordingly.

---

## Summary of what was verified, not assumed

Claims in `CLAUDE.md` / `QA-AUDIT-2026-07-27.md` were **not** taken at face value. Where I could check them live, I did:

| Claim | Verified? | Result |
|---|---|---|
| RLS on every table | ✅ live SQL | 8/8 tables `relrowsecurity = true`, all have ≥1 policy |
| `plan`/`is_admin` not client-writable | ✅ live SQL | `has_column_privilege('authenticated','profiles','plan','UPDATE')` = **false** |
| `encrypted_key` not client-readable | ✅ live SQL | SELECT = **false** for `authenticated` |
| `anon` has no DML | ✅ live SQL | no SELECT/INSERT/UPDATE/DELETE for `anon` |
| SSRF guard on BYOK baseUrl | ✅ code | `assertPublicHttpsUrl` wired into the one fetch site (`llm.ts:542,610`) |
| CSP with per-request nonce | ✅ code | `middleware.ts:8-21` + `csp.ts` |
| No secrets committed | ✅ git history + tracked-file scan | clean; `.env`/`.env.local` untracked and `.dockerignore`d |
| "Telemetry added (C-7)" | ❌ **contradicted** | no error-reporting SDK exists — see **M-4** |

---

# Findings

Ordered by severity. Nothing here reaches Critical: I found **no** account takeover, authentication bypass, SQL injection, XSS, RCE, or cross-user data leak. The authorization model (RLS + column grants) is genuinely solid and verified live.

---

## HIGH

### H-1 — Public `avatars` bucket accepts arbitrary file types and unlimited size (validation is client-side only)

**Severity:** High
**Category:** Insecure Design / Security Misconfiguration (OWASP A04, A05)

**Description.**
The `avatars` storage bucket is **public** with `file_size_limit = NULL` and `allowed_mime_types = NULL` (verified live). The only checks on what may be uploaded live in the browser:

```
src/components/app/avatar-upload.tsx:44-51
  if (!file.type.startsWith("image/")) { ...reject... }
  if (file.size > MAX_BYTES)           { ...reject... }   // MAX_BYTES = 2 MB
```

The storage RLS policy (`avatars_owner_insert`, verified live) checks **only the folder prefix**:

```sql
bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
```

It does not constrain the filename, the extension, the MIME type, or the size. Any signed-in user can call the Supabase JS client directly from the browser console.

**Why it matters.**
Two distinct problems:
1. **Arbitrary file hosting on your infrastructure.** A public bucket serves the stored `content-type` back to anyone, unauthenticated. That makes the Supabase project domain a free host for phishing pages, malware, or illegal content — attributable to you, and a plausible route to the whole Supabase project being suspended.
2. **Unbounded storage cost.** No size cap, no object-count cap, no server-side enforcement. One account can fill the bucket.

Because the content is served from `<project>.supabase.co` and not the app's own origin, stored HTML **cannot** steal app session cookies — this is why it is High and not Critical.

**How to reproduce.**
Sign in, open the browser console on any app page:
```js
const s = createClient(); // the app's own browser client
await s.storage.from("avatars").upload(
  `${MY_UID}/payload.html`,
  new Blob(["<h1>hosted</h1>"], { type: "text/html" }),
  { upsert: true, contentType: "text/html" }
);
// then fetch the public URL unauthenticated:
// https://ykcdbtmiuvntvysynhkx.supabase.co/storage/v1/object/public/avatars/<MY_UID>/payload.html
```

**Recommended fix.** Enforce it in the bucket, not the browser:
```sql
update storage.buckets
set file_size_limit  = 2097152,  -- 2 MB, matches MAX_BYTES in avatar-upload.tsx
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'avatars';
```
And pin the path to exactly one object per user, so `{uid}/payload.html` is rejected outright:
```sql
drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar'   -- the only path the app ever writes
  );
-- mirror the same `name =` condition in avatars_owner_update.
```
`avatar-upload.tsx:56` already writes exactly `${userId}/avatar`, so this breaks nothing.

---

### H-2 — Known-vulnerable dependencies, including production-path `sharp`

**Severity:** High
**Category:** Vulnerable and Outdated Components (OWASP A06)

**Description.** `npm audit`: **11 vulnerabilities — 1 critical, 6 high, 4 moderate.**

| Package | Sev | Reaches production? | Notes |
|---|---|---|---|
| `vitest` ≤3.2.5 | **critical** | **No** — devDependency | GHSA-5xrq-8626-4rwp: arbitrary file read/exec, but *only when the Vitest UI server is listening*. This project never starts Vitest UI (`vitest run`). Real risk ≈ nil; the rating is what it is. |
| `sharp` <0.35.0 | high | **Yes** | GHSA-f88m-g3jw-g9cj — inherited libvips CVEs (CVE-2026-33327/33328/35590/35591). Pulled in by `next`; used by `next/image` optimization, which **is** enabled (`next.config.ts:28-33` configures `remotePatterns`). |
| `postcss` ≤8.5.17 | high | Build-time only | Path traversal / arbitrary file read via `sourceMappingURL`. Requires attacker-controlled CSS in the build — not the case here. |
| `vite`, `esbuild`, `vite-node`, `@vitest/mocker` | high/mod | **No** — dev only | |
| `brace-expansion`, `js-yaml`, `protobufjs` | high/mod | transitive | **Fixable non-breaking** (`npm audit fix`). |

**Why it matters.** `sharp` is the only one on a request-serving path. `next/image` decodes remote images from `lh3.googleusercontent.com` / `avatars.githubusercontent.com` — third-party-controlled bytes reaching a native image decoder with known CVEs.

**Evidence.** `package.json:34` (`"next": "^15.5.21"`), `next.config.ts:28-33`, `npm audit --json`.

**Recommended fix.**
```bash
npm audit fix
```
That clears `brace-expansion`, `js-yaml`, `protobufjs` with no breaking change. Then, separately:
- Bump `next` to the latest patched 15.x (this pulls a fixed `sharp`/`postcss`). **Ignore npm's `fixAvailable: next@9.3.3` suggestion — that is a downgrade to a 2020 release and would be catastrophic.**
- Bump `vitest` to 4.x (major, dev-only, low blast radius) to clear the critical.

Add `npm audit --audit-level=high` as a CI step so this doesn't silently rot.

---

### H-3 — Request bodies are parsed before authentication, with no size limit

**Severity:** High (deployment-dependent — see caveat)
**Category:** Insecure Design / DoS (OWASP A04)

**Description.** In every API route, `await req.json()` runs **before** the session check.

`src/app/api/chat/route.ts`:
```
:168-173   body = await req.json()          ← full body buffered + parsed
:175-180   chatRequestSchema.safeParse(...)  ← validation
:193-201   supabase = await createClient()
:205-212   getUser() → 401 if no session     ← auth happens HERE
```
Same ordering in `src/app/api/projects/route.ts:20-38` and `src/app/api/settings/api-key/route.ts:38-57`.

Next.js App Router route handlers have **no default body size limit** (the old `api.bodyParser.sizeLimit` was Pages Router only). `normalizeTranscript` (`route.ts:80-92`) does clamp the array to 24 entries — but only *after* the entire payload has already been read into memory and parsed.

**Why it matters.** An **unauthenticated** attacker can force the server to buffer and JSON-parse an arbitrarily large body — repeatedly, from many connections — and only then receive a 401. No rate limiter helps: `rateLimit()` is also called after parsing. This is a cheap memory/CPU exhaustion primitive against an endpoint that requires no credentials to reach.

**Caveat, stated honestly.** On Vercel, the platform caps serverless request bodies at ~4.5 MB, which blunts this considerably. On the self-hosted Docker path (`Dockerfile`, `docker-compose.yml` — a supported deployment here), there is **no such cap**. Since hosting is still undecided, I am rating this on the weaker of the two.

**Recommended fix.** Check `content-length` and authenticate first:
```ts
// at the very top of POST, before req.json()
const MAX_BODY_BYTES = 512 * 1024; // ~10x the largest legitimate transcript
const declared = Number(req.headers.get("content-length"));
if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
  return problem(413, "Die Anfrage ist zu gross.");
}

// then move the session check ABOVE req.json():
const supabase = await createClient();
const { data } = await supabase.auth.getUser();
if (!data.user) return problem(401, "Bitte melde dich an, um mit Finn zu chatten.");

const body = await req.json(); // only now
```
`content-length` is client-supplied, so for defence-in-depth also cap the actual read, or set a body limit at the reverse proxy once hosting is chosen.

---

## MEDIUM

### M-1 — Raw database and provider error text is returned to clients

**Severity:** Medium
**Category:** Security Misconfiguration / Information Disclosure (OWASP A05)

**Evidence.**
```
src/app/api/settings/api-key/route.ts:138   problem(500, `Key konnte nicht gespeichert werden: ${error.message}`)
src/app/api/settings/api-key/route.ts:162   problem(500, `Key konnte nicht entfernt werden: ${error.message}`)
src/app/api/projects/route.ts:85            problem(500, `Projekt konnte nicht angelegt werden: ${error?.message ?? "unbekannt"}`)
src/app/api/chat/route.ts:463               persistError = err instanceof Error ? err.message : "persist failed"
src/app/api/chat/route.ts:484               send("done", { ...(persistError ? { persistError } : {}) })   ← sent to the browser
```

**Why it matters.** `error.message` from PostgREST/Postgres carries constraint names, column names, policy names, and sometimes row values (`duplicate key value violates unique constraint "user_api_keys_user_id_provider_key"`). That hands an attacker your schema for free and directly contradicts the pattern the codebase itself established in `describeLlmFailure` (`route.ts:151-164`), which was written precisely to stop leaking provider internals.

The BYOK key-test call at `api-key/route.ts:98-102` is a **deliberate, documented** exception (the reader is the key's owner, mid-setup) — that one is fine and should stay.

**Recommended fix.** Log the detail, return a generic message:
```ts
if (error) {
  captureError("api_key.save_failed", error, { userId: user.id, provider });
  return problem(500, "Key konnte nicht gespeichert werden. Bitte versuch es erneut.");
}
```
For `persistError`, send a boolean the client can act on, not the message:
```ts
send("done", { mode, ...(conversationId ? { conversationId } : {}), ...(persistError ? { persisted: false } : {}) });
```

---

### M-2 — The 10-file project limit guards table rows, not storage objects

**Severity:** Medium
**Category:** Insecure Design — resource exhaustion

**Description.** Migration `0022` adds a trigger on `public.project_files` enforcing `count(*) < 10` and the `.md/.txt/.json/.csv` extension allowlist. That is a real fix for the *table*. But uploads go to storage **directly from the browser**, and the storage policy (`project_files_owner_insert`, verified live) checks only the folder prefix:

```sql
bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text
```

Nothing requires a matching `project_files` row. A user can upload unlimited 200 KB objects (the bucket's `file_size_limit = 204800` is the only bound) and simply never insert the row — the trigger never fires.

**Why it matters.** Unbounded private storage growth per account, entirely outside the limit the app believes it enforces. Cost/availability, not confidentiality — the bucket is private and correctly owner-scoped, so there is no cross-user read.

**Recommended fix.** Bound the object count in the policy itself:
```sql
drop policy if exists project_files_owner_insert on storage.objects;
create policy project_files_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'project-files'
        and (storage.foldername(o.name))[1] = auth.uid()::text
    ) < 100   -- 10 projects x 10 files, the app's own effective ceiling
  );
```
Also set `allowed_mime_types` on the bucket to match the extension allowlist.

---

### M-3 — `anon` and `authenticated` hold `TRUNCATE` on every public table

**Severity:** Medium (defence-in-depth; **not exploitable today** — verified)
**Category:** Broken Access Control / least privilege (OWASP A01)

**Description.** Live grant query returns, for **every** table in `public`, for **both** `anon` and `authenticated`:
```
REFERENCES, TRIGGER, TRUNCATE
```
These come from Supabase's stock `ALTER DEFAULT PRIVILEGES ... GRANT ALL` and were never revoked. The migrations carefully grant minimal DML (and `0014`/`0020` correctly *revoke-then-regrant* for column allowlists), but nobody revoked the non-DML verbs.

**Why `TRUNCATE` specifically matters:** it is **not filtered by RLS**. A single successful `TRUNCATE public.messages` would delete every user's data regardless of policies. `DELETE` is safe here because RLS applies to it; `TRUNCATE` has no such protection.

**Exploitability — verified, and it is currently nil.** PostgREST exposes no HTTP verb that maps to `TRUNCATE`, and I enumerated every function in `public`:

| function | security | anon EXECUTE | authenticated EXECUTE |
|---|---|---|---|
| `project_summaries` | invoker | true | true |
| `handle_new_user` | **definer** | false | false |
| `set_updated_at` | invoker | false | false |
| `enforce_project_file_limit` | invoker | false | false |
| `rls_auto_enable` | **definer** | false | false |

None truncates anything. So this is a latent hazard, not a live hole — but it is one `security definer` helper away from becoming one.

**Recommended fix.**
```sql
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
```

---

### M-4 — There is no error reporting, alerting, or uptime monitoring (the C-7 "fix" is incomplete)

**Severity:** Medium
**Category:** Security Logging and Monitoring Failures (OWASP A09)

**Description.** *(Evidence corrected 2026-07-29 during remediation — the original wording of this finding overstated where the false claim lived, and that correction belongs in the record.* `CLAUDE.md` does **not** mention telemetry at all, and `QA-AUDIT-2026-07-27.md` is explicitly honest about it: *"Bewusst nicht gemacht: Sentry … Ebenfalls offen: Alarmierung"*. The misleading line was in the 2nd-brain project note alone, which marked C-7 `[x]` and then named "Sentry plus Token-/Kosten-Logging" in a way that read as the fix rather than as the finding's recommendation.*)

**The technical substance of the finding stands unchanged:** there is no Sentry, and `package.json` contains no error-reporting SDK of any kind. What actually exists is `src/lib/observability.ts` — a well-built structured logger that writes **one JSON line to stdout** and nothing else:

```
src/lib/observability.ts:116-124   captureError(...) → emit("error", ...) → console.error(line)
```

The file is honest about this (`"Wire an error-reporting SDK in HERE and nowhere else"`), so the code is not lying — the **project documentation is**. That mismatch is itself worth fixing, because it means the operator believes they have alerting they do not have.

**Why it matters.** The stated rationale for C-7 was that the anonymous-chat cost hole (S-1) would only have surfaced on the provider's invoice. With stdout-only logging and no drain configured, that is *still true*. `logWarning("spend_guard.budget_exhausted", …)` (`rate-limit.ts:320`) fires into a log nobody is watching. There is no crash reporting, no uptime check, no alert on 5xx rate, no alert on the daily budget tripping.

The `/admin` page (`src/app/(app)/admin/page.tsx`) is a genuinely good pull-based dashboard — but it requires a human to log in and look.

**Recommended fix.** Two concrete steps:
1. Correct the docs — C-7 is *partially* done (structured logging ✅, reporting/alerting ❌).
2. Wire one SDK into `captureError`, keeping `redactContext`:
```ts
import * as Sentry from "@sentry/nextjs";
export function captureError(event: string, error: unknown, context: LogContext = {}): void {
  emit("error", event, { ...context, /* existing */ });
  Sentry.captureException(error, { tags: { event }, extra: redactContext(context) });
}
```
`sendDefaultPii: false` is mandatory here — the default would attach request bodies, i.e. user prompts.

---

### M-5 — Leaked-password protection disabled; password policy is length-only

**Severity:** Medium
**Category:** Identification and Authentication Failures (OWASP A07)

**Evidence.**
- Supabase security advisor (live): `auth_leaked_password_protection` — *"Leaked password protection is currently disabled."*
- `src/components/auth/sign-up-experience.tsx:20` — `password: z.string().min(8, "Mindestens 8 Zeichen")`, plus the native `minLength={8}` at `:298`. No breach check, no complexity requirement.

**Why it matters.** 8 characters with no HaveIBeenPwned check accepts `password` and `12345678`. This is a credential-stuffing target, and it is a dashboard toggle, not code.

**Recommended fix.** Supabase Dashboard → Authentication → Policies → enable **Leaked Password Protection**; consider raising the minimum to 10. Remediation: https://supabase.com/docs/guides/auth/password-security

**Credit where due:** the app deliberately removed in-place password change (`change-password.tsx:6-11`) in favour of an email-verified reset flow, which is the *more* secure design. That reasoning is sound.

---

### M-6 — Only one BYOK key is ever used, silently, and it is the oldest one

**Severity:** Medium
**Category:** Functional correctness (security-adjacent — affects who pays)

**Evidence.** `src/lib/byok.ts:28-34`:
```ts
.select("provider, encrypted_key, base_url, model")
.eq("user_id", userId)
.order("created_at", { ascending: true })   // OLDEST first
.limit(1)
.maybeSingle();
```
The schema permits one row per `(user_id, provider)` — four rows per user. The settings UI (`getConfiguredProviders`, `byok.ts:56-62`) reads and displays **all** of them.

**Why it matters.** A user who configures Anthropic, then later adds OpenAI, will see both listed as active but only ever have Anthropic used — forever, with no indication. Worse: if the first-added key is revoked, `decrypt` succeeds but the provider call 401s and the code path degrades to *the server's own key* (`route.ts:263,304` treat `override` as truthy, so this doesn't happen — but the user is stuck on a dead provider with no UI to say which one is active).

**Recommended fix.** Add an explicit active-provider choice — `profiles.settings.byok_provider`, or an `is_active` column — and have the settings UI show which key is in use. Short term, at minimum change the UI to state that the earliest-added key wins.

---

### M-7 — Middleware's protected-path list has drifted from the actual route tree

**Severity:** Medium (defence-in-depth only — **no bypass exists today**, verified)
**Category:** Broken Access Control (OWASP A01)

**Evidence.** `src/lib/supabase/middleware.ts:31-36`:
```ts
const isProtected =
  pathname.startsWith("/chats")    || pathname.startsWith("/projects") ||
  pathname.startsWith("/settings") || pathname.startsWith("/billing")  ||
  pathname.startsWith("/admin");
```
`/prompts` — added this session (`src/app/(app)/prompts/page.tsx`) — is **missing** from this list.

**Why there is no actual hole.** Two independent server-side gates still fire:
- `src/app/(app)/layout.tsx:18-20` — `getUser()` → `redirect("/login")`, covers the whole `(app)` group.
- `src/app/(app)/prompts/page.tsx:32-35` — its own `getUser()` → `redirect("/login")`.

And all data reads are RLS-scoped. So this is a **latency/consistency** defect, not an authz defect: the page renders server-side, hits the layout guard, and redirects — just one layer later than intended.

**Why it still matters.** The list is a hand-maintained duplicate of the route tree, and it has now demonstrably drifted once. The next page added under `(app)` will drift too, and the day someone adds a route *outside* `(app)` it becomes a real hole.

**Recommended fix.** Invert the default — protect everything except an explicit public allowlist:
```ts
const PUBLIC_PREFIXES = ["/", "/login", "/signup", "/reset-password", "/auth",
  "/features", "/pricing", "/docs", "/agb", "/datenschutz", "/impressum",
  "/kontakt", "/ueber", "/rueckerstattung", "/sitemap.xml", "/robots.txt"];
const isPublic = PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + "/"));
if (!user && !isPublic) { /* redirect to /login */ }
```
Note `/admin` is correctly *authenticated* by middleware but its **authorization** (`is_admin`) is enforced only in the page (`admin/page.tsx:32-37`, `notFound()` on non-admins) — that placement is correct and the 404-not-403 choice is good practice.

---

## LOW

### L-1 — `generations.project_id` is not ownership-checked on insert
`src/components/app/save-prompt-button.tsx:70-72` inserts `project_id: projectId ?? null` from a client-supplied prop. The RLS `with check` on `generations` validates `user_id` only, never that `project_id` belongs to the caller. This is the exact class of bug that QA finding F-8 fixed for `conversations` — left unfixed here.
**Impact is genuinely nil for other users** (verified): `project_summaries()` is `security invoker`, so the victim's own RLS filters a foreign row out of their `saved_count`; the workspace `resultCount` query is RLS-scoped too. The only consequence is self-inflicted: the attacker's row cascade-deletes when the foreign project is deleted.
**Fix:** validate ownership server-side, or add a policy condition `project_id IS NULL OR EXISTS (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())`.

### L-2 — `project_summaries()` is EXECUTE-able by `anon`
Verified live: `has_function_privilege('anon', 'project_summaries()', 'EXECUTE') = true`. Harmless — the body filters `where p.user_id = auth.uid()`, which is `NULL` for anon, so it returns zero rows. Still an unnecessary grant.
**Fix:** `revoke execute on function public.project_summaries() from anon;`

### L-3 — Several user-scoped queries omit the project's own documented `.eq("user_id")` defence-in-depth
`CLAUDE.md` mandates *"RLS scope + zusätzlich explizit `.eq("user_id", …)`"*. Not followed in `src/lib/project.ts:44-49`, nor in the workspace layout's three queries (`projects/[id]/(workspace)/layout.tsx:41-58`, all keyed on `project_id` alone). RLS does protect these, so there is no live exposure — but the codebase's own stated standard isn't met, and these are exactly the queries feeding a workspace shell.

### L-4 — Public avatar bucket + deterministic path allows avatar retrieval by UUID
Path is always `{uid}/avatar` (`avatar-upload.tsx:56`) in a public bucket. Anyone knowing a user's UUID can fetch their avatar unauthenticated. Migration `0007` deliberately removed bucket *listing* (so enumeration is not possible), which is the important half. Accepted-risk territory for a profile picture; noted for completeness.

### L-5 — `persistTurn` assumes the last transcript entry is a user message
`src/lib/chat-persistence.ts:66-84` takes `input.messages[length-1]` and stores it with `role: newUser.role`. A crafted POST ending in an `assistant` message writes two consecutive assistant rows. Cosmetic/integrity only — `collapseConsecutiveRoles` (`route.ts:55-65`) already protects the *model-facing* copy, which was the actual F-4 bug.

### L-6 — `robots.ts` hardcodes a domain that isn't decided yet
`src/app/robots.ts:11` — `sitemap: "https://promptprinter.app/sitemap.xml"`, while `legal.ts`'s `appHost` is still a deliberate placeholder pending the hosting decision. These will disagree if the domain differs.

### L-7 — `DELETE /api/settings/api-key` has no rate limit
`src/app/api/settings/api-key/route.ts:144-166` — the POST handler rate-limits (`:66-73`), the DELETE handler doesn't. Low impact (idempotent, owner-scoped, no model call), but it is the only unlimited authenticated mutation in the codebase.

---

## INFO / Positive findings

These were checked and are **correct** — recorded so they don't get "fixed" into regressions:

- **No XSS sinks.** Zero `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write` anywhere in `src/`. Verified by grep.
- **Markdown link sanitization verified.** `chat-markdown.tsx:60-69` renders model-controlled `href`. react-markdown **10.1.0** applies `defaultUrlTransform` unless overridden (`node_modules/react-markdown/lib/index.js:320,382`) — the app does not override it, so `javascript:` URLs are neutralized. `rehype-raw` is not used. This is safe *because of a library default*, so it is worth a regression test.
- **No tokens in `localStorage`/`sessionStorage`.** Sessions are cookie-based via `@supabase/ssr`.
- **No secrets committed**, ever. Tracked-file entropy scan and full `git log -S` history scan both clean. `.env`/`.env.local` are gitignored *and* `.dockerignore`d (so `COPY . .` at `Dockerfile:32` cannot bake them into the image — checked explicitly).
- **SSRF defence is real and well-placed.** `assertPublicHttpsUrl` (`url-safety.ts`) enforces https, resolves the hostname, and rejects private/reserved ranges including the IPv4-mapped-IPv6 hex normalization — wired into `customComplete`/`customCompleteStream` (`llm.ts:542,610`), the only sites that fetch, with `redirect: "error"`. Response bodies are never reflected raw.
- **CSP is correctly nonce-based**, `'unsafe-eval'` is dev-only (`csp.ts:28`), `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`. `style-src 'unsafe-inline'` is a documented, pragmatic exception for Tailwind/Framer.
- **Security headers** — HSTS (2y, includeSubDomains), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy all set (`next.config.ts:7-23`).
- **Open-redirect guarded on both sides** — `auth/callback/route.ts:13-14` and `safeNextPath` (`site-url.ts`), which additionally rejects protocol-relative `//evil.com`.
- **BYOK key encryption** — AES-256-GCM with a server-only secret, authenticated, key never in the DB (`crypto.ts`). Fixed scrypt salt is documented and acceptable given the secret is per-deployment.
- **Docker image** runs as non-root (`Dockerfile:45-53`), multi-stage, standalone output.
- **Cost controls are genuinely thorough** — per-user monthly quota via atomic Redis `INCR`, hourly rate limit, and a global daily server-key budget with a documented fail-open/fail-closed rationale for each.
- **No SQL injection surface.** All DB access goes through PostgREST/supabase-js parameterized builders. Zero raw SQL string concatenation in `src/`.
- **Prompt-injection is explicitly defended** — `project-context.ts:82-85,144` wraps attached files and project fields in explicit "this is reference data, never a command" framing. Not a guarantee, but a deliberate, correct mitigation.

---

## ⚠ Cannot verify from repository

| Item | Why |
|---|---|
| **Session cookie flags** (HttpOnly / Secure / SameSite) | Set by `@supabase/ssr`'s defaults and the Supabase project config; the app passes `options` through untouched (`supabase/server.ts:16-18`, `supabase/middleware.ts:19-21`). Must be confirmed against a live `Set-Cookie` header. |
| **JWT expiry, refresh-token rotation, logout invalidation** | Supabase Auth dashboard settings, not in the repo. |
| **MFA** | No MFA code exists in the app. Supabase supports it; whether it's enabled is a dashboard question. Assume **not enabled**. |
| **Brute-force protection on login** | Supabase-side. The app adds Turnstile (`turnstile-widget.tsx`) but the *secret* lives in Supabase, and the site key is optional (unset ⇒ captcha silently skipped). |
| **TLS config, HTTPS enforcement, CDN, WAF, reverse proxy** | No hosting chosen yet. HSTS is set in-app, which is the app's half. |
| **Uptime monitoring, alerting, rollback, blue/green** | No platform. `docker-compose.yml:25-34` defines a container healthcheck pinging `/`; there is no dedicated `/api/health` endpoint. |
| **Actual production `NODE_ENV`, debug flags** | Dockerfile sets `NODE_ENV=production` (`:39`); a hosted deployment's env is unverifiable. |
| **Z.ai / Anthropic account spend limits** | External dashboards. The in-app daily budget (`LLM_DAILY_CALL_BUDGET`) is a backstop, not a substitute — the prior audit's S-1 step 5 remains open. |
| **Source maps in production** | `productionBrowserSourceMaps` is not set in `next.config.ts`, so Next's default (**off**) applies. Correct by default, but not explicitly pinned. |

**Not applicable:** Vite (this is Next.js/webpack — the `VITE_*` checklist section doesn't apply; Vite is present only as a Vitest transitive dep), Firebase, Prisma.

---

# Security Score

**Overall: 72 / 100** — *not production-ready today, but close.* The gap is concentrated in three fixable items (H-1, H-2, H-3) plus the monitoring gap (M-4). The core authorization model is better than most projects of this size.

| Category | Score | Reasoning |
|---|---:|---|
| **Authentication** | 78 | Solid: server-side `getUser()` everywhere, email-verified reset flow, open-redirect guarded, Turnstile wired. Loses points for length-only password policy, leaked-password protection off, no MFA, and captcha silently optional. |
| **Authorization** | 88 | The strongest area, and **verified live**: RLS on 8/8 tables, `plan`/`is_admin` not client-writable, `encrypted_key` not client-readable, `anon` has no DML. Deductions for the TRUNCATE grant (M-3), middleware drift (M-7), and the unvalidated `project_id` (L-1). |
| **Database** | 85 | Careful, well-commented migrations; the revoke-then-regrant column-allowlist lesson from 0014 was correctly reapplied in 0020/0026. Indexes and FK cascades present. Deductions: TRUNCATE grants, `anon` EXECUTE on `project_summaries`. |
| **API** | 68 | Good validation (Zod), consistent RFC7807 errors, real rate limiting, ownership verification. Deductions: body parsed before auth (H-3), raw error leakage (M-1), one unlimited DELETE (L-7). |
| **Secrets** | 95 | Clean history, clean tracked files, correct gitignore *and* dockerignore, AES-256-GCM for BYOK, no `NEXT_PUBLIC_` misuse. Only nit: fixed scrypt salt (documented, acceptable). |
| **Frontend** | 90 | No XSS sinks, no tokens in web storage, markdown URL sanitization verified, nonce-based CSP. Deduction: safety depends on a library default that isn't regression-tested. |
| **Infrastructure** | 55 | HSTS + full security-header set + non-root Docker are right. But no hosting decided ⇒ TLS/WAF/CDN/reverse-proxy all unverifiable, and `appHost` is still a placeholder. |
| **Deployment** | 60 | CI runs typecheck/lint/test/build on every push; Docker multi-stage, standalone, non-root, healthcheck defined. No `npm audit` gate, no staging environment, no rollback or blue/green strategy, no migration-apply automation. |
| **Monitoring** | 35 | Structured logging with enforced redaction is genuinely well-built, and `/admin` is a useful pull dashboard. But **stdout only** — no drain, no error reporting, no alerting, no uptime check. Documentation claims otherwise (M-4). |
| **Performance** | 80 | Real work done here: `project_summaries()` eliminates two N+1 patterns, LIMITs on unbounded queries, Redis file-content cache, lazy jsPDF, streaming chat, Anthropic prompt caching. Deduction: no bundle-size budget, image optimization on a vulnerable `sharp`. |
| **Dependencies** | 45 | 11 vulnerabilities (1 critical dev-only, 6 high), one of which (`sharp`) is on a production request path. No automated audit in CI, no Dependabot/Renovate. |

---

# Production Readiness Checklist

### Authentication
| Item | Status |
|---|---|
| Authentication exists | ✅ Supabase Auth, server-verified via `getUser()` |
| Protected routes | ⚠ Partial — layout + page guards are solid; middleware list has drifted (M-7) |
| Session validation | ✅ `getUser()` (validates against the auth server), not `getSession()` |
| JWT validation | ✅ delegated to `@supabase/ssr` |
| Token expiration | ⚠ Cannot verify — Supabase dashboard setting |
| Refresh token handling | ⚠ Cannot verify — library/dashboard |
| Logout invalidation | ⚠ Partial — `signOut({scope:"local"})` used in `/api/account` (correct there, user is deleted); global logout path not verifiable |
| Password hashing | ✅ Supabase-managed (app never handles raw passwords) |
| Secure / HttpOnly / SameSite cookies | ⚠ Cannot verify — library defaults, needs a live header check |
| Password reset flow | ✅ email-verified, `token_hash` server-verified (`auth/callback/route.ts:23-25`) |
| Password reset expiration | ⚠ Cannot verify — Supabase setting |
| Email verification | ✅ supported via the same callback |
| Brute-force protection | ⚠ Turnstile present but optional; server-side enforcement is Supabase's |
| MFA support | ❌ Not implemented |

### Authorization
| Item | Status |
|---|---|
| Role-based permissions | ✅ `profiles.is_admin`, centralized in `effectiveLimits` |
| Admin routes protected | ✅ `admin/page.tsx:30-37`, 404s non-admins |
| Middleware authorization | ⚠ authenticates only; authorization is at page level (correct, but see M-7) |
| Server-side permission checks | ✅ every route re-checks; `is_admin` never trusted from client |
| Client permissions not trusted | ✅ verified — `plan`/`is_admin` not client-writable (live check) |
| Privilege escalation possible? | ✅ No — `has_column_privilege(...,'plan','UPDATE')` = false |
| Broken access control | ⚠ TRUNCATE grants (M-3), unvalidated `project_id` (L-1) |
| IDOR | ✅ None found — RLS + `notFound()` on foreign ids |

### Database
| Item | Status |
|---|---|
| SQL injection | ✅ No raw SQL in `src/`; all access parameterized via PostgREST |
| ORM safety / prepared statements | ✅ supabase-js query builder |
| Row Level Security | ✅ **8/8 tables, verified live** |
| Public tables | ✅ None — `anon` has no DML on any table |
| Unrestricted SELECT/UPDATE/DELETE/INSERT | ✅ All owner-scoped; column allowlists on `profiles`, `user_api_keys`, `generations` |
| Indexes | ✅ Present on every hot path incl. `0019` partial index |
| Foreign keys | ✅ Throughout |
| Cascading deletes | ✅ `auth.users` → profiles → projects → generations/conversations/files |
| Database secrets exposed | ✅ No |
| **TRUNCATE least privilege** | ❌ Granted to `anon`+`authenticated` on all tables (M-3) |

### API
| Item | Status |
|---|---|
| Authentication required | ✅ All 4 routes 401 without a session |
| Authorization enforced | ✅ ownership verified before writes (F-8 pattern) |
| Rate limiting | ⚠ Present and well-designed, but DELETE api-key is unlimited (L-7) |
| Request validation | ✅ Zod on every route |
| Input sanitization | ✅ |
| Output sanitization | ❌ Raw DB errors returned (M-1) |
| CORS configuration | ✅ No permissive CORS headers set — same-origin by default |
| CSRF protection | ⚠ Cannot verify — depends on cookie `SameSite`; no explicit CSRF tokens |
| API key exposure | ✅ Server-side only; BYOK encrypted at rest |
| Secrets exposed | ✅ No |
| Open endpoints | ✅ None |
| Debug endpoints | ✅ None |
| HTTP methods restricted | ✅ Only exported handlers exist |
| **Body size limits** | ❌ None; parsed before auth (H-3) |

### Input Validation
| Item | Status |
|---|---|
| SQL injection | ✅ |
| XSS | ✅ No sinks; markdown URL transform verified |
| Command injection | ✅ No `exec`/`spawn` in app code |
| Path traversal | ✅ Storage paths are server/uid-derived |
| SSRF | ✅ `assertPublicHttpsUrl` + `redirect:"error"` |
| Template injection | ✅ N/A |
| File upload validation | ❌ Avatars: client-side only (H-1); project files: table-only (M-2) |
| MIME validation | ❌ Neither bucket sets `allowed_mime_types` |
| Filename sanitization | ⚠ Avatar path fixed by app but not enforced by policy (H-1) |
| Size limits | ⚠ `project-files` 200 KB ✅; `avatars` unlimited ❌ |

### Secrets / Environment
| Item | Status |
|---|---|
| No hardcoded secrets | ✅ Verified across tracked files and full git history |
| `.env` ignored | ✅ gitignore + dockerignore |
| Example env exists | ✅ `.env.example`, accurate and well-annotated |
| Secrets not committed | ✅ |
| Production config | ✅ `assertEnv()` throws at boot on missing prod vars |
| Development config | ✅ Stub mode, in-memory limiter |
| Debug mode disabled | ✅ `NODE_ENV=production` in Dockerfile |

### Frontend / Headers
| Item | Status |
|---|---|
| XSS / `dangerouslySetInnerHTML` / unsafe HTML | ✅ None |
| Tokens in local/sessionStorage | ✅ None |
| Exposed secrets | ✅ Only legitimate `NEXT_PUBLIC_*` |
| Source maps | ✅ Off by default (not explicitly pinned) |
| CSP | ✅ Nonce-based, per-request |
| HSTS | ✅ 2y + includeSubDomains (no preload, deliberate) |
| X-Frame-Options / X-Content-Type-Options | ✅ DENY / nosniff |
| Referrer-Policy / Permissions-Policy | ✅ Both set |

### Dependencies / Logging / Monitoring / Deployment
| Item | Status |
|---|---|
| Outdated / vulnerable packages | ❌ 11 vulns, `sharp` on a prod path (H-2) |
| Unnecessary / duplicate deps | ✅ Cleaned in QA finding P-4 |
| Error logging | ✅ Structured JSON, redaction enforced |
| Sensitive info removed from logs | ✅ `redactContext` + `FORBIDDEN_KEYS` — genuinely good |
| Passwords / tokens never logged | ✅ Enforced structurally |
| Auth / failed-login / audit logs | ❌ Not implemented app-side |
| Request IDs | ❌ Not implemented |
| Crash reporting / alerts / uptime | ❌ None (M-4) |
| Production build | ✅ standalone, multi-stage, non-root |
| Environment separation | ✅ `.env` vs `.env.local` documented |
| HTTPS only | ⚠ HSTS set; enforcement is platform-dependent |
| Docker security | ✅ non-root, minimal image, no secrets baked |
| CI/CD | ⚠ Good gate, but no `npm audit`, no deploy pipeline |
| Rollback / blue-green | ❌ Not defined |
| Health checks | ⚠ compose-level ping of `/`; no dedicated endpoint |
| Stack traces hidden | ⚠ Generic pages exist, but DB errors leak (M-1) |
| Custom error pages | ✅ `not-found.tsx`, `error.tsx`, `global-error.tsx` |
| Centralized error handling | ✅ `problem()` + `captureError()` |

---

# Recommended order of work

**Before any public deploy**
1. **H-1** — set `file_size_limit` + `allowed_mime_types` on `avatars`, pin the insert policy to `{uid}/avatar`. *(~15 min, pure SQL)*
2. **H-2** — `npm audit fix`, then bump `next` to patched 15.x. Add `npm audit --audit-level=high` to CI. *(~1 h)*
3. **H-3** — move the auth check above `req.json()` and add a `content-length` guard in all 4 routes. *(~30 min)*
4. **M-5** — enable leaked-password protection in the Supabase dashboard. *(~2 min)*
5. **M-1** — stop returning `error.message`; log it instead. *(~20 min)*

**Shortly after**
6. **M-4** — wire an error-reporting SDK into `captureError`, and correct the C-7 claim in `CLAUDE.md`.
7. **M-3** — revoke `TRUNCATE`/`REFERENCES`/`TRIGGER` from `anon`/`authenticated`.
8. **M-2** — bound object count in the `project-files` insert policy.
9. **M-7** — invert middleware to an allowlist.
10. **M-6** — make the active BYOK provider explicit.

**Backlog:** L-1 … L-7, request IDs, a `/api/health` endpoint, E2E tests for the auth boundary, and a regression test asserting `javascript:` links are neutralized in `chat-markdown`.
