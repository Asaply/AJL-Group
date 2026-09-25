"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { linkProjectContact, unlinkProjectContact, updateProjectContactRole } from "@/app/(dashboard)/clients/actions";
import type { ClientContact, ProjectContact } from "@/types";

export function ProjectContacts({
  projectId,
  clientId,
  contacts,
  links,
}: {
  projectId: string;
  clientId: string;
  contacts: ClientContact[];
  links: ProjectContact[];
}) {
  const [contactId, setContactId] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const linkedIds = new Set(links.map((l) => l.contact_id));
  const available = contacts.filter((c) => !linkedIds.has(c.id));

  async function run(action: () => Promise<{ error: string } | undefined>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result?.error) {
      toast.error(result.error);
      return false;
    }
    return true;
  }

  async function handleLink() {
    if (!contactId) return;
    if (await run(() => linkProjectContact(projectId, contactId, role))) {
      setContactId("");
      setRole("");
    }
  }

  return (
    <div className="space-y-3" data-client-id={clientId}>
      <h3 className="font-semibold">Contactos del cliente</h3>
      {links.length === 0 && <p className="text-sm text-muted-foreground">Sin contactos ligados</p>}
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.id} className="flex items-center gap-2 text-sm border rounded-lg p-2">
            <span className="font-medium min-w-32">{link.contact?.name ?? "—"}</span>
            <Input
              defaultValue={link.role ?? ""}
              key={link.role ?? ""}
              placeholder="Rol en el proyecto"
              aria-label={`Rol de ${link.contact?.name ?? "contacto"}`}
              className="h-8"
              onBlur={(e) => {
                if (e.target.value.trim() !== (link.role ?? "")) {
                  run(() => updateProjectContactRole(link.id, projectId, e.target.value));
                }
              }}
            />
            <Button
              size="icon" variant="ghost" className="h-7 w-7" aria-label="Quitar contacto" disabled={busy}
              onClick={() => run(() => unlinkProjectContact(link.id, projectId))}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </li>
        ))}
      </ul>
      {available.length > 0 ? (
        <div className="flex gap-2">
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger aria-label="Contacto" className="w-48"><SelectValue placeholder="Contacto" /></SelectTrigger>
            <SelectContent>
              {available.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rol (ej. Aprueba diseño)" aria-label="Rol" className="flex-1" />
          <Button size="sm" onClick={handleLink} disabled={busy || !contactId}><Plus className="h-4 w-4 mr-1" />Ligar</Button>
        </div>
      ) : (
        contacts.length === 0 && <p className="text-xs text-muted-foreground">El cliente no tiene contactos registrados.</p>
      )}
    </div>
  );
}
