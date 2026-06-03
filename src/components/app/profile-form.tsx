"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({
  userId,
  email,
  initialDisplayName,
}: {
  userId: string;
  email: string;
  initialDisplayName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saving, setSaving] = useState(false);

  const trimmed = displayName.trim();
  // Only allow saving a non-empty name that actually differs from what's stored.
  const canSave = !saving && trimmed.length > 0 && trimmed !== initialDisplayName.trim();

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", userId);
    setSaving(false);

    if (error) {
      toast({
        title: "Konnte nicht gespeichert werden",
        description: "Bitte versuche es erneut.",
        variant: "error",
      });
      return;
    }

    toast({ title: "Profil gespeichert", variant: "success" });
    // Server components (topbar greeting, dashboard) re-read the new name.
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="display-name">Anzeigename</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Dein Name"
          maxLength={60}
          autoComplete="name"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" defaultValue={email} disabled autoComplete="off" />
        <p className="text-[12px] text-white/40">
          Die Email ist mit deinem Login verknüpft und kann hier nicht geändert werden.
        </p>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={!canSave}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Speichern…
            </>
          ) : (
            "Änderungen speichern"
          )}
        </Button>
      </div>
    </form>
  );
}
