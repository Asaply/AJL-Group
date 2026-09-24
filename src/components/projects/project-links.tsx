"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addProjectLink, deleteProjectLink } from "@/app/(dashboard)/projects/actions";
import { parseHttpUrl } from "@/lib/url";
import type { ProjectLink } from "@/types";

export function ProjectLinks({ links, projectId }: { links: ProjectLink[]; projectId: string }) {
  const [adding, setAdding] = useState(false);

  async function handleAdd(formData: FormData) {
    const result = await addProjectLink(projectId, formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setAdding(false);
  }

  async function handleDelete(linkId: string) {
    const result = await deleteProjectLink(linkId, projectId);
    if (result?.error) toast.error(result.error);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Enlaces</h3>
        <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {adding && (
        <form action={handleAdd} className="flex gap-2">
          <Input name="label" placeholder="Etiqueta" required className="w-32" />
          <Input name="url" type="url" placeholder="https://..." required className="flex-1" />
          <Button type="submit" size="sm">Agregar</Button>
        </form>
      )}
      {links.map((link) => {
        // Defence in depth: never put a non-http(s) URL (e.g. javascript:)
        // into an href, even if one somehow made it into the database.
        const safeUrl = parseHttpUrl(link.url);
        return (
          <div key={link.id} className="flex items-center justify-between text-sm">
            {safeUrl ? (
              <a href={safeUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />{link.label}
              </a>
            ) : (
              <span className="flex items-center gap-2 text-muted-foreground" title="URL no válida">
                <ExternalLink className="h-3 w-3" />{link.label}
              </span>
            )}
            <form action={() => handleDelete(link.id)}>
              <Button variant="ghost" size="icon" type="submit" className="h-6 w-6">
                <Trash2 className="h-3 w-3" />
              </Button>
            </form>
          </div>
        );
      })}
      {links.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Sin enlaces</p>
      )}
    </div>
  );
}
