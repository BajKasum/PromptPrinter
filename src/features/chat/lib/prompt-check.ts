// Prüft den fertigen Prompt im Browser auf Dinge, die nicht hineingehören: Schlüssel,
// persönliche Angaben, riskante Befehle, Dateien mit Zugangsdaten, untergeschobene Anweisungen
// und Links, die die Person nie geschrieben hat (#236, #242). Rein lokal, kein Serveraufruf.
//
// Nur Warnungen, nie eine Sperre: die Person bleibt Herrin über das Kopieren. Ein Fehlalarm kostet
// Vertrauen, deshalb stehen hier nur Muster mit hoher Trefferquote (feste Schlüsselformate,
// Prüfsummen bei IBAN und Karten, Befehlsformen, die kaum harmlos vorkommen). Im Zweifel fehlt ein
// Muster, statt dass eines zu viel warnt.

export type PromptRiskKind = "secret" | "personal" | "command" | "file" | "override" | "link";

export type PromptRisk = {
  kind: PromptRiskKind;
  /** Gekürzte Fundstellen (höchstens drei), nie ein ganzer Schlüssel. */
  samples: string[];
  /** Zahl aller Funde dieser Art. */
  total: number;
};

const MAX_SAMPLES = 3;

const clip = (s: string, max = 60) => {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};
const mask = (s: string) => (s.length > 10 ? `${s.slice(0, 4)}…${s.slice(-2)}` : `${s.slice(0, 2)}…`);

function* matches(text: string, re: RegExp): Generator<RegExpMatchArray> {
  for (const m of text.matchAll(re)) yield m;
}

// ---- Schlüssel und Passwörter ---------------------------------------------------------------

const SECRET_FORMATS: RegExp[] = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g,
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{36,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{50,}/g,
  /\bAIza[0-9A-Za-z_-]{35}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];

// "password = hunter2x…": nur wenn der Wert zufällig aussieht (lang, Buchstaben und Ziffern, hohe
// Streuung). Sonst warnte jedes "Passwort: mindestens 10 Zeichen".
const ASSIGNED_SECRET = /\b(?:api[_ -]?key|secret|token|passwor[dt]|passwd|pwd)\s*[:=]\s*["'`]?([A-Za-z0-9_\-+/=.]{16,})/gi;

function entropy(s: string): number {
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) h -= (n / s.length) * Math.log2(n / s.length);
  return h;
}

// postgres://nutzer:geheim@host: Beispielwerte wie "password" oder "xxx" zählen nicht.
const URL_CREDENTIALS = /\b[a-z][a-z0-9+.-]*:\/\/([^\s:@/]+):([^\s@/]+)@[^\s/]+/gi;
const DUMMY_SECRET = /^(?:pass(?:word)?|secret|xxx+|\*+|<.*>|\[.*\]|\$\{.*\}|\{\{.*\}\}|your.*|dein.*|changeme|example)$/i;

function findSecrets(text: string): string[] {
  const out: string[] = [];
  for (const re of SECRET_FORMATS) for (const m of matches(text, re)) out.push(mask(m[0]));
  for (const m of matches(text, ASSIGNED_SECRET)) {
    const value = m[1];
    if (/[A-Za-z]/.test(value) && /\d/.test(value) && entropy(value) >= 3.5) out.push(mask(value));
  }
  for (const m of matches(text, URL_CREDENTIALS)) {
    if (!DUMMY_SECRET.test(m[2])) out.push(mask(`${m[1]}:${m[2]}`));
  }
  return out;
}

// ---- Persönliche Angaben ---------------------------------------------------------------------

const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g;
const EXAMPLE_DOMAIN = /(?:^|\.)(?:example\.(?:com|org|net)|example|invalid|test|localhost)$/i;
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g;
const CARD = /\b\d{4}(?:[ -]?\d{4}){2}[ -]?\d{1,7}\b/g;
// Telefonnummern nur mit "+" und Landesvorwahl oder in der Schweizer Mobilform: reine Ziffernfolgen
// sind zu oft Bestellnummern, Daten oder Versionen.
const PHONE = /(?<![\w+])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}\b|\b07[5-9] \d{3} \d{2} \d{2}\b/g;
const AHV = /\b756[. ]?\d{4}[. ]?\d{4}[. ]?\d{2}\b/g;

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function ibanValid(raw: string): boolean {
  const iban = raw.replace(/ /g, "");
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function findPersonal(text: string): string[] {
  const out: string[] = [];
  for (const m of matches(text, EMAIL)) {
    if (!EXAMPLE_DOMAIN.test(m[1])) out.push(`${m[0].slice(0, 2)}…@${m[1]}`);
  }
  for (const m of matches(text, IBAN)) if (ibanValid(m[0])) out.push(`${m[0].slice(0, 4)}…`);
  for (const m of matches(text, CARD)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) out.push(`•••• ${digits.slice(-4)}`);
  }
  for (const m of matches(text, PHONE)) out.push(`${m[0].slice(0, 4)}…`);
  for (const m of matches(text, AHV)) out.push(`${m[0].slice(0, 4)}…`);
  return out;
}

