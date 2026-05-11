import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

export function Logo({ className, size = 28, showWordmark = true }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-white">
          PromptPrinter
        </span>
      )}
    </div>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PromptPrinter"
    >
      <defs>
        <linearGradient id="pp-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="0.5" stopColor="#06B6D4" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="pp-grad-soft" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" stopOpacity="0.18" />
          <stop offset="1" stopColor="#3B82F6" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="url(#pp-grad-soft)" stroke="rgba(255,255,255,0.10)" />
      {/* Double P monogram */}
      <path
        d="M8.5 23V9h4.6c2.55 0 4.4 1.6 4.4 4 0 2.45-1.85 4-4.4 4H11v6H8.5Zm2.5-8.4h1.95c1.2 0 1.95-.65 1.95-1.6s-.75-1.55-1.95-1.55H11V14.6Z"
        fill="url(#pp-grad)"
      />
      <path
        d="M16 23V9h4.6c2.55 0 4.4 1.6 4.4 4 0 2.45-1.85 4-4.4 4H18.5v6H16Zm2.5-8.4h1.95c1.2 0 1.95-.65 1.95-1.6s-.75-1.55-1.95-1.55H18.5V14.6Z"
        fill="url(#pp-grad)"
        opacity="0.85"
      />
    </svg>
  );
}
