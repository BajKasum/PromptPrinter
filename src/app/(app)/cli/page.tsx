import { FadeIn } from "@/shared/motion/fade-in";
import { CliApproval } from "@/features/auth/components/cli-approval";
import { getT } from "@/server/i18n";

export async function generateMetadata() {
  return { title: (await getT()).cliLogin.title };
}

// Der Nutzer-Code kommt aus dem Terminal und wird abgetippt. Diese Seite liest bewusst keinen Code aus der
// Adresse (searchParams): ein vorausgefüllter Link ließe sich jemandem unterschieben (api/cli/device).
export const dynamic = "force-dynamic";

export default async function CliLoginPage() {
  const t = await getT();
  return (
    <div>
      <FadeIn>
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
          {t.cliLogin.title}
        </h1>
        <p className="mt-1.5 text-[14px] text-secondary mb-8">{t.cliLogin.intro}</p>
      </FadeIn>

      <CliApproval />
    </div>
  );
}
