"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  DOC_TYPE_LABELS, DOC_TYPES, describeFileLabel, formatFileSize, storagePath, validateUpload,
  type DocType, type EntityKind,
} from "@/lib/entity-files";
import { formatDate } from "@/lib/utils";
import type { ClientFile, ProjectFile } from "@/types";

const BUCKET = "entity-files";

type EntityFile = ProjectFile | ClientFile;

export type EntityFileActions = {
  register: (
    ownerId: string,
    meta: {
      storage_path: string;
      file_name: string;
      size_bytes: number;
      mime_type: string | null;
      doc_type: string;
      custom_label: string | null;
    }
  ) => Promise<{ error: string } | undefined>;
  softDelete: (id: string, ownerId: string) => Promise<{ error: string } | undefined>;
  updateType: (
    id: string,
    ownerId: string,
    docType: string,
    customLabel: string | null
  ) => Promise<{ error: string } | undefined>;
  getUrl: (id: string, ownerId: string, download: boolean) => Promise<{ url: string } | { error: string }>;
};

/**
 * Shared file manager for a project's or a client's files: drag-and-drop
 * upload with a document type, download, and a soft delete that keeps the
 * file listed (struck through, with who/when) instead of erasing the record.
 */
export function FileManager({
  entity, ownerId, files, actions, reload,
}: {
  entity: EntityKind;
  ownerId: string;
  files: EntityFile[];
  actions: EntityFileActions;
  /** Optional: for a client-managed parent (a sheet) that needs an explicit
   * re-fetch. A plain Server Component page needs nothing here — calling a
   * server action directly already revalidates the route. */
  reload?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ id: string; name: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [docType, setDocType] = useState<DocType>("contrato");
  const [customLabel, setCustomLabel] = useState("");

  const active = files.filter((f) => !f.deleted_at);
  const deleted = files.filter((f) => f.deleted_at);

  async function uploadOne(file: File) {
    const problem = validateUpload(file);
    if (problem) {
      toast.error(`${file.name}: ${problem}`);
      return;
    }
    if (docType === "otro" && !customLabel.trim()) {
      toast.error("Escribe una etiqueta para este tipo de archivo");
      return;
    }
    const id = crypto.randomUUID();
    setUploading((u) => [...u, { id, name: file.name }]);
    const supabase = createClient();
    const path = storagePath(entity, ownerId, file.name, id);
    let uploaded = false;

    async function cleanup() {
      try {
        const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([path]);
        if (cleanupError) console.error("[FileManager] cleanup failed", path, cleanupError);
      } catch (cleanupError) {
        console.error("[FileManager] cleanup failed", path, cleanupError);
      }
    }

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) {
        toast.error(`${file.name}: no se pudo subir`);
        return;
      }
      uploaded = true;

      const result = await actions.register(ownerId, {
        storage_path: path,
        file_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || null,
        doc_type: docType,
        custom_label: docType === "otro" ? customLabel.trim() : null,
      });
      if (result?.error) {
        toast.error(`${file.name}: ${result.error}`);
        await cleanup();
      }
    } catch (error) {
      console.error("[FileManager] upload failed", path, error);
      toast.error(`${file.name}: no se pudo subir`);
      if (uploaded) await cleanup();
    } finally {
      setUploading((u) => u.filter((entry) => entry.id !== id));
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    await Promise.all(Array.from(fileList).map(uploadOne));
    reload?.();
  }

  return (
    <div
      className={`space-y-3 rounded-lg ${dragging ? "ring-2 ring-primary ring-offset-2" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-sm flex-1 min-w-full sm:min-w-0">Archivos ({active.length})</h3>
        <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
          <SelectTrigger aria-label="Tipo de documento a subir" className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        {docType === "otro" && (
          <Input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Etiqueta"
            aria-label="Etiqueta del tipo de archivo"
            className="h-8 w-32 text-xs"
          />
        )}
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-4 w-4 mr-1" />Subir
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Seleccionar archivos"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {uploading.map((entry) => (
        <p key={entry.id} className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />Subiendo {entry.name}…
        </p>
      ))}
      {active.length === 0 && deleted.length === 0 && uploading.length === 0 && (
        <p className="text-sm text-muted-foreground">Arrastra archivos aquí o usa “Subir” (máx. 25 MB)</p>
      )}
      <ul className="space-y-2">
        {active.map((f) => (
          <FileRow key={f.id} file={f} ownerId={ownerId} actions={actions} reload={reload} />
        ))}
        {deleted.map((f) => (
          <DeletedFileRow key={f.id} file={f} />
        ))}
      </ul>
    </div>
  );
}

function FileRow({
  file, ownerId, actions, reload,
}: {
  file: EntityFile;
  ownerId: string;
  actions: EntityFileActions;
  reload?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState<DocType>(file.doc_type);
  const [editLabel, setEditLabel] = useState(file.custom_label ?? "");
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    const result = await actions.getUrl(file.id, ownerId, true);
    if ("error" in result) toast.error(result.error);
    else window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${file.file_name}"?`)) return;
    setBusy(true);
    const result = await actions.softDelete(file.id, ownerId);
    setBusy(false);
    if (result?.error) toast.error(result.error);
    else reload?.();
  }

  async function saveType() {
    const trimmed = editLabel.trim();
    if (editType === "otro" && !trimmed) {
      toast.error("Escribe una etiqueta para este tipo de archivo");
      return;
    }
    setBusy(true);
    const result = await actions.updateType(file.id, ownerId, editType, editType === "otro" ? trimmed : null);
    setBusy(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setEditing(false);
    reload?.();
  }

  return (
    <li className="flex items-center gap-3 text-sm">
      <FileText className="h-10 w-10 p-2 text-muted-foreground border rounded shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="truncate font-medium">{file.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size_bytes)} · {file.uploader?.name ?? "—"} · {formatDate(file.created_at)}
        </p>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={editType} onValueChange={(v) => setEditType(v as DocType)}>
              <SelectTrigger aria-label={`Tipo de ${file.file_name}`} className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            {editType === "otro" && (
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Etiqueta"
                aria-label={`Etiqueta de ${file.file_name}`}
                className="h-7 w-28 text-xs"
              />
            )}
            <Button size="sm" className="h-7" disabled={busy} onClick={saveType}>Guardar</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} aria-label={`Cambiar tipo de ${file.file_name}`}>
            <Badge variant="outline" className="cursor-pointer">{describeFileLabel(file)}</Badge>
          </button>
        )}
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Descargar archivo" onClick={handleDownload}>
        <Download className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Eliminar archivo" disabled={busy} onClick={handleDelete}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </li>
  );
}

function DeletedFileRow({ file }: { file: EntityFile }) {
  return (
    <li className="flex items-center gap-3 text-sm opacity-60">
      <FileText className="h-10 w-10 p-2 text-muted-foreground border rounded shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="truncate line-through">{file.file_name}</p>
        <p className="text-xs text-muted-foreground">
          Eliminado por {file.deleter?.name ?? "—"} el {formatDate(file.deleted_at as string)}
        </p>
      </div>
    </li>
  );
}
