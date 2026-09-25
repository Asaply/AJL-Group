"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectDot } from "@/components/projects/project-dot";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { isValidDateKey } from "@/lib/project-form";
import { updateTaskField } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskDetail } from "@/types";

/** Empty (clears the date) or a complete, real YYYY-MM-DD from 1900 on. */
function isSavableDueDate(value: string): boolean {
  return value === "" || (isValidDateKey(value) && Number(value.slice(0, 4)) >= 1900);
}

export function TaskFields({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const { task, users, projects, deliverables } = detail;
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

  const projectDeliverables = deliverables.filter((d) => d.project_id === task.project_id);

  async function save(field: string, value: string | null) {
    const result = await updateTaskField(task.id, field, value);
    if (result?.error) {
      toast.error(result.error);
      if (field === "title") setTitle(task.title);
      if (field === "due_date") setDueDate(task.due_date ?? "");
      return;
    }
    reload();
  }

  function saveDueDate() {
    if (dueDate === (task.due_date ?? "")) return;
    if (isSavableDueDate(dueDate)) save("due_date", dueDate);
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
        <div className="space-y-1">
          <Label>Proyecto</Label>
          <Select value={task.project_id ?? "none"} onValueChange={(v) => save("project_id", v)}>
            <SelectTrigger aria-label="Proyecto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">General (sin proyecto)</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {task.project_id && (
          <div className="space-y-1">
            <Label>Entregable</Label>
            <Select value={task.deliverable_id ?? "none"} onValueChange={(v) => save("deliverable_id", v)}>
              <SelectTrigger aria-label="Entregable"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin entregable</SelectItem>
                {projectDeliverables.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
