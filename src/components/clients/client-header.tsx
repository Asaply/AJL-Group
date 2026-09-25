"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { createClient } from "@/lib/supabase/client";
import { CLIENT_STATUS_LABELS } from "@/lib/clients";
import { logoPath, validateLogo } from "@/lib/client-logo";
import { parseHttpUrl } from "@/lib/url";
import { deleteClient, setClientLogo } from "@/app/(dashboard)/clients/actions";
import type { Client } from "@/types";

export function ClientHeader({ client, projectCount }: { client: Client; projectCount: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const website = client.website ? parseHttpUrl(client.website) : null;

  async function removeUploaded(supabase: ReturnType<typeof createClient>, path: string) {
    try {
      const { error: cleanupError } = await supabase.storage.from("client-logos").remove([path]);
      if (cleanupError) console.error("[ClientHeader] cleanup failed", path, cleanupError);
    } catch (cleanupError) {
      console.error("[ClientHeader] cleanup failed", path, cleanupError);
    }
  }

  async function handleLogo(file: File) {
    const problem = validateLogo(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    let uploaded = false;
    let registered = false;
    let supabase: ReturnType<typeof createClient> | undefined;
    let path: string | undefined;
    try {
      supabase = createClient();
      path = logoPath(client.id, crypto.randomUUID(), file.type);
      const { error: uploadError } = await supabase.storage.from("client-logos").upload(path, file, { contentType: file.type });
      if (uploadError) {
        toast.error("No se pudo subir el logo");
        return;
      }
      uploaded = true;
      registered = true;
      const result = await setClientLogo(client.id, path);
      if (result?.error) {
        toast.error(result.error);
        await removeUploaded(supabase, path);
      }
    } catch (error) {
      console.error("[ClientHeader] logo upload failed", error);
      toast.error("No se pudo subir el logo");
      if (uploaded && !registered && supabase && path) {
        await removeUploaded(supabase, path);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveLogo() {
    setBusy(true);
    try {
      const result = await setClientLogo(client.id, null);
      if (result?.error) toast.error(result.error);
    } catch {
      toast.error("No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const note = projectCount > 0 ? ` Sus ${projectCount} proyectos quedarán sin cliente.` : "";
    if (!confirm(`¿Eliminar a ${client.name}?${note}`)) return;
    setBusy(true);
    try {
      const result = await deleteClient(client.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      router.push("/clients");
    } catch {
      toast.error("No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || busy}
          aria-label={client.logo_path ? "Cambiar logo" : "Subir logo"}
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ClientAvatar name={client.name} logoPath={client.logo_path} className="h-16 w-16 text-xl" />
        </button>
        {client.logo_path && (
          <button
            type="button"
            onClick={handleRemoveLogo}
            disabled={busy}
            className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
          >
            Quitar logo
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Seleccionar logo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLogo(file);
            e.target.value = "";
          }}
        />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">{client.name}</h1>
          <Badge>{CLIENT_STATUS_LABELS[client.status]}</Badge>
        </div>
        <p className="text-muted-foreground">
          {[client.industry, client.city].filter(Boolean).join(" · ") || "Sin industria ni ciudad"}
        </p>
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Globe className="h-3 w-3" aria-hidden />{website}
          </a>
        )}
      </div>
      <div className="flex gap-2">
        <ClientFormDialog client={client} trigger={<Button variant="outline"><Pencil className="h-4 w-4 mr-2" />Editar</Button>} />
        <Button variant="destructive" onClick={handleDelete} disabled={busy}><Trash2 className="h-4 w-4 mr-2" />Eliminar</Button>
      </div>
    </div>
  );
}
