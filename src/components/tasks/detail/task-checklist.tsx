"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { checklistProgress } from "@/lib/task-update";
import { moveItem } from "@/lib/deliverables";
import { useOptimisticState } from "@/lib/use-optimistic-state";
import {
  addChecklistItem, deleteChecklistItem, moveChecklistItem, updateChecklistItem,
} from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskChecklistItem, TaskDetail } from "@/types";

type Items = TaskChecklistItem[];
type Apply = (update: (items: Items) => Items, action: () => Promise<{ error: string } | undefined>) => Promise<void>;

const TEMP_PREFIX = "tmp-";

export function TaskChecklist({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const taskId = detail.task.id;
  const [items, applyOptimistic] = useOptimisticState(detail.checklist);
  const progress = checklistProgress(items);
  const formRef = useRef<HTMLFormElement>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  // Every change shows up at once. Server calls run one after another, since
  // reorders read the stored positions and would race if sent in parallel.
  const apply: Apply = async (update, action) => {
    const queued = queueRef.current.then(action);
    queueRef.current = queued.catch(() => undefined);
    await applyOptimistic(update, () => queued);
    reload();
  };

  function handleAdd(formData: FormData) {
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return;
    formRef.current?.reset();
    const temp: TaskChecklistItem = {
      id: `${TEMP_PREFIX}${Date.now()}`, task_id: taskId, text, done: false,
      position: items.length, created_at: new Date().toISOString(),
    };
    apply((list) => [...list, temp], () => addChecklistItem(taskId, text));
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
            apply={apply}
          />
        ))}
      </ul>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd(new FormData(e.currentTarget));
        }}
        className="flex gap-2"
      >
        <Input name="text" placeholder="Agregar paso" aria-label="Nuevo paso" className="h-8" />
        <Button type="submit" size="sm" variant="outline"><Plus className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function reorder(items: Items, id: string, direction: "up" | "down"): Items {
  const byId = new Map(items.map((i) => [i.id, i]));
  return moveItem(items.map((i) => i.id), id, direction).map((itemId) => byId.get(itemId)!);
}

function ChecklistRow({
  item, canMoveUp, canMoveDown, apply,
}: {
  item: TaskChecklistItem;
  canMoveUp: boolean;
  canMoveDown: boolean;
  apply: Apply;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  // A just-added step has no server id until the reload lands.
  const saving = item.id.startsWith(TEMP_PREFIX);

  function saveText() {
    setEditing(false);
    const trimmed = text.trim();
    if (!trimmed || trimmed === item.text) {
      setText(item.text);
      return;
    }
    apply(
      (list) => list.map((i) => (i.id === item.id ? { ...i, text: trimmed } : i)),
      () => updateChecklistItem(item.id, item.task_id, { text: trimmed })
    );
  }

  return (
    <li className={`flex items-center gap-2 text-sm group ${saving ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        checked={item.done}
        aria-label={item.text}
        disabled={saving}
        onChange={(e) => {
          const done = e.target.checked;
          apply(
            (list) => list.map((i) => (i.id === item.id ? { ...i, done } : i)),
            () => updateChecklistItem(item.id, item.task_id, { done })
          );
        }}
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
          disabled={saving}
          onClick={() => { setText(item.text); setEditing(true); }}
          className={`flex-1 text-left ${item.done ? "line-through text-muted-foreground" : ""}`}
        >
          {item.text}
        </button>
      )}
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Subir paso" disabled={!canMoveUp || saving}
        onClick={() => apply((list) => reorder(list, item.id, "up"), () => moveChecklistItem(item.id, item.task_id, "up"))}>
        <ArrowUp className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Bajar paso" disabled={!canMoveDown || saving}
        onClick={() => apply((list) => reorder(list, item.id, "down"), () => moveChecklistItem(item.id, item.task_id, "down"))}>
        <ArrowDown className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Eliminar paso" disabled={saving}
        onClick={() => apply((list) => list.filter((i) => i.id !== item.id), () => deleteChecklistItem(item.id, item.task_id))}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </li>
  );
}
