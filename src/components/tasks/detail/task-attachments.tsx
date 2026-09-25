"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatFileSize, isImage, storagePath, validateUpload } from "@/lib/attachments";
import { formatDate } from "@/lib/utils";
import { deleteAttachment, getAttachmentUrl, registerAttachment } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskAttachment, TaskDetail } from "@/types";

export function TaskAttachments({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const taskId = detail.task.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ id: string; name: string }[]>([]);
  const [dragging, setDragging] = useState(false);

  async function uploadOne(file: File) {
    const problem = validateUpload(file);
    if (problem) {
      toast.error(`${file.name}: ${problem}`);
      return;
    }
    const id = crypto.randomUUID();
    setUploading((u) => [...u, { id, name: file.name }]);
    const supabase = createClient();
    const path = storagePath(taskId, file.name, id);
    let uploaded = false;

    // don't leave an orphan object; log if even the cleanup fails
    async function cleanup() {
      try {
        const { error: cleanupError } = await supabase.storage.from("task-files").remove([path]);
        if (cleanupError) console.error("[TaskAttachments] cleanup failed", path, cleanupError);
      } catch (cleanupError) {
        console.error("[TaskAttachments] cleanup failed", path, cleanupError);
      }
    }

    try {
      const { error: uploadError } = await supabase.storage
        .from("task-files")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) {
        toast.error(`${file.name}: no se pudo subir`);
        return;
      }
      uploaded = true;

      const result = await registerAttachment(taskId, {
        storage_path: path,
        file_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || null,
      });
      if (result?.error) {
        toast.error(`${file.name}: ${result.error}`);
        await cleanup();
      }
    } catch (error) {
      console.error("[TaskAttachments] upload failed", path, error);
      toast.error(`${file.name}: no se pudo subir`);
      if (uploaded) await cleanup();
    } finally {
      setUploading((u) => u.filter((entry) => entry.id !== id));
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    await Promise.all(Array.from(files).map(uploadOne));
    reload();
  }

  return (
    <div
      className={`space-y-2 rounded-lg ${dragging ? "ring-2 ring-primary ring-offset-2" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Archivos ({detail.attachments.length})</h3>
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
      {detail.attachments.length === 0 && uploading.length === 0 && (
        <p className="text-sm text-muted-foreground">Arrastra archivos aquí o usa “Subir” (máx. 25 MB)</p>
      )}
      <ul className="space-y-2">
        {detail.attachments.map((a) => (
          <AttachmentRow key={a.id} attachment={a} canDelete={a.uploaded_by === detail.currentUserId} reload={reload} />
        ))}
      </ul>
    </div>
  );
}

function AttachmentRow({
  attachment, canDelete, reload,
}: {
  attachment: TaskAttachment;
  canDelete: boolean;
  reload: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const image = isImage(attachment.mime_type);

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    getAttachmentUrl(attachment.id, attachment.task_id, false).then((r) => {
      if (!cancelled && "url" in r) setThumb(r.url);
    });
    return () => { cancelled = true; };
  }, [attachment.id, attachment.task_id, image]);

  async function handleDownload() {
    const result = await getAttachmentUrl(attachment.id, attachment.task_id, true);
    if ("error" in result) toast.error(result.error);
    else window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${attachment.file_name}"?`)) return;
    const result = await deleteAttachment(attachment.id, attachment.task_id);
    if (result?.error) toast.error(result.error);
    else reload();
  }

  return (
    <li className="flex items-center gap-3 text-sm">
      {image && thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL
        <img src={thumb} alt="" className="h-10 w-10 rounded object-cover border" />
      ) : (
        <FileText className="h-10 w-10 p-2 text-muted-foreground border rounded" />
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{attachment.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size_bytes)} · {attachment.uploader?.name ?? "—"} · {formatDate(attachment.created_at)}
        </p>
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Descargar archivo" onClick={handleDownload}>
        <Download className="h-3 w-3" />
      </Button>
      {canDelete && (
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Eliminar archivo" onClick={handleDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </li>
  );
}
