"use client";

import { primaryNav } from "@/shell/lib/nav";
import { useT } from "@/shared/i18n/provider";
import { PillLink, PillSwitch } from "@/shared/ui/pill-switch";

// Der Umschalter zwischen den beiden Zielen der Sidebar. Jede Pille ist ein echter Link, kein Zustand im Browser:
// so laufen `tab` und Adresse nie auseinander. Die Beschriftungen stehen hier bewusst in der Einzahl
// ("Chat"/"Projekt"), sonst heisst es in der App "Chats"/"Projekte" (primaryNav, Seitentitel, Befehlspalette).
// Das mobile Menü nutzt dieselbe Komponente.
export function TabSwitcher({ tab }: { tab: "chats" | "projects" }) {
  const t = useT();
  return (
    <PillSwitch className="mb-4">
      <PillLink
        href={primaryNav[0].href}
        active={tab === "chats"}
        Icon={primaryNav[0].Icon}
        label={t.nav.chatTab}
      />
      <PillLink
        href={primaryNav[1].href}
        active={tab === "projects"}
        Icon={primaryNav[1].Icon}
        label={t.nav.projectTab}
      />
    </PillSwitch>
  );
}
