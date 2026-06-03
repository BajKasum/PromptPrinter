import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function ToolGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "h-10 px-3 rounded-lg text-[13px] font-medium transition-all border",
                active
                  ? "border-violet-500/55 bg-violet-500/10 text-white"
                  : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
