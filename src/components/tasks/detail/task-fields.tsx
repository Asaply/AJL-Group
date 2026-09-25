"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectDot } from "@/components/projects/project-dot";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { isValidDateKey } from "@/lib/project-form";
import { useOptimisticState } from "@/lib/use-optimistic-state";
import { updateTaskField } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskDetail } from "@/types";

/** Empty (clears the date) or a complete, real YYYY-MM-DD from 1900 on. */
function isSavableDueDate(value: string): boolean {
  return value === "" || (isValidDateKey(value) && Number(value.slice(0, 4)) >= 1900);
}

export function TaskFields({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const { users, projects, deliverables } = detail;
  // Selects read from this optimistic copy so a pick shows at once, not after the reload.
  const [task, applyTask] = useOptimisticState(detail.task);
  type TaskPatch = Partial<typeof task>;
  const [title, setTitle] = useState(task.title);
  useEffect(() => setTitle(task.title), [task.title]);

  // Date inputs emit intermediate values while the year is typed (0002-…,
  // 0020-…), so keep a local value and only save on blur/Enter. Server updates
  // are taken only while the user isn't editing the field.
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const dueDateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== dueDateRef.current) setDueDate(task.due_date ?? "");
  }, [task.due_date]);

  // Only projects with deliverables can hold tasks, so the picker lists deliverables grouped by project.
  const projectsWithDeliverables = projects
    .map((p) => ({ project: p, items: deliverables.filter((d) => d.project_id === p.id) }))
    .filter((g) => g.items.length > 0);
  // A legacy project task without a deliverable shows the placeholder until one is picked.
  const location = task.deliverable_id ?? (task.project_id ? "" : "none");

  async function save(field: string, value: string | null, patch: TaskPatch = { [field]: value }) {
    const previous = detail.task;
    const ok = await applyTask((t) => ({ ...t, ...patch }), () => updateTaskField(previous.id, field, value));
    if (!ok) {
      if (field === "title") setTitle(previous.title);
      if (field === "due_date") setDueDate(previous.due_date ?? "");
    }
    reload();
  }

  function saveLocation(value: string) {
    if (value === "none") {
      save("project_id", null, { project_id: null, deliverable_id: null, project: undefined, deliverable: undefined });
      return;
    }
    const deliverable = deliverables.find((d) => d.id === value);
    const project = projects.find((p) => p.id === deliverable?.project_id);
    save("deliverable_id", value, {
      deliverable_id: value, project_id: deliverable?.project_id ?? null, deliverable, project,
    });
  }

  function saveDueDate() {
    if (dueDate === (task.due_date ?? "")) return;
    if (isSavableDueDate(dueDate)) save("due_date", dueDate, { due_date: dueDate || null });
    else setDueDate(task.due_date ?? "");
  }

  function saveTitle() {
    if (title.trim() && title.trim() !== task.title) save("title", title);
    else setTitle(task.title);
  }

  return (
    <div className="space-y-4">
      {task.project && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ProjectDot color={task.project.color} />
          {task.project.name}
          {task.deliverable && <span>› {task.deliverable.title}</span>}
        </p>
      )}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        aria-label="Título"
        className="text-lg font-semibold"
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Estado</Label>
          <Select value={task.status} onValueChange={(v) => save("status", v)}>
            <SelectTrigger aria-label="Estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Prioridad</Label>
          <Select value={task.priority} onValueChange={(v) => save("priority", v)}>
            <SelectTrigger aria-label="Prioridad"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Asignado</Label>
          <Select value={task.assigned_to} onValueChange={(v) => save("assigned_to", v)}>
            <SelectTrigger aria-label="Asignado"><SelectValue /></SelectTrigger>
            <SelectContent>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="detail-due-date">Fecha límite</Label>
          <Input
            id="detail-due-date"
            type="date"
            ref={dueDateRef}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onBlur={saveDueDate}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Proyecto › Entregable</Label>
          <Select
            value={location}
            onValueChange={saveLocation}
          >
            <SelectTrigger aria-label="Proyecto y entregable">
              <SelectValue placeholder="Elige un entregable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">General (sin proyecto)</SelectItem>
              {projectsWithDeliverables.map(({ project, items }) => (
                <SelectGroup key={project.id}>
                  <SelectLabel>{project.name}</SelectLabel>
                  {items.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {task.project_id && !task.deliverable_id && (
            <p className="text-xs text-amber-500">Este pendiente no está ligado a ningún entregable.</p>
          )}
        </div>
      </div>
    </div>
  );
}
