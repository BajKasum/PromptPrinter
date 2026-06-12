"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tour } from "@/components/onboarding/tour";
import { TOUR_STEPS } from "@/components/onboarding/tour-steps";

/**
 * Mounts the first-login tour. Auto-starts once on the dashboard when the
 * profile hasn't completed it yet; `?tour=1` (the settings restart button)
 * forces a run regardless. Closing — finish, skip or Escape — persists
 * `onboarding_done` into profiles.settings so it never auto-opens again.
 */
export function Onboarding({ userId, initialDone }: { userId: string; initialDone: boolean }) {
  return (
    // useSearchParams requires a Suspense boundary in the app router.
    <Suspense fallback={null}>
      <OnboardingInner userId={userId} initialDone={initialDone} />
    </Suspense>
  );
}

function OnboardingInner({ userId, initialDone }: { userId: string; initialDone: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forced = searchParams.get("tour") === "1";

  const [open, setOpen] = useState(false);
  // Guards the auto-run: the layout (and this ref) survives client-side
  // navigation, so finishing the tour keeps it closed for the whole session
  // even though the server prop only refreshes on a full reload.
  const ranRef = useRef(false);

  useEffect(() => {
    if (open) return;
    const auto = !initialDone && !ranRef.current && pathname === "/dashboard";
    if (forced || auto) {
      // Small delay so the dashboard has painted and targets are measurable.
      // The ref is only set when the timer actually fires — setting it earlier
      // would let StrictMode's mount/cleanup/mount cycle cancel the tour.
      const t = window.setTimeout(() => {
        ranRef.current = true;
        setOpen(true);
      }, 700);
      return () => window.clearTimeout(t);
    }
  }, [forced, initialDone, pathname, open]);

  const close = useCallback(() => {
    setOpen(false);
    if (forced) router.replace(pathname, { scroll: false });
    // Persist in the background — closing the tour must never feel blocked.
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("profiles")
          .select("settings")
          .eq("id", userId)
          .maybeSingle();
        const raw = data?.settings;
        const current =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : {};
        await supabase
          .from("profiles")
          .update({ settings: { ...current, onboarding_done: true } })
          .eq("id", userId);
      } catch {
        // Best effort: a failed write just means the tour offers itself again.
      }
    })();
  }, [forced, pathname, router, userId]);

  if (!open) return null;
  return <Tour steps={TOUR_STEPS} onClose={close} />;
}
