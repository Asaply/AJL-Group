"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectProgressBar } from "@/components/projects/project-progress";
import { DeliverableRow } from "@/components/projects/deliverable-row";
import { isHundred } from "@/lib/finance";
import { moveItem, weightTotal } from "@/lib/deliverables";
import { useOptimisticState } from "@/lib/use-optimistic-state";
import { OpenTaskButton } from "@/components/tasks/open-task-button";
import {
  approveDeliverable, createDeliverable, moveDeliverable, revokeDeliverable, setTaskDeliverable,
} from "@/app/(dashboard)/projects/deliverable-actions";
import type { Deliverable, Project, Task, User } from "@/types";

export function DeliverablesPanel({
  projectId, color, deliverables: serverDeliverables, tasks: serverTasks, users, projects,
}: {
  projectId: string;
  color: string;
  deliverables: Deliverable[];
  tasks: Task[];
  users: User[];
  projects: Project[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  // Reorders and task links show at once; the server confirms behind the scenes.
  const [deliverables, applyDeliverables] = useOptimisticState(serverDeliverables);
  const [tasks, applyTasks] = useOptimisticState(serverTasks);
  const moveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const total = weightTotal(deliverables);
  const unlinkedTasks = tasks.filter((t) => !t.deliverable_id);

  function handleLink(taskId: string, deliverableId: string) {
    applyTasks(
      (list) => list.map((t) => (t.id === taskId ? { ...t, deliverable_id: deliverableId } : t)),
      () => setTaskDeliverable(taskId, deliverableId, projectId)
    );
  }

  // Approval lives here, not in the row, so the progress bar moves with it.
  function patchDeliverable(id: string, patch: Partial<Deliverable>, action: () => Promise<{ error: string } | undefined>) {
    applyDeliverables((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)), action);
  }

  function handleApprove(id: string) {
    patchDeliverable(id, { approved_at: new Date().toISOString() }, () => approveDeliverable(id, projectId));
  }

  function handleRevoke(id: string) {
    patchDeliverable(id, { approved_at: null, approved_by: null, approver: undefined }, () => revokeDeliverable(id, projectId));
  }

  function handleMove(id: string, direction: "up" | "down") {
    // Moves swap stored positions, so server calls run one after another.
    const queued = moveQueueRef.current.then(() => moveDeliverable(id, projectId, direction));
    moveQueueRef.current = queued.catch(() => undefined);
    applyDeliverables((list) => {
      const byId = new Map(list.map((d) => [d.id, d]));
      return moveItem(list.map((d) => d.id), id, direction).map((dId) => byId.get(dId)!);
    }, () => queued);
  }

  async function handleAdd(formData: FormData) {
    setBusy(true);
    const result = await createDeliverable(projectId, formData);
    setBusy(false);
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
            onMove={handleMove}
            onApprove={handleApprove}
            onRevoke={handleRevoke}
            users={users}
            projects={projects}
            deliverables={deliverables}
          />
        ))}
      </ul>

      {unlinkedTasks.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/50 p-3">
          <p className="text-sm text-amber-500">
            {unlinkedTasks.length === 1
              ? "1 pendiente sin entregable. Todo pendiente del proyecto debe estar ligado a uno:"
              : `${unlinkedTasks.length} pendientes sin entregable. Todo pendiente del proyecto debe estar ligado a uno:`}
          </p>
          <ul className="space-y-1">
            {unlinkedTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <OpenTaskButton taskId={t.id}>{t.title}</OpenTaskButton>
                {deliverables.length > 0 ? (
                  <select
                    aria-label={`Entregable para ${t.title}`}
                    className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-sm"
                    value=""
                    disabled={busy}
                    onChange={(e) => e.target.value && handleLink(t.id, e.target.value)}
                  >
                    <option value="" disabled>Ligar a entregable…</option>
                    {deliverables.map((d) => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-muted-foreground">Crea un entregable para ligarlo</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form ref={formRef} action={handleAdd} className="flex items-center gap-2">
        <Input name="title" placeholder="Nuevo entregable" required aria-label="Título del entregable" />
        <Input
          name="weight" type="number" step="0.01" min={0} max={100} placeholder="%"
          required className="w-24 text-right" aria-label="Peso del entregable"
        />
        <Button type="submit" size="sm" disabled={busy}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
      </form>
    </div>
  );
}
