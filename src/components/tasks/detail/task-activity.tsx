"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { describeEvent, formatEventTime, mergeTimeline } from "@/lib/task-events";
import { addComment, deleteComment, updateComment } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskComment, TaskDetail } from "@/types";

const EDIT_GRACE_MS = 1000;

export function TaskActivity({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const taskId = detail.task.id;
  const timeline = mergeTimeline(detail.comments, detail.events);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function send() {
    if (sendingRef.current) return;
    if (!body.trim()) return;
    sendingRef.current = true;
    setSending(true);
    const result = await addComment(taskId, body);
    sendingRef.current = false;
    setSending(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setBody("");
    reload();
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Actividad</h3>
      <ul className="space-y-3">
        {timeline.map((entry) =>
          entry.kind === "event" ? (
            <li key={`e-${entry.item.id}`} className="text-xs text-muted-foreground">
              <span>{describeEvent(entry.item, detail)}</span> · {formatEventTime(entry.item.created_at)}
            </li>
          ) : (
            <CommentItem
              key={`c-${entry.item.id}`}
              comment={entry.item}
              mine={entry.item.author_id === detail.currentUserId}
              reload={reload}
            />
          )
        )}
      </ul>
      <form
        ref={formRef}
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="space-y-2"
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
          placeholder="Escribe un comentario… (markdown)"
          aria-label="Nuevo comentario"
          className="min-h-[70px]"
          disabled={sending}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={sending || !body.trim()}>Enviar</Button>
        </div>
      </form>
    </div>
  );
}

function CommentItem({ comment, mine, reload }: { comment: TaskComment; mine: boolean; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const edited = Date.parse(comment.updated_at) - Date.parse(comment.created_at) > EDIT_GRACE_MS;

  useEffect(() => {
    if (!editing) setDraft(comment.body);
  }, [comment.body, editing]);

  async function save() {
    const result = await updateComment(comment.id, comment.task_id, draft);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setEditing(false);
    reload();
  }

  async function remove() {
    if (!confirm("¿Eliminar este comentario?")) return;
    const result = await deleteComment(comment.id, comment.task_id);
    if (result?.error) toast.error(result.error);
    else reload();
  }

  return (
    <li className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{comment.author?.name ?? "—"}</span> · {formatEventTime(comment.created_at)}
          {edited && <span> · </span>}
          {edited && <span>(editado)</span>}
        </span>
        {mine && !editing && (
          <span className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Editar comentario" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Eliminar comentario" onClick={remove}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Texto del comentario" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setDraft(comment.body); setEditing(false); }}>Cancelar</Button>
            <Button size="sm" onClick={save} disabled={!draft.trim()}>Guardar</Button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{comment.body}</ReactMarkdown>
        </div>
      )}
    </li>
  );
}
