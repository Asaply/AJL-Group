"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseHttpUrl } from "@/lib/url";
import { addTaskLink, deleteTaskLink } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskDetail } from "@/types";

export function TaskLinks({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const taskId = detail.task.id;
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAdd(formData: FormData) {
    setBusy(true);
    const result = await addTaskLink(taskId, formData);
    setBusy(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    formRef.current?.reset();
    setAdding(false);
    reload();
  }

  async function handleDelete(id: string) {
    const result = await deleteTaskLink(id, taskId);
    if (result?.error) toast.error(result.error);
    else reload();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Links</h3>
        <Button size="sm" variant="ghost" onClick={() => setAdding(!adding)} aria-label="Agregar link">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {adding && (
        <form ref={formRef} action={handleAdd} className="flex gap-2">
          <Input name="label" placeholder="Etiqueta" required className="h-8 w-32" aria-label="Etiqueta del link" />
          <Input name="url" type="url" placeholder="https://…" required className="h-8 flex-1" aria-label="URL del link" />
          <Button type="submit" size="sm" disabled={busy}>Agregar</Button>
        </form>
      )}
      {detail.links.length === 0 && !adding && <p className="text-sm text-muted-foreground">Sin links</p>}
      <ul className="space-y-1">
        {detail.links.map((link) => {
          const safeUrl = parseHttpUrl(link.url);
          return (
            <li key={link.id} className="flex items-center justify-between text-sm">
              {safeUrl ? (
                <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />{link.label}
                </a>
              ) : (
                <span>{link.label}</span>
              )}
              <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Eliminar link" onClick={() => handleDelete(link.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
