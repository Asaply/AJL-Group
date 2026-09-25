"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactFormDialog } from "@/components/clients/contact-form-dialog";
import { whatsappLink } from "@/lib/clients";
import { deleteContact, setPrimaryContact } from "@/app/(dashboard)/clients/actions";
import type { ClientContact } from "@/types";

export function ClientContacts({ clientId, contacts }: { clientId: string; contacts: ClientContact[] }) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<{ error: string } | undefined>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result?.error) toast.error(result.error);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Contactos</h3>
        <ContactFormDialog
          clientId={clientId}
          trigger={<Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Agregar</Button>}
        />
      </div>
      {contacts.length === 0 && <p className="text-sm text-muted-foreground">Sin contactos</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {contacts.map((c) => {
          const wa = c.whatsapp ? whatsappLink(c.whatsapp) : null;
          return (
            <li key={c.id} className="border rounded-lg p-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.name}{c.is_primary && <span className="text-amber-500"> ★</span>}</p>
                  {c.position && <p className="text-muted-foreground">{c.position}</p>}
                </div>
                <div className="flex gap-1">
                  {!c.is_primary && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Marcar a ${c.name} como principal`} disabled={busy}
                      onClick={() => run(() => setPrimaryContact(c.id, clientId))}>
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <ContactFormDialog
                    clientId={clientId}
                    contact={c}
                    trigger={<Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Editar a ${c.name}`}><Pencil className="h-3 w-3" /></Button>}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Eliminar a ${c.name}`} disabled={busy}
                    onClick={() => {
                      if (confirm(`¿Eliminar a ${c.name}? También se quitará de sus proyectos.`)) run(() => deleteContact(c.id, clientId));
                    }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 text-primary hover:underline">
                    <Mail className="h-3 w-3" aria-hidden />{c.email}
                  </a>
                )}
                {c.phone && (
                  <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 text-primary hover:underline">
                    <Phone className="h-3 w-3" aria-hidden />{c.phone}
                  </a>
                )}
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${c.name}`}
                    className="inline-flex items-center gap-2 text-primary hover:underline">
                    <MessageCircle className="h-3 w-3" aria-hidden />{c.whatsapp}
                  </a>
                )}
              </div>
              {c.notes && <p className="text-muted-foreground whitespace-pre-wrap">{c.notes}</p>}
              {(c.project_contacts ?? []).length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {(c.project_contacts ?? []).map((pc) => (
                    <li key={pc.id}>{pc.project?.name ?? "—"}: {pc.role || "sin rol"}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
