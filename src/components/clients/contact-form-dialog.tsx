"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addContact, updateContact } from "@/app/(dashboard)/clients/actions";
import type { ClientContact } from "@/types";

export function ContactFormDialog({
  clientId, contact, trigger,
}: {
  clientId: string;
  contact?: ClientContact;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(formData: FormData) {
    setBusy(true);
    const result = contact ? await updateContact(contact.id, clientId, formData) : await addContact(clientId, formData);
    setBusy(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{contact ? "Editar contacto" : "Nuevo contacto"}</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="contact-name">Nombre</Label>
              <Input id="contact-name" name="name" defaultValue={contact?.name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-position">Puesto</Label>
              <Input id="contact-position" name="position" defaultValue={contact?.position ?? ""} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact-email">Email</Label>
            <Input id="contact-email" name="email" type="email" defaultValue={contact?.email ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="contact-phone">Teléfono</Label>
              <Input id="contact-phone" name="phone" type="tel" defaultValue={contact?.phone ?? ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-whatsapp">WhatsApp</Label>
              <Input id="contact-whatsapp" name="whatsapp" type="tel" defaultValue={contact?.whatsapp ?? ""} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact-notes">Notas</Label>
            <Textarea id="contact-notes" name="notes" defaultValue={contact?.notes ?? ""} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{contact ? "Guardar" : "Agregar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
