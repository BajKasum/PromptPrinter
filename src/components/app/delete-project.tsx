"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setDeleting(false);
      toast({
        title: "Nicht angemeldet",
        description: "Bitte melde dich erneut an.",
        variant: "error",
      });
      return;
    }

    // Storage objects don't cascade with the DB row, clean them up first
    // while the project_files rows (and their storage_path) still exist,
    // otherwise every deleted project leaks its files in the bucket forever.
    // Explicit user_id alongside project_id: RLS-only before (Security-Audit
    // finding L-3).
    const { data: files } = await supabase
      .from("project_files")
      .select("storage_path")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (files && files.length > 0) {
      await supabase.storage.from("project-files").remove(files.map((f) => f.storage_path));
    }

    // RLS scopes this to the owner; generations, chats and project_files rows cascade away.
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      setDeleting(false);
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Bitte versuche es erneut.",
        variant: "error",
      });
      return;
    }
    toast({
      title: "Projekt gelöscht",
      description: `„${projectName}“ wurde entfernt.`,
      variant: "success",
    });
    // The detail page no longer exists, leave for the list, which re-fetches.
    router.push("/projects");
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0 text-secondary hover:border-destructive/30 hover:bg-destructive/[0.06] hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Löschen
      </Button>

      <ConfirmDialog
        open={open}
        title="Projekt löschen?"
        description={`„${projectName}“ wird mit allen Chats, Dateien und Ergebnissen dauerhaft entfernt. Das kann nicht rückgängig gemacht werden.`}
        confirmLabel="Projekt löschen"
        busyLabel="Wird gelöscht…"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
