"use client";

import { Download } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useT } from "@/shared/i18n/provider";

/**
 * Der Datenexport (Betriebs-Audit 04.10.2026): ein gewöhnlicher Link mit
 * `download` auf /api/account/export, keine fetch-Logik. Der Browser legt die
 * Datei selbst ab und zeigt Fortschritt, Abbruch und einen fehlgeschlagenen
 * Download an; eine Seite, die die Datei erst in den Speicher lädt, könnte das
 * bei grossen Konten nicht, und ein Fehler mitten im Strom bliebe ihr verborgen.
 */
export function DataExport() {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] leading-relaxed text-secondary">{t.settings.dataExport.body}</p>
      <Button asChild variant="ghost" className="shrink-0">
        <a href="/api/account/export" download>
          <Download className="h-4 w-4" />
          {t.settings.dataExport.button}
        </a>
      </Button>
    </div>
  );
}
