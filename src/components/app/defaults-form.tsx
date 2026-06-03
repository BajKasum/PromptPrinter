"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ToolGroup } from "@/components/app/tool-group";
import { TOOL_OPTIONS, type ProjectTools } from "@/lib/tools";
import { createClient } from "@/lib/supabase/client";

export function DefaultsForm({
  userId,
  initialTools,
}: {
  userId: string;
  initialTools: ProjectTools;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tools, setTools] = useState<ProjectTools>(initialTools);
  const [saving, setSaving] = useState(false);

  const changed =
    tools.master !== initialTools.master ||
    tools.frontend !== initialTools.frontend ||
    tools.backend !== initialTools.backend ||
    tools.database !== initialTools.database;
  const canSave = !saving && changed;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ settings: { defaultTools: tools } })
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

    toast({ title: "Standardwerte gespeichert", variant: "success" });
    // The /new wizard reads these server-side; refresh so a later visit prefills.
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="space-y-5"
    >
      <ToolGroup
        label="Standard Master-Ziel"
        options={TOOL_OPTIONS.master}
        value={tools.master}
        onChange={(v) => setTools({ ...tools, master: v })}
      />
      <ToolGroup
        label="Standard Frontend-Ziel"
        options={TOOL_OPTIONS.frontend}
        value={tools.frontend}
        onChange={(v) => setTools({ ...tools, frontend: v })}
      />
      <ToolGroup
        label="Standard Backend-Ziel"
        options={TOOL_OPTIONS.backend}
        value={tools.backend}
        onChange={(v) => setTools({ ...tools, backend: v })}
      />
      <ToolGroup
        label="Standard-Datenbank"
        options={TOOL_OPTIONS.database}
        value={tools.database}
        onChange={(v) => setTools({ ...tools, database: v })}
      />

      <div className="pt-1">
        <Button type="submit" disabled={!canSave}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Speichern…
            </>
          ) : (
            "Standardwerte speichern"
          )}
        </Button>
      </div>
    </form>
  );
}