// ---- Befehle -----------------------------------------------------------------------------------

const RISKY_COMMANDS: RegExp[] = [
  // herunterladen und gleich ausführen
  /\b(?:curl|wget)\b[^\n|;]{0,300}\|\s*(?:sudo\s+)?(?:ba|z|da|k)?sh\b/gi,
  /\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n]{0,300}\|\s*(?:iex|Invoke-Expression)\b/gi,
  /\b(?:ba|z)?sh\s+<\(\s*(?:curl|wget)\b[^)\n]{0,300}\)/gi,
  /\b(?:eval|sh|bash)\b[^\n]{0,20}\$\(\s*(?:curl|wget)\b[^)\n]{0,300}\)/gi,
  // verschleierte Nutzlast
  /\bbase64\s+(?:-d|-D|--decode)\b[^\n|]{0,100}\|\s*(?:ba|z)?sh\b/gi,
  /\bpowershell(?:\.exe)?\b[^\n]{0,100}\s-(?:enc|encodedcommand)\s+[A-Za-z0-9+/=]{20,}/gi,
  // Rückkanal und Zerstörung
  /\/dev\/tcp\/[\w.-]+\/\d+/g,
  /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(?:--no-preserve-root\s+)?(?:\/|~\/?|\$HOME|\*)(?=\s|$)/g,
  /\bdd\b[^\n]{0,60}\bof=\/dev\/(?:sd|nvme|disk)\w*/g,
  /\bmkfs(?:\.\w+)?\s+\/dev\//g,
];

function findCommands(text: string): string[] {
  const out: string[] = [];
  for (const re of RISKY_COMMANDS) for (const m of matches(text, re)) out.push(clip(m[0]));
  return out;
}

// ---- Dateien mit Zugangsdaten --------------------------------------------------------------------

const CREDENTIAL_FILE = String.raw`(?:\.env\b(?!\.(?:example|sample|template))|\bid_(?:rsa|ed25519)\b|\.ssh\/|\.aws\/credentials|\.npmrc\b|\.netrc\b)`;
const FILE_COMMANDS: RegExp[] = [
  new RegExp(String.raw`\b(?:cat|type|less|more|tail|head|cp|scp)\s+[^\n|;]{0,80}${CREDENTIAL_FILE}`, "gi"),
  new RegExp(String.raw`\b(?:curl|wget)\b[^\n]{0,200}(?:-d|--data(?:-binary)?|-F|--form|-T|--upload-file)\s+["']?[^\s"']*@?[^\s"']*${CREDENTIAL_FILE}`, "gi"),
  /\b(?:printenv|env)\b[^\n]{0,40}\|\s*(?:curl|wget|nc|ncat)\b/gi,
];

const SENT_AWAY = /\b(?:send|sends|upload|post|transmit|e-?mail|forward|exfiltrate|leak|schick\w*|sende\w*|übermittl\w*|leite\w*|lade\w*|envoi\w*|envoy\w*|invia\w*|manda\w*|envía\w*|enví\w*)\b/i;
const SECRET_OBJECT = /(?:\.env\b(?!\.(?:example|sample|template))|\benvironment (?:file|variables?)\b|\bid_rsa\b|\bcredentials?\b|\bapi[ -]?keys?\b|\bsecrets?\b|\bpasswords?\b|\btokens?\b|\bumgebungsvariablen\b|\bzugangsdaten\b|\bpasswörter?\b|\bgeheimnisse?\b)/i;
const DESTINATION = /https?:\/\/[^\s)>\]"']+|\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b|\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

// "Schick die .env-Datei an https://böse.example": ein Satz mit Verschicken, Geheimnis UND einem Ziel,
// das die Person nie genannt hat. Ohne Gesprächskontext bleibt das stumm: "POST the token to
// https://api.meinedienst.ch/login" ist in einem Entwicklungs-Prompt der Normalfall.
function findFiles(text: string, typed: string | undefined): string[] {
  const out: string[] = [];
  for (const re of FILE_COMMANDS) for (const m of matches(text, re)) out.push(clip(m[0]));
  if (typed === undefined) return out;
  const known = knownHosts(typed);
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (sentence.length > 300 || !SENT_AWAY.test(sentence) || !SECRET_OBJECT.test(sentence)) continue;
    for (const dest of matches(sentence, DESTINATION)) {
      if (!isKnown(hostOf(dest[0]), known, typed)) {
        out.push(clip(sentence));
        break;
      }
    }
  }
  return out;
}

