"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_FILES_PER_PROJECT,
  hasAllowedExtension,
  type ProjectFile,
} from "@/lib/project-files";
import { formatBytes } from "@/lib/utils";

// Workspace-Dateien (REDESIGN.md, Phase 4): kleine Text-Kontextdateien, die
// buildProjectContext direkt in jeden Projekt-Chat injiziert. Bewusst eng,
// kein Dateimanager, sondern gezielter Kontext. Upload/Delete laufen direkt
// über den Browser-Client (RLS-scoped), gleiches Muster wie
// avatar-upload.tsx, keine eigene API-Route nötig.

export function ProjectFiles({
  projectId,
  initialFiles,
}: {
  projectId: string;
  initialFiles: ProjectFile[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const atLimit = files.length >= MAX_FILES_PER_PROJECT;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    setError(null);
    if (atLimit) {
      setError(`Höchstens ${MAX_FILES_PER_PROJECT} Dateien pro Projekt.`);
      return;
    }
    if (!hasAllowedExtension(file.name)) {
      setError(`Nur ${ALLOWED_FILE_EXTENSIONS.join(", ")}.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`Höchstens ${Math.round(MAX_FILE_BYTES / 1024)} KB pro Datei.`);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");

      const fileId = crypto.randomUUID();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
      const path = `${user.id}/${projectId}/${fileId}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(path, file, { contentType: file.type || "text/plain" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("project_files").insert({
        id: fileId,
        project_id: projectId,
        user_id: user.id,
        name: file.name,
        storage_path: path,
        mime: file.type || null,
        size_bytes: file.size,
      });
      if (insertError) {
        // Roll back the orphaned storage object so a failed insert never
        // leaves untracked junk in the bucket.
        await supabase.storage.from("project-files").remove([path]);
        throw insertError;
      }

      setFiles((prev) => [
        ...prev,
        {
          id: fileId,
          name: file.name,
          storagePath: path,
          sizeBytes: file.size,
          createdAt: new Date().toISOString(),
        },
      ]);
      router.refresh();
    } catch {
      setError("Upload fehlgeschlagen. Bitte versuch es erneut.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(f: ProjectFile) {
    setDeletingId(f.id);
    setError(null);
    try {
      const supabase = createClient();
      await supabase.storage.from("project-files").remove([f.storagePath]);
      const { error: deleteError } = await supabase
        .from("project_files")
        .delete()
        .eq("id", f.id);
      if (deleteError) throw deleteError;
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      router.refresh();
    } catch {
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Bitte versuche es erneut.",
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <FileText className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.8} />
          Dateien
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {files.length}/{MAX_FILES_PER_PROJECT}
        </span>
      </div>

      {files.length > 0 && (
        <ul className="mb-2.5 space-y-0.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
            >
              <span
                className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/80"
                title={f.name}
              >
                {f.name}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatBytes(f.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => void handleDelete(f)}
                disabled={deletingId === f.id}
                aria-label={`${f.name} löschen`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-red-400 focus-visible:opacity-100 disabled:opacity-50 group-hover:opacity-100"
              >
                {deletingId === f.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_FILE_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => void handleFile(e)}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || atLimit}
        className="w-full"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {atLimit ? "Limit erreicht" : "Datei hochladen"}
      </Button>

      {error ? (
        <p className="mt-2 text-[11.5px] text-destructive">{error}</p>
      ) : (
        // Format/size tip only before the first upload, once a file's in the
        // list, the constraint has already been learned; repeating it forever
        // would be chrome, not help.
        files.length === 0 && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground/70">
            Am besten{" "}
            <code className="rounded bg-accent-subtle px-1 py-0.5 font-mono text-[11px] text-accent-text">
              .md
            </code>
            , token-effizient. Auch .txt, .json, .csv, bis {Math.round(MAX_FILE_BYTES / 1024)} KB.
          </p>
        )
      )}
    </section>
  );
}
