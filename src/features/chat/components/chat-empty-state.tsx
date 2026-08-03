"use client";

import { AnimatedMascot } from "@/shared/brand/animated-mascot";

// Just Finn and his opening line, nothing else competing for attention while
// the page is still empty.
export function ChatEmptyState({ heading }: { heading: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center">
      <AnimatedMascot state="curious" size={84} priority className="mx-auto mb-4" />
      <h2 className="text-[18px] font-semibold text-foreground">{heading}</h2>
    </div>
  );
}
