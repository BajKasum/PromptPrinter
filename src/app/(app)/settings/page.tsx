import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="max-w-[800px]">
      <FadeIn>
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
          Settings
        </h1>
        <p className="mt-1 text-[14px] text-white/55 mb-10">
          Workspace, profile, and integration configuration.
        </p>
      </FadeIn>

      <div className="space-y-6">
        <Section title="Profile" description="How you appear in your workspace.">
          <Field label="Display name" id="display-name" placeholder="Your name" />
          <Field label="Email" id="email" type="email" placeholder="you@example.com" disabled />
          <div className="pt-2">
            <Button>Save changes</Button>
          </div>
        </Section>

        <Section
          title="API keys"
          description="Bring your own keys (Pro+). When set, generations bill to your provider account."
        >
          <Field
            label="Anthropic API key"
            id="anthropic"
            type="password"
            placeholder="sk-ant-…"
          />
          <Field label="OpenAI API key" id="openai" type="password" placeholder="sk-…" />
          <div className="pt-2">
            <Button>Save keys</Button>
          </div>
        </Section>

        <Section title="Defaults" description="Pre-fill these when starting a new project.">
          <Field label="Default master target" id="default-master" placeholder="Claude" />
          <Field label="Default frontend target" id="default-frontend" placeholder="Lovable" />
          <Field label="Default backend target" id="default-backend" placeholder="Claude Code" />
          <Field label="Default database" id="default-db" placeholder="Supabase" />
          <div className="pt-2">
            <Button>Save defaults</Button>
          </div>
        </Section>

        <Section title="Danger zone" description="Irreversible actions.">
          <div className="rounded-lg border border-red-500/25 bg-red-500/[0.04] p-4 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-medium text-white">Delete account</div>
              <div className="text-[12.5px] text-white/55">Removes all projects and generations.</div>
            </div>
            <Button variant="destructive">Delete</Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface">
      <div className="mb-5">
        <h2 className="text-[16px] font-semibold tracking-tight text-white">{title}</h2>
        <p className="text-[13px] text-white/55 mt-1">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  id,
  ...props
}: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}