// ---- Untergeschobene Anweisungen -------------------------------------------------------------------

const OVERRIDES: RegExp[] = [
  /\b(?:ignore|disregard|forget)\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|rules?|prompts?|messages?)/gi,
  /\b(?:ignoriere|ignorier|vergiss|missachte)\s+(?:alle\s+|die\s+|deine\s+)?(?:vorherigen|bisherigen|obigen|früheren|vorigen)\s+(?:anweisungen|regeln|instruktionen)/gi,
  /\b(?:ignore[rz]?|oublie[rz]?)\s+(?:toutes\s+)?(?:les\s+)?(?:instructions|consignes)\s+(?:précédentes|antérieures)/gi,
  /\b(?:ignora|dimentica)\s+(?:tutte\s+)?(?:le\s+)?istruzioni\s+precedenti/gi,
  /\b(?:ignora|olvida)\s+(?:todas\s+)?(?:las\s+)?instrucciones\s+(?:anteriores|previas)/gi,
  /\b(?:do not|don't|never)\s+(?:tell|mention|reveal|inform|show)\s+(?:this\s+)?(?:to\s+)?the\s+user\b/gi,
  /\bsag\w*\s+(?:dem|der)\s+(?:nutzer|benutzer|person)(?:in)?\s+(?:nichts|kein)/gi,
];

function findOverrides(text: string): string[] {
  const out: string[] = [];
  for (const re of OVERRIDES) for (const m of matches(text, re)) out.push(clip(m[0]));
  return out;
}

// ---- Links, die die Person nie geschrieben hat ------------------------------------------------------

const URL_IN_TEXT = /\bhttps?:\/\/((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:[/?#][^\s<>"'`)\]]*)?/gi;
const BARE_DOMAIN = /\b((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})\b/gi;
const HARMLESS_HOST = /(?:^|\.)(?:example\.(?:com|org|net)|example|invalid|test|localhost)$|^(?:127\.|10\.|192\.168\.)/i;

const normalizeHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

function hostOf(url: string): string {
  const m = /^(?:https?:\/\/)?(?:[^@/\s]+@)?([^/:?#\s]+)/i.exec(url);
  return normalizeHost(m?.[1] ?? url);
}

function knownHosts(typed: string): Set<string> {
  const hosts = new Set<string>();
  for (const m of matches(typed, BARE_DOMAIN)) hosts.add(normalizeHost(m[1]));
  for (const m of matches(typed, URL_IN_TEXT)) hosts.add(normalizeHost(m[1]));
  return hosts;
}

function isKnown(host: string, known: Set<string>, typed: string): boolean {
  if (HARMLESS_HOST.test(host) || typed.toLowerCase().includes(host)) return true;
  for (const k of known) if (host === k || host.endsWith(`.${k}`)) return true;
  return false;
}

function findLinks(text: string, typed: string | undefined): string[] {
  if (typed === undefined) return [];
  const known = knownHosts(typed);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of matches(text, URL_IN_TEXT)) {
    const host = normalizeHost(m[1]);
    if (seen.has(host) || isKnown(host, known, typed)) continue;
    seen.add(host);
    out.push(host);
  }
  return out;
}

// ---- Zusammenführung ----------------------------------------------------------------------------------

function risk(kind: PromptRiskKind, found: string[]): PromptRisk[] {
  const unique = [...new Set(found)];
  return unique.length === 0 ? [] : [{ kind, samples: unique.slice(0, MAX_SAMPLES), total: unique.length }];
}

/**
 * @param prompt Der Text des Prompt-Blocks.
 * @param typed  Alles, was die Person im Gespräch selbst geschrieben hat. Ohne diese Angabe
 *               (`undefined`) bleiben die Regeln stumm, die einen Vergleich brauchen (Links, Ziele
 *               beim Verschicken): ein Vergleich ohne Gegenstück warnte bei jedem Link.
 */
export function checkPrompt(prompt: string, typed?: string): PromptRisk[] {
  return [
    ...risk("secret", findSecrets(prompt)),
    ...risk("personal", findPersonal(prompt)),
    ...risk("command", findCommands(prompt)),
    ...risk("file", findFiles(prompt, typed)),
    ...risk("override", findOverrides(prompt)),
    ...risk("link", findLinks(prompt, typed)),
  ];
}
