"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProject, deleteProject } from "@/app/(dashboard)/projects/actions";
import type { Project } from "@/types";

export function ProjectEditForm({ project }: { project: Project }) {
  const router = useRouter();
  const [progress, setProgress] = useState(project.progress);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(formData: FormData) {
    const result = await updateProject(project.id, formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Cambios guardados");
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este proyecto? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    const result = await deleteProject(project.id);
    if (result?.error) {
      toast.error(result.error);
      setDeleting(false);
      return;
    }
    router.push("/projects");
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" defaultValue={project.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client">Cliente</Label>
          <Input id="client" name="client" defaultValue={project.client} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Estado</Label>
        <Select name="status" defaultValue={project.status}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <Label htmlFor="progress">Progreso</Label>
          <span>{progress}%</span>
        </div>
        <input
          id="progress"
          name="progress"
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          className="w-full"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha Inicio</Label>
          <Input id="start_date" name="start_date" type="date" defaultValue={project.start_date} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">Fecha Fin</Label>
          <Input id="end_date" name="end_date" type="date" defaultValue={project.end_date ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="budget">Presupuesto ($)</Label>
          <Input id="budget" name="budget" type="number" step="0.01" defaultValue={project.budget} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="production_cost">Costo Producción ($)</Label>
          <Input id="production_cost" name="production_cost" type="number" step="0.01" defaultValue={project.production_cost} />
        </div>
      </div>
      <div className="flex justify-between pt-2">
        <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
          Eliminar proyecto
        </Button>
        <Button type="submit">Guardar cambios</Button>
      </div>
    </form>
  );
}
