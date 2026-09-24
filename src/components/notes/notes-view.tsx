"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { NoteList } from "@/components/notes/note-list";
import { NoteEditor } from "@/components/notes/note-editor";
import { createNote, deleteNote } from "@/app/(dashboard)/notes/actions";
import type { Note } from "@/types";

type NotesTab = "personal" | "shared";

export function NotesView({
  personalNotes,
  sharedNotes,
  currentUserId,
}: {
  personalNotes: Note[];
  sharedNotes: Note[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<NotesTab>("personal");
  const [selectedId, setSelectedId] = useState<string | null>(personalNotes[0]?.id ?? null);

  const notes = tab === "personal" ? personalNotes : sharedNotes;
  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  function handleTabChange(value: string) {
    const nextTab = value as NotesTab;
    const nextNotes = nextTab === "personal" ? personalNotes : sharedNotes;
    setTab(nextTab);
    setSelectedId(nextNotes[0]?.id ?? null);
  }

  async function handleCreate(formData: FormData): Promise<boolean> {
    formData.set("is_shared", String(tab === "shared"));
    const result = await createNote(formData);
    if (result?.error) {
      toast.error(result.error);
      return false;
    }
    if (result?.id) {
      setSelectedId(result.id);
      router.refresh();
    }
    return true;
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta nota?")) return;
    const result = await deleteNote(id);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    if (selectedId === id) setSelectedId(null);
    router.refresh();
  }

  return (
    <>
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="personal">Mis Notas</TabsTrigger>
          <TabsTrigger value="shared">Compartidas</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid grid-cols-[280px_1fr] gap-6 h-[calc(100vh-220px)]">
        <Card className="overflow-y-auto">
          <CardContent className="pt-4">
            <NoteList
              notes={notes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreate={handleCreate}
              onDelete={handleDelete}
              currentUserId={currentUserId}
              isShared={tab === "shared"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 h-full">
            {selectedNote ? (
              <NoteEditor note={selectedNote} currentUserId={currentUserId} />
            ) : (
              <p className="text-muted-foreground text-center py-12">
                Selecciona o crea una nota
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
