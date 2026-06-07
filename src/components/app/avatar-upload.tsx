"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

// One file per user at a fixed path; upsert replaces it in place so storage
// never accumulates orphans. A ?v= cache-buster forces browsers/CDN to refetch.
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export function AvatarUpload({
  userId,
  displayName,
  email,
  initialUrl,
}: {
  userId: string;
  displayName: string;
  email: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  const label = displayName || email.split("@")[0] || "?";
  const initial = (label[0] ?? "?").toUpperCase();
  const showImage = url && !broken;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Bitte eine Bilddatei wählen (JPG, PNG, WebP oder GIF).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Das Bild ist zu gross — höchstens 2 MB.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const path = `${userId}/avatar`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) {
        setError("Upload fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      const bustedUrl = `${publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: bustedUrl })
        .eq("id", userId);
      if (updateError) {
        setError("Bild gespeichert, aber Profil konnte nicht aktualisiert werden.");
        return;
      }

      setBroken(false);
      setUrl(bustedUrl);
      toast({ title: "Profilbild aktualisiert", variant: "success" });
      router.refresh();
    } catch {
      setError("Unerwarteter Fehler beim Hochladen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.storage.from("avatars").remove([`${userId}/avatar`]);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (updateError) {
        setError("Konnte das Bild nicht entfernen. Bitte versuche es erneut.");
        return;
      }

      setUrl(null);
      setBroken(false);
      toast({ title: "Profilbild entfernt", variant: "success" });
      router.refresh();
    } catch {
      setError("Unerwarteter Fehler beim Entfernen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-16 w-16 shrink-0">
        {showImage ? (
          // Supabase storage serves dynamic per-user URLs; next/image would need
          // remote-pattern config, so a plain img with an onError fallback is simpler.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Profilbild"
            className="h-16 w-16 rounded-full border border-border object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-accent text-[22px] font-semibold text-accent-foreground">
            {initial}
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55">
            <Loader2 className="h-5 w-5 animate-spin text-foreground" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFile(e)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <Upload className="h-4 w-4" />
            {url ? "Bild ändern" : "Bild hochladen"}
          </Button>
          {url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleRemove()}
              disabled={busy}
              className="text-foreground/60 hover:text-red-300 hover:border-red-500/30 hover:bg-red-500/[0.06]"
            >
              <Trash2 className="h-4 w-4" />
              Entfernen
            </Button>
          )}
        </div>
        {error ? (
          <p className="mt-1.5 text-[12px] text-red-300/90">{error}</p>
        ) : (
          <p className="mt-1.5 text-[12px] text-foreground/40">JPG, PNG, WebP oder GIF — höchstens 2 MB.</p>
        )}
      </div>
    </div>
  );
}
