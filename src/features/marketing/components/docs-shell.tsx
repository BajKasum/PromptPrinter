import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import {
  DOCS_GROUPS,
  DOCS_ORDER,
  docHref,
  docNeighbours,
  docStep,
} from "@/shared/lib/docs-nav";
import { cn } from "@/shared/lib/utils";

// Shared chrome for every docs article. Deliberately a server component: the
// active entry comes in as `slug` from the page itself, so the sidebar needs
// no client-side pathname hook and the whole section stays static.
//
// The sidebar is a reading path, not a search index — there is no search box,
// the articles are few enough to scan and each one hands off to the next at
// the bottom. Same prose styling as LegalShell so docs and legal pages read
// as one family.

function SidebarNav({ slug }: { slug?: string }) {
  return (
    <nav aria-label="Dokumentation">
      <ul className="space-y-7">
        {DOCS_GROUPS.map((group) => (
          <li key={group.title}>
            <h2 className="mb-2.5 text-[11px] font-mono uppercase tracking-[0.08em] text-tertiary">
              {group.title}
            </h2>
            <ul className="space-y-0.5 border-l border-border">
              {group.articles.map((article) => {
                const active = article.slug === slug;
                return (
                  <li key={article.slug}>
                    <Link
                      href={docHref(article.slug)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "-ml-px flex border-l-2 py-1.5 pl-4 text-[13.5px] leading-snug transition-colors",
                        active
                          ? "border-accent font-medium text-foreground"
                          : "border-transparent text-secondary hover:border-border-strong hover:text-foreground"
                      )}
                    >
                      {article.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DocsShell({
  slug,
  title,
  intro,
  children,
}: {
  /** Slug of the article being shown; omitted on the docs index. */
  slug?: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  const { prev, next } = slug
    ? docNeighbours(slug)
    : { prev: null, next: null };
  const step = slug ? docStep(slug) : 0;

  return (
    <>
      <div className="container-x pt-28 md:pt-36 pb-24">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
          {/* Desktop sidebar: sticky, clears the floating navbar pill. */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-28">
              <Link
                href="/docs"
                className="mb-7 inline-block text-[13px] text-tertiary transition-colors hover:text-foreground"
              >
                ← Alle Themen
              </Link>
              <SidebarNav slug={slug} />
            </div>
          </aside>

          {/* Mobile: native disclosure, no JS needed for a list this small. */}
          <details className="card-surface group px-4 py-3 lg:hidden">
            <summary className="cursor-pointer list-none text-[14px] font-medium text-foreground marker:hidden">
              <span className="flex items-center justify-between">
                Alle Themen
                <span className="text-[12px] text-tertiary transition-transform group-open:rotate-180">
                  ▾
                </span>
              </span>
            </summary>
            <div className="mt-5 pb-2">
              <SidebarNav slug={slug} />
            </div>
          </details>

          <article
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 focus:outline-none"
          >
            <FadeIn>
              {slug && (
                <p className="mb-4 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
                  Schritt {step} von {DOCS_ORDER.length}
                </p>
              )}
              <h1 className="text-balance text-[34px] md:text-[44px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
                {title}
              </h1>
              {intro && (
                <p className="mt-5 max-w-2xl text-[16px] leading-[1.65] text-secondary">
                  {intro}
                </p>
              )}
            </FadeIn>

            <FadeIn>
              <div className="mt-10 max-w-2xl text-[15px] leading-[1.7] text-foreground/70 [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:border [&_code]:border-border [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-foreground/90 [&_li]:marker:text-tertiary [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_p]:mb-4 [&_strong]:font-medium [&_strong]:text-foreground/90 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                {children}
              </div>
            </FadeIn>

            {(prev || next) && (
              <nav
                aria-label="Weitere Themen"
                className="mt-14 grid gap-3 border-t border-border pt-8 sm:grid-cols-2"
              >
                {prev ? (
                  <Link
                    href={docHref(prev.slug)}
                    className="card-surface group p-4 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-[12px] text-tertiary">
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Vorher
                    </span>
                    <span className="mt-1 block text-[14.5px] font-medium text-foreground">
                      {prev.title}
                    </span>
                  </Link>
                ) : (
                  <span aria-hidden />
                )}
                {next && (
                  <Link
                    href={docHref(next.slug)}
                    className="card-surface group p-4 text-right transition-colors sm:col-start-2"
                  >
                    <span className="flex items-center justify-end gap-1.5 text-[12px] text-tertiary">
                      Als Nächstes
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-1 block text-[14.5px] font-medium text-foreground">
                      {next.title}
                    </span>
                  </Link>
                )}
              </nav>
            )}
          </article>
        </div>
      </div>
    </>
  );
}
