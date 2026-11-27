import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleShell } from "@/features/marketing/components/article-shell";
import { taskGuideMetadata } from "@/features/marketing/lib/article-metadata";
import {
  TASK_GUIDES,
  TASK_GUIDES_UPDATED,
  taskGuideBySlug,
  taskGuideHref,
} from "@/features/marketing/lib/task-guides";
import { FadeIn } from "@/shared/motion/fade-in";

// Eine Aufgabenseite pro Eintrag in task-guides.ts. Statisch vorgerendert: die Slugs stehen zur Build-Zeit fest,
// alles andere ist ein 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return TASK_GUIDES.map((guide) => ({ slug: guide.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = taskGuideBySlug(slug);
  if (!guide) return {};

  return taskGuideMetadata(guide);
}

const NOT_NEEDED_QUESTION = "Wann brauchst du das nicht?";

export default async function TaskGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = taskGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <ArticleShell
      article={guide}
      path={taskGuideHref(guide.slug)}
      updated={TASK_GUIDES_UPDATED}
      overview={{ href: "/aufgaben", crumb: "Aufgaben", back: "Alle Aufgaben" }}
      // Dieselben Fragen und Antworten, die unten als Überschrift und Text stehen.
      faq={[
        {
          question: guide.question,
          answer: [guide.answer, ...guide.needs.map((need) => `${need.question} ${need.why}`)].join(" "),
        },
        { question: NOT_NEEDED_QUESTION, answer: guide.notNeeded.join(" ") },
      ]}
      more={{
        title: "Weitere Aufgaben",
        links: TASK_GUIDES.filter((other) => other.slug !== guide.slug).map((other) => ({
          href: taskGuideHref(other.slug),
          label: other.label,
        })),
      }}
    >
      <FadeIn>
        <h2 className="mt-12 mb-4 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
          Was muss die KI von dir wissen?
        </h2>
        <ol className="space-y-5">
          {guide.needs.map((need, index) => (
            <li key={need.question} className="flex gap-4">
              <span
                aria-hidden
                className="mt-0.5 w-6 shrink-0 text-[12px] font-mono tabular-nums text-tertiary"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="text-[16px] font-medium text-foreground">{need.question}</p>
                <p className="mt-1 text-[15px] leading-[1.65] text-foreground/70">{need.why}</p>
              </div>
            </li>
          ))}
        </ol>
      </FadeIn>

      <FadeIn>
        <h2 className="mt-12 mb-4 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
          Wie sieht das als fertiger Prompt aus?
        </h2>
        <div
          data-testid="task-example"
          className="rounded-xl border border-border bg-surface p-5 md:p-6"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent-text">Beispiel</p>
          <p className="mt-2 text-[14px] leading-[1.6] text-secondary">
            So könnte das Gespräch laufen. Das Beispiel ist von Hand nach den Regeln geschrieben, nach denen
            Finn fragt, und stammt nicht aus einem echten Gespräch.
          </p>

          <dl className="mt-5 space-y-4 text-[15px] leading-[1.65]">
            <div>
              <dt className="text-[13px] font-medium text-tertiary">Die Idee</dt>
              <dd className="mt-0.5 text-foreground">{guide.example.idea}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-medium text-tertiary">Die Rückfrage</dt>
              <dd className="mt-0.5 text-foreground/80">{guide.example.question}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-medium text-tertiary">Die Antwort</dt>
              <dd className="mt-0.5 text-foreground/80">{guide.example.reply}</dd>
            </div>
          </dl>

          <h3 className="mt-6 text-[13px] font-medium text-tertiary">Der fertige Prompt</h3>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-border bg-surface-raised px-4 py-3 font-mono text-[13px] leading-[1.65] text-foreground">
            <code>{guide.example.prompt}</code>
          </pre>
        </div>
      </FadeIn>

      <FadeIn>
        <h2 className="mt-12 mb-3 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
          {NOT_NEEDED_QUESTION}
        </h2>
        <div className="text-[15px] leading-[1.7] text-foreground/70 [&_p]:mb-4">
          {guide.notNeeded.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </FadeIn>
    </ArticleShell>
  );
}
