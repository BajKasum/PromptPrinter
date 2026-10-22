import { Users } from "lucide-react";
import { LOCALE_TAGS, type Locale } from "@/shared/i18n/locales";
import { fmt } from "@/shared/i18n/format";
import type { Messages } from "@/shared/i18n/messages/de";
import type { ActivationFunnel } from "@/server/activation-funnel";

// Die Aktivierung nach Anmeldewoche, Abschnitt "Betrieb" der Seite /usage (nur Admins, #128).
// Reine Darstellung: die Zahlen liefert `loadActivationFunnel`, hier wird nichts abgefragt.

function share(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)} %` : "–";
}

export function ActivationFunnelCard({
  funnel,
  locale,
  labels,
}: {
  funnel: ActivationFunnel;
  locale: Locale;
  labels: Messages["pages"]["usage"]["funnel"];
}) {
  const dayFormat = new Intl.DateTimeFormat(LOCALE_TAGS[locale].intl, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const weeks = funnel.weeks.filter((w) => w.signups > 0);

  return (
    <div className="card-surface mt-4 p-6">
      <h3 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
        {labels.title}
      </h3>
      <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">{labels.hint}</p>

      {weeks.length === 0 ? (
        <p className="text-[13px] text-secondary">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <thead>
              <tr className="text-[12px] text-muted-foreground">
                <th scope="col" className="pb-2 pr-3 font-medium">
                  {labels.week}
                </th>
                <th scope="col" className="pb-2 pr-3 text-right font-medium">
                  {labels.signups}
                </th>
                <th scope="col" className="pb-2 pr-3 text-right font-medium">
                  {labels.withKey}
                </th>
                <th scope="col" className="pb-2 pr-3 text-right font-medium">
                  {labels.withAnswer}
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  {labels.withSaved}
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-foreground">
              {weeks.map((w) => (
                <tr key={w.weekStart} className="border-t border-border">
                  <th scope="row" className="py-2 pr-3 font-normal text-secondary">
                    {dayFormat.format(new Date(`${w.weekStart}T00:00:00Z`))}
                  </th>
                  <td className="py-2 pr-3 text-right">{w.signups}</td>
                  <td className="py-2 pr-3 text-right">
                    {w.withKey} <span className="text-muted-foreground">{share(w.withKey, w.signups)}</span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {w.withAnswer}{" "}
                    <span className="text-muted-foreground">{share(w.withAnswer, w.signups)}</span>
                  </td>
                  <td className="py-2 text-right">
                    {w.withSavedPrompt}{" "}
                    <span className="text-muted-foreground">{share(w.withSavedPrompt, w.signups)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">{labels.note}</p>
      {funnel.truncated && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-warning">
          {fmt(labels.truncated, { limit: funnel.accountLimit })}
        </p>
      )}
    </div>
  );
}
