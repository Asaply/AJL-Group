"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateClientFiscal } from "@/app/(dashboard)/clients/actions";
import type { Client } from "@/types";

const FIELDS = [
  { key: "legal_name", label: "Razón social" },
  { key: "rfc", label: "RFC" },
  { key: "tax_regime", label: "Régimen fiscal" },
  { key: "cfdi_use", label: "Uso de CFDI" },
  { key: "tax_address", label: "Dirección fiscal" },
] as const;

export function ClientFiscal({ client }: { client: Client }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(formData: FormData) {
    setBusy(true);
    const result = await updateClientFiscal(client.id, formData);
    setBusy(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setEditing(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Datos fiscales</h3>
        {!editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>}
      </div>
      {editing ? (
        <form action={handleSubmit} className="grid gap-3 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.key === "tax_address" ? "space-y-1 md:col-span-2" : "space-y-1"}>
              <Label htmlFor={`fiscal-${f.key}`}>{f.label}</Label>
              <Input id={`fiscal-${f.key}`} name={f.key} defaultValue={client[f.key] ?? ""} />
            </div>
          ))}
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>Guardar</Button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-2 md:grid-cols-2 text-sm">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.key === "tax_address" ? "md:col-span-2" : ""}>
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd>{client[f.key] || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
