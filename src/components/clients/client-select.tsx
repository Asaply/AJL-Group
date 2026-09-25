"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLIENT_STATUS_LABELS } from "@/lib/clients";
import { createClientRecord } from "@/app/(dashboard)/clients/actions";
import type { Client } from "@/types";

/** Client picker for project forms. Submits `client_id` ("none" = sin cliente). */
export function ClientSelect({
  clients,
  defaultValue,
}: {
  clients: Pick<Client, "id" | "name">[];
  defaultValue?: string | null;
}) {
  const [options, setOptions] = useState(clients);
  const [value, setValue] = useState(defaultValue ?? "none");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("status", status);
    setBusy(true);
    const result = await createClientRecord(formData);
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setOptions((o) => [...o, { id: result.id, name: name.trim() }].sort((a, b) => a.name.localeCompare(b.name)));
    setValue(result.id);
    setName("");
    setStatus("active");
    setCreating(false);
  }

  return (
    <div className="flex gap-2">
      <input type="hidden" name="client_id" value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger aria-label="Cliente" className="flex-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sin cliente</SelectItem>
          {options.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" aria-label="Nuevo cliente" onClick={() => setCreating(true)}>
        <Plus className="h-4 w-4" />
      </Button>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-client-name">Nombre del cliente</Label>
              <Input id="new-client-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Estado del cliente"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" className="w-full" disabled={busy || !name.trim()} onClick={handleCreate}>
              Crear cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
