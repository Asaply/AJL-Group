"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { checklistProgress } from "@/lib/task-update";
import {
  addChecklistItem, deleteChecklistItem, moveChecklistItem, updateChecklistItem,
} from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskChecklistItem, TaskDetail } from "@/types";

export function TaskChecklist({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const taskId = detail.task.id;
  const items = detail.checklist;
  const progress = checklistProgress(items);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function run(action: () => Promise<{ error: string } | undefined>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result?.error) {
      toast.error(result.error);
      return false;
    }
    reload();
    return true;
  }

  async function handleAdd(formData: FormData) {
    const text = String(formData.get("text") ?? "");
    if (await run(() => addChecklistItem(taskId, text))) formRef.current?.reset();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Checklist</h3>
        {progress.total > 0 && <span className="text-xs text-muted-foreground">{progress.done}/{progress.total}</span>}
      </div>
      {progress.total > 0 && <Progress value={(progress.done / progress.total) * 100} />}
      <ul className="space-y-1">
        {items.map((item, i) => (
          <ChecklistRow
            key={item.id}
            item={item}
            canMoveUp={i > 0}
            canMoveDown={i < items.length - 1}
            busy={busy}
            run={run}
          />
        ))}
      </ul>
      <form ref={formRef} action={handleAdd} className="flex gap-2">
        <Input name="text" placeholder="Agregar paso" aria-label="Nuevo paso" className="h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={busy}><Plus className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function ChecklistRow({
  item, canMoveUp, canMoveDown, busy, run,
}: {
  item: TaskChecklistItem;
  canMoveUp: boolean;
  canMoveDown: boolean;
  busy: boolean;
  run: (action: () => Promise<{ error: string } | undefined>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  async function saveText() {
    setEditing(false);
    if (text.trim() === item.text) return;
    if (!(await run(() => updateChecklistItem(item.id, item.task_id, { text })))) setText(item.text);
  }

  return (
    <li className="flex items-center gap-2 text-sm group">
      <input
        type="checkbox"
        checked={item.done}
        aria-label={item.text}
        disabled={busy}
        onChange={(e) => run(() => updateChecklistItem(item.id, item.task_id, { done: e.target.checked }))}
        className="h-4 w-4"
      />
      {editing ? (
        <Input
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onBlur={saveText}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setText(item.text); setEditing(false); }
          }}
          className="h-7"
          aria-label="Editar paso"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`flex-1 text-left ${item.done ? "line-through text-muted-foreground" : ""}`}
        >
          {item.text}
        </button>
      )}
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Subir paso" disabled={!canMoveUp || busy}
        onClick={() => run(() => moveChecklistItem(item.id, item.task_id, "up"))}>
        <ArrowUp className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Bajar paso" disabled={!canMoveDown || busy}
        onClick={() => run(() => moveChecklistItem(item.id, item.task_id, "down"))}>
        <ArrowDown className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Eliminar paso" disabled={busy}
        onClick={() => run(() => deleteChecklistItem(item.id, item.task_id))}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </li>
  );
}
