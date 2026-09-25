"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateClientNotes } from "@/app/(dashboard)/clients/actions";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function ClientNotes({ clientId, notes }: { clientId: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const [mode, setMode] = useState<"edit" | "preview">(notes ? "preview" : "edit");
  const [state, setState] = useState<SaveState>("idle");
  const valueRef = useRef(notes ?? "");
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirtyRef.current) {
      setValue(notes ?? "");
      valueRef.current = notes ?? "";
    }
  }, [notes]);

  useEffect(() => {
    const id = clientId;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) void updateClientNotes(id, valueRef.current);
    };
  }, [clientId]);

  async function persist(next: string) {
    setState("saving");
    const result = await updateClientNotes(clientId, next);
    if (result?.error) {
      toast.error(result.error);
      setState("error");
      return;
    }
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
        <h3 className="font-semibold">Notas</h3>
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
          placeholder="Notas sobre el cliente… (soporta markdown)"
          className="min-h-[140px]"
          aria-label="Notas del cliente"
        />
      ) : value.trim() ? (
        <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{value}</ReactMarkdown></div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin notas</p>
      )}
    </div>
  );
}
