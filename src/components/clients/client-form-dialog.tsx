"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CLIENT_STATUS_LABELS } from "@/lib/clients";
import { createClientRecord, updateClient } from "@/app/(dashboard)/clients/actions";
import type { Client } from "@/types";

export function ClientFormDialog({ client, trigger }: { client?: Client; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(client?.status ?? "active");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(formData: FormData) {
    formData.set("status", status);
    setBusy(true);
    const result = client ? await updateClient(client.id, formData) : await createClientRecord(formData);
    setBusy(false);
    if (result && "error" in result) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    if (!client && result && "id" in result) router.push(`/clients/${result.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{client ? "Editar cliente" : "Nuevo cliente"}</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="client-name">Nombre</Label>
            <Input id="client-name" name="name" defaultValue={client?.name} required />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Estado"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CLIENT_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="client-industry">Industria</Label>
              <Input id="client-industry" name="industry" defaultValue={client?.industry ?? ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="client-city">Ciudad</Label>
              <Input id="client-city" name="city" defaultValue={client?.city ?? ""} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="client-website">Sitio web</Label>
            <Input id="client-website" name="website" type="url" placeholder="https://…" defaultValue={client?.website ?? ""} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{client ? "Guardar" : "Crear"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
