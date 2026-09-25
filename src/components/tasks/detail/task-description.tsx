"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateTaskField } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskDetail } from "@/types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

// `reload` is intentionally unused here: a successful save updates the `tasks`
// row, and the sheet's own realtime subscription already refetches on that
// change, so this section doesn't need to trigger it itself.
export function TaskDescription({ detail }: { detail: TaskDetail; reload: () => void }) {
  const { task } = detail;
  const [value, setValue] = useState(task.description ?? "");
  const [mode, setMode] = useState<"edit" | "preview">(task.description ? "preview" : "edit");
  const [state, setState] = useState<SaveState>("idle");
  const dirtyRef = useRef(false);
  const valueRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Take server updates (realtime) only while the user has nothing pending.
  useEffect(() => {
    if (!dirtyRef.current) setValue(task.description ?? "");
  }, [task.description]);

  // Flush a pending debounced edit instead of dropping it: the Sheet can
  // close, or the user can switch tasks, before the 1s timer fires — both
  // unmount this component. `taskId` is captured here so the flush always
  // targets the task this edit was made on, not whatever is open later.
  useEffect(() => {
    const taskId = task.id;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) {
        void updateTaskField(taskId, "description", valueRef.current);
      }
    };
  }, [task.id]);

  async function persist(next: string) {
    setState("saving");
    const result = await updateTaskField(task.id, "description", next);
    if (result?.error) {
      toast.error(result.error);
      setState("error");
      return;
    }
    // Only clear the dirty flag if nothing was typed while this save was in
    // flight; otherwise a realtime echo of `next` would overwrite newer text.
    if (valueRef.current === next) {
      dirtyRef.current = false;
      setState("saved");
    }
  }

  function handleChange(next: string) {
    setValue(next);
    valueRef.current = next;
    dirtyRef.current = true;
    setState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(next), 1000);
  }

  const status = { idle: "", dirty: "Cambios sin guardar", saving: "Guardando…", saved: "Guardado", error: "Error al guardar" }[state];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Descripción</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{status}</span>
          <Button size="sm" variant={mode === "edit" ? "secondary" : "ghost"} onClick={() => setMode("edit")}>Editar</Button>
          <Button size="sm" variant={mode === "preview" ? "secondary" : "ghost"} onClick={() => setMode("preview")}>Vista previa</Button>
        </div>
      </div>
      {mode === "edit" ? (
        <Textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Describe el pendiente… (soporta markdown)"
          className="min-h-[120px]"
          aria-label="Descripción"
        />
      ) : value.trim() ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{value}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin descripción</p>
      )}
    </div>
  );
}
