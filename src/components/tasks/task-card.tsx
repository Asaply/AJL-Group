"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectDot } from "@/components/projects/project-dot";
import { PRIORITY_COLORS, PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { checklistProgress } from "@/lib/task-update";
import { updateTaskStatus, deleteTask } from "@/app/(dashboard)/tasks/actions";
import { useOpenTask } from "@/components/tasks/use-open-task";
import type { Task, TaskStatus } from "@/types";

export function TaskCard({ task }: { task: Task }) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const openTask = useOpenTask();
  const progress = checklistProgress(task.checklist ?? []);
  const attachmentCount = task.attachments?.[0]?.count ?? 0;

  // Resync the optimistic local status when the server value changes
  // (realtime refresh or another partner's edit).
  useEffect(() => {
    setStatus(task.status);
  }, [task.status]);

  async function handleStatusChange(value: string) {
    const previous = status;
    setStatus(value as TaskStatus);
    const result = await updateTaskStatus(task.id, value);
    if (result?.error) {
      toast.error(result.error);
      setStatus(previous);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este pendiente?")) return;
    const result = await deleteTask(task.id);
    if (result?.error) toast.error(result.error);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${task.title}`}
      onClick={() => openTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openTask(task.id);
        }
      }}
      className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        />
        <div>
          <p className="font-medium">{task.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {task.assignee && <span>{task.assignee.name}</span>}
            {task.project && (
              <span className="inline-flex items-center gap-1">· <ProjectDot color={task.project.color} />{task.project.name}</span>
            )}
            {task.due_date && <span>· {formatDate(task.due_date)}</span>}
            {progress.total > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>☑ {progress.done}/{progress.total}</span>
              </>
            )}
            {attachmentCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>📎 {attachmentCount}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Badge
          variant="outline"
          style={{ borderColor: PRIORITY_COLORS[task.priority], color: PRIORITY_COLORS[task.priority] }}
        >
          {PRIORITY_LABELS[task.priority]}
        </Badge>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" type="button" aria-label="Eliminar pendiente" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
