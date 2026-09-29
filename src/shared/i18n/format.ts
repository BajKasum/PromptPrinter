import { createElement, Fragment, type ReactNode } from "react";
import { LOCALE_TAGS, type Locale } from "@/shared/i18n/locales";

type Vars = Record<string, string | number>;

/**
 * Setzt Werte in einen Text ein: `fmt("Hallo {name}", { name: "Finn" })`.
 * Unbekannte Platzhalter bleiben stehen, statt still zu verschwinden, damit
 * ein vergessener Wert auf dem Bildschirm auffällt.
 */
export function fmt(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

/** Ein Text mit Einzahl und Mehrzahl, `{count}` wird eingesetzt. */
export type PluralText = { one: string; other: string };

/**
 * Wählt Ein- oder Mehrzahl nach den Regeln der Sprache (Intl.PluralRules).
 * Französisch, Italienisch und Spanisch kennen für grosse Zahlen zusätzlich
 * "many"; das fällt hier auf "other" zurück, was in allen fünf Sprachen die
 * richtige Form ist.
 */
export function plural(text: PluralText, count: number, locale: Locale, vars: Vars = {}): string {
  const rule = new Intl.PluralRules(LOCALE_TAGS[locale].intl).select(count);
  const template = rule === "one" ? text.one : text.other;
  return fmt(template, { count, ...vars });
}

/**
 * Wie fmt(), aber Platzhalter dürfen React-Knoten sein, etwa ein fett
 * gesetzter Titel oder ein Link mitten im Satz:
 * `rich("„{title}“ löschen?", { title: <strong>{name}</strong> })`.
 * So bleibt der ganze Satz in einem Wörterbuch-Eintrag und jede Sprache kann
 * die Reihenfolge selbst bestimmen, statt dass der Code Satzteile aneinanderklebt.
 */
export function rich(template: string, vars: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return createElement(Fragment, { key: i }, key && key in vars ? vars[key] : part);
  });
}
