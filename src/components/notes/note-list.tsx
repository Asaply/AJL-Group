"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { canEditNote } from "@/lib/notes";
import type { Note } from "@/types";

export function NoteList({
  notes,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  currentUserId,
  isShared,
}: {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (formData: FormData) => Promise<boolean>;
  onDelete: (id: string) => void;
  currentUserId: string;
  isShared: boolean;
}) {
  const [creating, setCreating] = useState(false);

  async function handleCreate(formData: FormData) {
    const success = await onCreate(formData);
    if (success) setCreating(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{isShared ? "Compartidas" : "Mis Notas"}</h3>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => setCreating(!creating)}
          aria-label="Nueva nota"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {creating && (
        <form action={handleCreate}>
          <Input
            name="title"
            placeholder="Título de la nota"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") setCreating(false);
            }}
          />
        </form>
      )}
      <ul className="space-y-1">
        {notes.map((note) => {
          const editable = canEditNote(note, currentUserId);
          return (
            <li
              key={note.id}
              className={cn(
                "flex items-center justify-between rounded-lg text-sm",
                selectedId === note.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(note.id)}
                className="flex-1 truncate text-left px-3 py-2"
              >
                <p className="font-medium truncate">{note.title}</p>
                {note.author && <p className="text-xs opacity-70">{note.author.name}</p>}
              </button>
              {editable && (
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="h-6 w-6 shrink-0 mr-1"
                  onClick={() => onDelete(note.id)}
                  aria-label="Eliminar nota"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </li>
          );
        })}
        {notes.length === 0 && !creating && (
          <li className="text-xs text-muted-foreground px-2 py-4 text-center">Sin notas</li>
        )}
      </ul>
    </div>
  );
}
