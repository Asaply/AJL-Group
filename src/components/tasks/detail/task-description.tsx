"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateTaskField } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskDetail } from "@/types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function TaskDescription({ detail }: { detail: TaskDetail; reload: () => void }) {
  const { task } = detail;
  const [value, setValue] = useState(task.description ?? "");
  const [mode, setMode] = useState<"edit" | "preview">(task.description ? "preview" : "edit");
  const [state, setState] = useState<SaveState>("idle");
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Take server updates (realtime) only while the user has nothing pending.
  useEffect(() => {
    if (!dirtyRef.current) setValue(task.description ?? "");
  }, [task.description]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function persist(next: string) {
    setState("saving");
    const result = await updateTaskField(task.id, "description", next);
    if (result?.error) {
      toast.error(result.error);
      setState("error");
      return;
    }
    dirtyRef.current = false;
    setState("saved");
  }

  function handleChange(next: string) {
    setValue(next);
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
