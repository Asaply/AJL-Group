"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectProgressBar } from "@/components/projects/project-progress";
import { DeliverableRow } from "@/components/projects/deliverable-row";
import { isHundred } from "@/lib/finance";
import { weightTotal } from "@/lib/deliverables";
import { createDeliverable } from "@/app/(dashboard)/projects/deliverable-actions";
import type { Deliverable, Project, Task, User } from "@/types";

export function DeliverablesPanel({
  projectId, color, deliverables, tasks, users, projects,
}: {
  projectId: string;
  color: string;
  deliverables: Deliverable[];
  tasks: Task[];
  users: User[];
  projects: Project[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const total = weightTotal(deliverables);
  const unlinked = tasks.filter((t) => !t.deliverable_id).length;

  async function handleAdd(formData: FormData) {
    const result = await createDeliverable(projectId, formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    formRef.current?.reset();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold">Entregables</h3>
        <ProjectProgressBar deliverables={deliverables} color={color} />
        {deliverables.length > 0 && (
          <p className={isHundred(total) ? "text-xs text-muted-foreground" : "text-xs text-amber-500"}>
            {isHundred(total)
              ? `Suma de pesos: ${total}% ✅`
              : `Los pesos suman ${total}%, deben sumar 100%`}
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {deliverables.map((d, i) => (
          <DeliverableRow
            key={d.id}
            deliverable={d}
            tasks={tasks.filter((t) => t.deliverable_id === d.id)}
            canMoveUp={i > 0}
            canMoveDown={i < deliverables.length - 1}
            users={users}
            projects={projects}
            deliverables={deliverables}
          />
        ))}
      </ul>

      {unlinked > 0 && (
        <p className="text-xs text-muted-foreground">
          {unlinked === 1 ? "1 pendiente sin entregable" : `${unlinked} pendientes sin entregable`} (no afectan el progreso)
        </p>
      )}

      <form ref={formRef} action={handleAdd} className="flex items-center gap-2">
        <Input name="title" placeholder="Nuevo entregable" required aria-label="Título del entregable" />
        <Input
          name="weight" type="number" step="0.01" min={0} max={100} placeholder="%"
          required className="w-24 text-right" aria-label="Peso del entregable"
        />
        <Button type="submit" size="sm"><Plus className="h-4 w-4 mr-1" />Agregar</Button>
      </form>
    </div>
  );
}
