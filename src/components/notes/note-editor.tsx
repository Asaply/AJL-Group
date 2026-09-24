"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateNote } from "@/app/(dashboard)/notes/actions";
import { canEditNote, normalizeNoteTitle } from "@/lib/notes";
import type { Note } from "@/types";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 1000;

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Cambios sin guardar",
  saving: "Guardando…",
  saved: "Guardado",
  error: "Error al guardar",
};

export function NoteEditor({ note, currentUserId }: { note: Note; currentUserId: string }) {
  const router = useRouter();
  const editable = canEditNote(note, currentUserId);

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Refs mirror the latest state so the debounced/flushed save always reads
  // the most recent values, even from a timer or an effect cleanup closure.
  const dirtyRef = useRef(false);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const noteIdRef = useRef(note.id);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routerRef = useRef(router);
  const mountedRef = useRef(true);

  titleRef.current = title;
  contentRef.current = content;
  routerRef.current = router;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;

    const id = noteIdRef.current;
    const savedTitle = titleRef.current;
    const savedContent = contentRef.current;
    // A blank title must never block the content save: omit it from the
    // update entirely (server-side validation is unchanged) rather than
    // sending an empty string that `updateNote` would reject wholesale.
    const normalizedTitle = normalizeNoteTitle(savedTitle);

    if (mountedRef.current) setStatus("saving");
    const result = await updateNote(id, savedContent, normalizedTitle ?? undefined);
    if (result?.error) {
      toast.error(result.error);
      // Restore the dirty flag so the next edit, debounce, or note
      // switch retries this save instead of silently dropping it.
      dirtyRef.current = true;
      if (mountedRef.current) setStatus("error");
      return;
    }
    if (mountedRef.current) setStatus("saved");
    routerRef.current.refresh();
  }, []);

  // Sync local state whenever the note being displayed changes, flushing
  // any pending edits on the PREVIOUS note first so nothing is lost.
  useEffect(() => {
    noteIdRef.current = note.id;
    titleRef.current = note.title;
    contentRef.current = note.content;
    dirtyRef.current = false;
    setTitle(note.title);
    setContent(note.content);
    setMode("edit");
    setStatus("idle");

    return () => {
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, SAVE_DELAY_MS);
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    dirtyRef.current = true;
    setStatus("dirty");
    scheduleSave();
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    dirtyRef.current = true;
    setStatus("dirty");
    scheduleSave();
  }

  const titleBlank = normalizeNoteTitle(title) === null;

  if (!editable) {
    return (
      <div className="space-y-4 h-full overflow-y-auto">
        <h2 className="text-xl font-bold">{note.title}</h2>
        {note.author && <p className="text-xs text-muted-foreground">Por {note.author.name}</p>}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{note.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <Input
        value={title}
        onChange={handleTitleChange}
        className="text-xl font-bold border-none px-0 focus-visible:ring-0"
        placeholder="Título"
      />
      {titleBlank && (
        <p className="text-xs text-destructive -mt-3">El título no puede estar vacío</p>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={mode === "edit" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMode("edit")}
        >
          Editar
        </Button>
        <Button
          type="button"
          variant={mode === "preview" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMode("preview")}
        >
          Vista previa
        </Button>
      </div>
      {mode === "edit" ? (
        <Textarea
          value={content}
          onChange={handleContentChange}
          className="flex-1 resize-none border-none px-0 focus-visible:ring-0 min-h-[400px]"
          placeholder="Escribe aquí… (soporta markdown)"
        />
      ) : (
        <div className={cn("flex-1 min-h-[400px] prose prose-sm dark:prose-invert max-w-none overflow-y-auto")}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
      <p className="text-xs text-muted-foreground h-4">{STATUS_LABEL[status]}</p>
    </div>
  );
}
