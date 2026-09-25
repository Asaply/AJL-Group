"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createProject } from "@/app/(dashboard)/projects/actions";
import { ColorPicker } from "@/components/projects/color-picker";
import { ClientSelect } from "@/components/clients/client-select";
import { Plus } from "lucide-react";
import type { Client } from "@/types";

export function ProjectForm({
  defaultColor,
  clients,
}: {
  defaultColor: string;
  clients: Pick<Client, "id" | "name">[];
}) {
  const [open, setOpen] = useState(false);

  async function handleSubmit(formData: FormData) {
    const result = await createProject(formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Nuevo Proyecto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Proyecto</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label>Cliente (opcional)</Label>
            <ClientSelect clients={clients} defaultValue={null} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker name="color" defaultValue={defaultColor} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select name="status" defaultValue="active">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Fecha Inicio</Label>
              <Input id="start_date" name="start_date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha Fin</Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Presupuesto ($)</Label>
              <MoneyInput id="budget" name="budget" defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="production_cost">Costo Producción ($)</Label>
              <MoneyInput id="production_cost" name="production_cost" defaultValue="0" />
            </div>
          </div>
          <Button type="submit" className="w-full">Crear</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
