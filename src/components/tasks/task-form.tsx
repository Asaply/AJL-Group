"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createTask } from "@/app/(dashboard)/tasks/actions";
import { PRIORITY_LABELS } from "@/lib/constants";
import type { User, Project, Deliverable } from "@/types";

export function TaskForm({
  users,
  projects,
  defaultDueDate,
  deliverables = [],
  defaultProjectId,
  defaultDeliverableId,
}: {
  users: User[];
  projects: Project[];
  defaultDueDate?: string;
  deliverables?: Deliverable[];
  defaultProjectId?: string;
  defaultDeliverableId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "none");
  const projectDeliverables = deliverables.filter((d) => d.project_id === projectId);

  async function handleSubmit(formData: FormData) {
    const result = await createTask(formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setProjectId(defaultProjectId ?? "none");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Nuevo Pendiente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear Pendiente</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Fecha límite</Label>
              <Input id="due_date" name="due_date" type="date" defaultValue={defaultDueDate} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Asignar a</Label>
              <Select name="assigned_to" required>
                <SelectTrigger id="assigned_to"><SelectValue placeholder="Socio" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project_id">Proyecto (opcional)</Label>
              <Select name="project_id" value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project_id"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General (sin proyecto)</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {projectId !== "none" && projectDeliverables.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="deliverable_id">Entregable (opcional)</Label>
              <Select key={projectId} name="deliverable_id" defaultValue={defaultDeliverableId ?? "none"}>
                <SelectTrigger id="deliverable_id"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin entregable</SelectItem>
                  {projectDeliverables.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full">Crear</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
