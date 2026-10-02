"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { useToast } from "@/shared/ui/toast";
import { createClient } from "@/shared/supabase/client";
import {
  attachmentPathsOfProject,
  removeAttachmentObjects,
} from "@/shared/lib/attachment-storage";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const t = useT();
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
        title: t.projects.notSignedIn,
        description: t.projects.signInAgain,
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
    // Dasselbe fuer die Anhaenge der Chats dieses Projekts: ihre Zeilen
    // kaskadieren mit dem Projekt weg, die Objekte nicht. Pfade jetzt, solange
    // es die Zeilen noch gibt; entfernt wird erst nach dem Loeschen.
    const attachmentPaths = await attachmentPathsOfProject(supabase, user.id, projectId);

    // Explizites user_id neben RLS, wie ueberall sonst (CLAUDE.mds
    // Defense-in-depth-Standard): `user` liegt hier ohnehin schon vor, es
    // kostet also nichts. generations, chats und project_files kaskadieren weg.
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", user.id);
    if (error) {
      setDeleting(false);
      toast({
        title: t.projects.deleteFailed,
        description: t.projects.tryAgain,
        variant: "error",
      });
      return;
    }
    await removeAttachmentObjects(supabase, attachmentPaths);
    toast({
      title: t.projects.deleted,
      description: fmt(t.projects.deletedBody, { name: projectName }),
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
        {t.common.delete}
      </Button>

      <ConfirmDialog
        open={open}
        title={t.projects.deleteConfirmTitle}
        description={fmt(t.projects.deleteConfirmBody, { name: projectName })}
        confirmLabel={t.projects.deleteConfirm}
        busyLabel={t.common.deleting}
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
