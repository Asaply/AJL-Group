import { describe, expect, it } from "vitest";
import { canEditNote, normalizeNoteTitle } from "./notes";

describe("canEditNote", () => {
  it("returns true when the note's author_id matches the user id", () => {
    expect(canEditNote({ author_id: "u1" }, "u1")).toBe(true);
  });

  it("returns false when the note's author_id does not match the user id", () => {
    expect(canEditNote({ author_id: "u1" }, "u2")).toBe(false);
  });
});

describe("normalizeNoteTitle", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeNoteTitle("  Hola  ")).toBe("Hola");
  });

  it("returns null for an empty string", () => {
    expect(normalizeNoteTitle("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(normalizeNoteTitle("   ")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(normalizeNoteTitle(null)).toBeNull();
    expect(normalizeNoteTitle(undefined)).toBeNull();
    expect(normalizeNoteTitle(42)).toBeNull();
  });

  it("returns the trimmed title unchanged when it has no surrounding whitespace", () => {
    expect(normalizeNoteTitle("Título")).toBe("Título");
  });
});
