"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pencil, Trash2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TaskForm } from "@/components/tasks/task-form";
import { OpenTaskButton } from "@/components/tasks/open-task-button";
import { deliverableStatus } from "@/lib/deliverables";
import { DELIVERABLE_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  approveDeliverable,
  deleteDeliverable,
  moveDeliverable,
  revokeDeliverable,
  setTaskDeliverable,
  updateDeliverable,
} from "@/app/(dashboard)/projects/deliverable-actions";
import type { Deliverable, Project, Task, User } from "@/types";

const STATUS_ICON = { pending: "⬜", ready: "🟡", approved: "✅" } as const;

export function DeliverableRow({
  deliverable, tasks, canMoveUp, canMoveDown, users, projects, deliverables, unlinkedTasks,
}: {
  deliverable: Deliverable;
  tasks: Task[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  users: User[];
  projects: Project[];
  deliverables: Deliverable[];
  unlinkedTasks: Task[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const info = deliverableStatus(deliverable, tasks);
  const done = info.totalTasks - info.openTasks;
  const { id, project_id: projectId } = deliverable;

  async function run(action: () => Promise<{ error: string } | undefined>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result?.error) toast.error(result.error);
    return !result?.error;
  }

  async function handleSave(formData: FormData) {
    if (await run(() => updateDeliverable(id, projectId, formData))) setEditing(false);
  }

  function handleApprove() {
    if (!confirm(`¿Aprobar "${deliverable.title}"? Contará ${deliverable.weight}% al progreso.`)) return;
    run(() => approveDeliverable(id, projectId));
  }

  function handleDelete() {
    const note = info.totalTasks > 0 ? ` Sus ${info.totalTasks} pendientes quedarán sin entregable.` : "";
    if (!confirm(`¿Eliminar "${deliverable.title}"?${note}`)) return;
    run(() => deleteDeliverable(id, projectId));
  }

  function handleRevoke() {
    if (!confirm(`¿Revocar la aprobación de "${deliverable.title}"? Dejará de contar al progreso.`)) return;
    run(() => revokeDeliverable(id, projectId));
  }

  return (
    <li className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Ocultar pendientes" : "Ver pendientes"}
          aria-expanded={expanded}
          className="text-muted-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span aria-hidden>{STATUS_ICON[info.status]}</span>

        {editing ? (
          <form action={handleSave} className="flex flex-1 items-center gap-2">
            <Input name="title" defaultValue={deliverable.title} required className="h-8" aria-label="Título" />
            <Input
              name="weight" type="number" step="0.01" min={0} max={100}
              defaultValue={deliverable.weight} required className="h-8 w-20 text-right" aria-label="Peso"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <Button type="submit" size="sm" disabled={busy}>Guardar</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </form>
        ) : (
          <>
            <span className="flex-1 font-medium">{deliverable.title}</span>
            <span className="text-sm tabular-nums">{Number(deliverable.weight)}%</span>
          </>
        )}
      </div>

      {!editing && (
        <div className="flex flex-wrap items-center gap-2 pl-10 text-sm">
          <Badge variant="outline">{DELIVERABLE_STATUS_LABELS[info.status]}</Badge>
          <span className="text-muted-foreground">{done}/{info.totalTasks} pendientes</span>
          {deliverable.approved_at && (
            <span className="text-muted-foreground">
              Aprobado {formatDate(deliverable.approved_at)}
              {deliverable.approver ? ` por ${deliverable.approver.name}` : ""}
            </span>
          )}
          {info.approvedWithOpenTasks && (
            <span className="text-amber-500">⚠️ Aprobado con pendientes abiertos</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {info.status === "approved" ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={handleRevoke}>
                Revocar
              </Button>
            ) : (
              <Button size="sm" disabled={busy || info.status !== "ready"} onClick={handleApprove}>
                Aprobar
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Subir" disabled={!canMoveUp || busy}
              onClick={() => run(() => moveDeliverable(id, projectId, "up"))}>
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Bajar" disabled={!canMoveDown || busy}
              onClick={() => run(() => moveDeliverable(id, projectId, "down"))}>
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Editar" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Eliminar" disabled={busy} onClick={handleDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="pl-10 space-y-2">
          {tasks.length > 0 ? (
            <ul className="space-y-1">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <OpenTaskButton
                    taskId={t.id}
                    className={t.status === "completed" ? "line-through text-muted-foreground" : ""}
                  >
                    {t.title}
                  </OpenTaskButton>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">{TASK_STATUS_LABELS[t.status]}</span>
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6" aria-label="Desligar pendiente" disabled={busy}
                      onClick={() => run(() => setTaskDeliverable(t.id, null, projectId))}
                    >
                      <Unlink className="h-3 w-3" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pendientes ligados</p>
          )}
          {unlinkedTasks.length > 0 && (
            <select
              aria-label="Ligar pendiente existente"
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value=""
              disabled={busy}
              onChange={(e) => {
                const taskId = e.target.value;
                if (taskId) run(() => setTaskDeliverable(taskId, id, projectId));
              }}
            >
              <option value="" disabled>Ligar pendiente existente</option>
              {unlinkedTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          )}
          <TaskForm
            users={users}
            projects={projects}
            deliverables={deliverables}
            defaultProjectId={projectId}
            defaultDeliverableId={id}
          />
        </div>
      )}
    </li>
  );
}
