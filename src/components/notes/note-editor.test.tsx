import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteEditor } from "./note-editor";
import { updateNote } from "@/app/(dashboard)/notes/actions";
import type { Note } from "@/types";

vi.mock("@/app/(dashboard)/notes/actions", () => ({
  updateNote: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const baseNote: Note = {
  id: "note-1",
  title: "Mi nota",
  content: "Contenido inicial",
  is_shared: false,
  author_id: "user-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const otherAuthorNote: Note = {
  ...baseNote,
  id: "note-2",
  author_id: "someone-else",
  author: { id: "someone-else", name: "Jaziel", email: "jaziel@ajl.com", avatar_url: null, created_at: "2026-01-01" },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(updateNote).mockReset();
  vi.mocked(updateNote).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NoteEditor", () => {
  it("does not call updateNote on mount", () => {
    render(<NoteEditor note={baseNote} currentUserId="user-1" />);
    expect(updateNote).not.toHaveBeenCalled();
  });

  it("calls updateNote once with the new content after typing and 1000ms elapse", async () => {
    render(<NoteEditor note={baseNote} currentUserId="user-1" />);

    const textarea = screen.getByPlaceholderText("Escribe aquí… (soporta markdown)");
    fireEvent.change(textarea, { target: { value: "Contenido nuevo" } });

    expect(updateNote).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(updateNote).toHaveBeenCalledTimes(1);
    expect(updateNote).toHaveBeenCalledWith("note-1", "Contenido nuevo", "Mi nota");
  });

  it("renders no textbox for a note authored by someone else (read-only)", () => {
    render(<NoteEditor note={otherAuthorNote} currentUserId="user-1" />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Mi nota")).toBeInTheDocument();
    expect(screen.getByText("Por Jaziel")).toBeInTheDocument();
  });

  it("omits the title from the save when it is blank, so the content still persists", async () => {
    render(<NoteEditor note={baseNote} currentUserId="user-1" />);

    const titleInput = screen.getByPlaceholderText("Título");
    fireEvent.change(titleInput, { target: { value: "   " } });

    const textarea = screen.getByPlaceholderText("Escribe aquí… (soporta markdown)");
    fireEvent.change(textarea, { target: { value: "Contenido sin título" } });

    await vi.advanceTimersByTimeAsync(1000);

    expect(updateNote).toHaveBeenCalledTimes(1);
    expect(updateNote).toHaveBeenCalledWith("note-1", "Contenido sin título", undefined);
  });

  it("retries the save for the original note after a transient save error", async () => {
    vi.mocked(updateNote).mockResolvedValueOnce({ error: "Fallo de red" });

    const { rerender } = render(<NoteEditor note={baseNote} currentUserId="user-1" />);

    const textarea = screen.getByPlaceholderText("Escribe aquí… (soporta markdown)");
    fireEvent.change(textarea, { target: { value: "Contenido con error" } });

    await vi.advanceTimersByTimeAsync(1000);

    expect(updateNote).toHaveBeenCalledTimes(1);
    expect(updateNote).toHaveBeenNthCalledWith(1, "note-1", "Contenido con error", "Mi nota");

    // Switching to a different note must flush the still-dirty (failed) save
    // for the ORIGINAL note, not silently drop it.
    const anotherNote: Note = { ...baseNote, id: "note-9", title: "Otra nota", content: "Otro contenido" };
    rerender(<NoteEditor note={anotherNote} currentUserId="user-1" />);

    expect(updateNote).toHaveBeenCalledTimes(2);
    expect(updateNote).toHaveBeenNthCalledWith(2, "note-1", "Contenido con error", "Mi nota");
  });
});
