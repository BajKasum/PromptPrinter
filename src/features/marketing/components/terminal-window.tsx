import { cn } from "@/shared/lib/utils";

// Ein nachgebautes Terminal-Fenster für /terminal und /mcp: echter Text statt Bildschirmfoto, damit es
// mit der Seite skaliert, lesbar bleibt und sich ändert, wenn sich ein Befehl ändert. Sein Grund ist
// tiefes Wasser (Token --header-deep), und `dark` setzt die Schrift-Tokens darin auf die Werte für dunklen Grund.

export type TerminalLine =
  | { kind: "shell"; text: string }
  | { kind: "input"; text: string }
  | { kind: "finn"; text: string }
  | { kind: "tool"; text: string }
  | { kind: "box"; title: string; lines: string[] }
  | { kind: "hint"; text: string };

export function TerminalWindow({
  title,
  lines,
  className,
}: {
  title: string;
  lines: TerminalLine[];
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "dark overflow-hidden rounded-2xl border border-border bg-header-deep shadow-elevated",
        className
      )}
    >
      <figcaption className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span aria-hidden className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
        </span>
        <span className="font-mono text-[12px] text-secondary">{title}</span>
      </figcaption>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-[1.7] text-foreground md:px-5">
        {lines.map((line, i) => (
          <TerminalRow key={i} line={line} />
        ))}
      </pre>
    </figure>
  );
}

function TerminalRow({ line }: { line: TerminalLine }) {
  switch (line.kind) {
    case "shell":
      return (
        <div>
          <span className="text-secondary">$ </span>
          {line.text}
        </div>
      );
    case "input":
      return (
        <div>
          <span className="text-accent-text">&gt; </span>
          {line.text}
        </div>
      );
    case "finn":
      return (
        <div className="whitespace-pre-wrap">
          <span className="text-accent-text">Finn: </span>
          {line.text}
        </div>
      );
    case "tool":
      return <div className="text-secondary">{line.text}</div>;
    case "hint":
      return <div className="mt-1 text-secondary">{line.text}</div>;
    case "box":
      return (
        <div className="my-1">
          <div className="text-secondary">┌─ {line.title}</div>
          {line.lines.map((l, i) => (
            <div key={i} className="whitespace-pre-wrap">
              <span className="text-secondary">│ </span>
              {l}
            </div>
          ))}
          <div className="text-secondary">└─</div>
        </div>
      );
  }
}
