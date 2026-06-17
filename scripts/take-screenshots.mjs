/**
 * Screenshot automation.
 * Logs into the running app through the normal login form and captures every
 * page in light + dark. It uses real credentials from .env.local — so it never
 * touches the Supabase admin API and NEVER mutates anyone's password.
 *
 * One-time setup — put the account to shoot in .env.local (gitignored):
 *   SCREENSHOT_EMAIL=you@example.com
 *   SCREENSHOT_PASSWORD=your-password
 * Use your own account (you know the password) or a dedicated demo account —
 * whichever holds the data you want in the shots.
 *
 * Optional overrides: SCREENSHOT_APP_URL (default http://localhost:3000),
 * CHROME_PATH (default the standard Windows Chrome location).
 *
 * Run: node scripts/take-screenshots.mjs
 */

import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── env ──────────────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const eq = l.indexOf("=");
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()];
    })
);

const EMAIL = env.SCREENSHOT_EMAIL;
const PASSWORD = env.SCREENSHOT_PASSWORD;
const APP = env.SCREENSHOT_APP_URL || "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH ||
  env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = join(__dir, "../screenshots_Docs");

if (!EMAIL || !PASSWORD) {
  console.error(
    "Missing SCREENSHOT_EMAIL / SCREENSHOT_PASSWORD in .env.local.\n" +
      "Add the account to screenshot (your own, or a demo account):\n" +
      "  SCREENSHOT_EMAIL=you@example.com\n" +
      "  SCREENSHOT_PASSWORD=your-password"
  );
  process.exit(1);
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitReady(page) {
  await page
    .waitForNetworkIdle({ idleTime: 1000, timeout: 10000 })
    .catch(() => {});
  await delay(800);
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  console.log(`  ✓  ${name}.png`);
}

// Navigate to a URL (or reload if already there), then wait for it to settle.
async function go(page, url) {
  if (page.url() === url) {
    await page.reload({ waitUntil: "networkidle2" });
  } else {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
  }
  await waitReady(page);
}

// Drive next-themes directly. It stores the active theme in localStorage
// ("theme", the default key — the app sets no custom storageKey) and applies it
// as a class on <html> before first paint. Emulating prefers-color-scheme is
// NOT enough: an explicit stored choice — or the app's defaultTheme="dark" —
// wins over the media query, which is exactly why the old emulate+reload
// produced byte-identical light/dark pairs. Setting the key + reloading is the
// reliable switch. The value persists per-origin, so it carries across
// subsequent navigations until changed again.
async function setTheme(page, theme) {
  await page.evaluate((t) => localStorage.setItem("theme", t), theme);
  await page.reload({ waitUntil: "networkidle2" });
  await waitReady(page);
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: null,
  });

  const newPage = async (w, h) => {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h, isMobile: w < 500 });
    return p;
  };

  try {
    // ── log in once — cookies are shared across pages in the same context ────
    const loginPage = await newPage(1440, 900);
    await go(loginPage, `${APP}/login`);
    await loginPage.type("#email", EMAIL, { delay: 30 });
    await loginPage.type("#password", PASSWORD, { delay: 30 });
    await loginPage.click('button[type="submit"]');
    // The form logs in via supabase-js then router.push() — a client-side
    // navigation, so wait for the path to leave /login rather than for a full
    // document navigation (which a soft push may not trigger).
    await loginPage
      .waitForFunction(() => !location.pathname.includes("/login"), {
        timeout: 20000,
      })
      .catch(() => {});
    await waitReady(loginPage);
    if (loginPage.url().includes("/login")) {
      throw new Error(
        `Login failed — still on ${loginPage.url()}. Check SCREENSHOT_EMAIL / SCREENSHOT_PASSWORD in .env.local.`
      );
    }
    console.log("Logged in:", loginPage.url());
    await loginPage.close();

    // ── 1. Landing ──────────────────────────────────────────────────────────
    console.log("\n── Landing ──");
    const lp = await newPage(1440, 900);
    await go(lp, `${APP}/`);
    await setTheme(lp, "dark");
    await shot(lp, "01-landing-dark");
    await setTheme(lp, "light");
    await shot(lp, "02-landing-light");
    await lp.close();

    // ── 2. Auth pages ───────────────────────────────────────────────────────
    console.log("\n── Auth pages ──");
    const ap = await newPage(1440, 900);
    await go(ap, `${APP}/login`);
    await setTheme(ap, "dark");
    await shot(ap, "03-login-dark");
    await go(ap, `${APP}/signup`); // theme persists (dark) across navigation
    await shot(ap, "04-signup-dark");
    await go(ap, `${APP}/login`);
    await setTheme(ap, "light");
    await shot(ap, "05-login-light");
    await ap.close();

    // ── 3. Dashboard ────────────────────────────────────────────────────────
    console.log("\n── Dashboard ──");
    const dp = await newPage(1440, 900);
    await go(dp, `${APP}/dashboard`);
    await setTheme(dp, "dark");
    await shot(dp, "06-dashboard-dark");
    await setTheme(dp, "light");
    await shot(dp, "07-dashboard-light");
    await dp.close();

    // ── 4. Chat ─────────────────────────────────────────────────────────────
    console.log("\n── Chat ──");
    const cp = await newPage(1440, 900);
    await go(cp, `${APP}/chat`);
    await setTheme(cp, "dark");
    await shot(cp, "08-chat-dark");
    await setTheme(cp, "light");
    await shot(cp, "09-chat-light");
    await cp.close();

    // ── 5. Projects ─────────────────────────────────────────────────────────
    console.log("\n── Projects ──");
    const pp = await newPage(1440, 900);
    await go(pp, `${APP}/projects`);
    await setTheme(pp, "dark");
    await shot(pp, "10-projects-dark");
    await setTheme(pp, "light");
    await shot(pp, "11-projects-light");
    await pp.close();

    // ── 6. Settings ─────────────────────────────────────────────────────────
    console.log("\n── Settings ──");
    const sp = await newPage(1440, 900);
    await go(sp, `${APP}/settings`);
    await setTheme(sp, "dark");
    await shot(sp, "12-settings-dark");
    await setTheme(sp, "light");
    await shot(sp, "13-settings-light");
    await sp.close();

    // ── 7. Mobile ───────────────────────────────────────────────────────────
    console.log("\n── Mobile ──");
    const mp = await newPage(375, 812);
    await go(mp, `${APP}/`);
    await setTheme(mp, "dark");
    await shot(mp, "14-mobile-landing-dark");
    await go(mp, `${APP}/dashboard`); // dark persists
    await shot(mp, "15-mobile-dashboard-dark");
    await go(mp, `${APP}/chat`); // dark persists
    await shot(mp, "16-mobile-chat-dark");
    await go(mp, `${APP}/`);
    await setTheme(mp, "light");
    await shot(mp, "17-mobile-landing-light");
    await mp.close();
  } finally {
    await browser.close();
  }

  console.log(`\n✅  All 17 screenshots saved to: ${OUT}`);
})().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
