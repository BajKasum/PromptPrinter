"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { de, type Messages } from "@/shared/i18n/messages/de";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/shared/i18n/locales";

// Das aktive Wörterbuch für Client-Komponenten. Das (app)-Layout liest die
// Sprache auf dem Server und reicht NUR dieses eine Wörterbuch herein; die
// anderen Sprachen erreichen den Browser nie.
//
// Der Standardwert ist Deutsch, nicht `null`: jede Komponente, die ausserhalb
// des Providers rendert (die Komponenten-Tests, eine Fehlerseite ausserhalb
// des Layouts), bekommt so dieselben Texte wie bisher, statt abzustürzen.
// Das kostet das deutsche Wörterbuch im Bundle, einmal, gzip rund 10 KB.

type I18nValue = { locale: Locale; t: Messages };

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, t: de });

export function I18nProvider({
  locale,
  messages,
  persistCookie = false,
  children,
}: {
  locale: Locale;
  messages: Messages;
  /**
   * Die Sprache kam aus dem Profil, nicht aus dem Cookie (neues Gerät).
   * Dann schreibt der Provider den Cookie nach, damit auch die API-Routen,
   * die nur den Cookie lesen, ab jetzt in dieser Sprache antworten.
   */
  persistCookie?: boolean;
  children: ReactNode;
}) {
  // <html lang> gehört dem Root-Layout und steht dort fest auf "de" (es
  // darf keine Request-Daten lesen, sonst werden alle öffentlichen Seiten
  // dynamisch, siehe tests/guards/static-public-pages.test.ts). Hier, in der
  // App, zieht es der Client nach und stellt es beim Verlassen zurück.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.lang;
    html.lang = locale;
    return () => {
      html.lang = previous;
    };
  }, [locale]);

  useEffect(() => {
    if (!persistCookie) return;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [persistCookie, locale]);

  return <I18nContext.Provider value={{ locale, t: messages }}>{children}</I18nContext.Provider>;
}

/** Das Wörterbuch der aktiven Sprache. */
export function useT(): Messages {
  return useContext(I18nContext).t;
}

/** Die aktive Sprache, für Intl-Formatierung und Mehrzahl. */
export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
