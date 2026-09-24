import { describe, expect, it } from "vitest";
import { describeEvent, formatEventTime, mergeTimeline } from "./task-events";
import type { Deliverable, Project, TaskComment, TaskEvent, User } from "@/types";

const users = [
  { id: "u1", name: "Leo" },
  { id: "u2", name: "Alan" },
] as User[];
const projects = [{ id: "p1", name: "kairos" }] as Project[];
const deliverables = [{ id: "d1", title: "Login" }] as Deliverable[];
const lookups = { users, projects, deliverables };

function ev(field: TaskEvent["field"], old_value: string | null, new_value: string | null, actor_id: string | null = "u2"): TaskEvent {
  return { id: `e-${field}`, task_id: "t1", actor_id, field, old_value, new_value, created_at: "2026-09-24T10:00:00Z" };
}

describe("describeEvent", () => {
  it("describes creation and description edits", () => {
    expect(describeEvent(ev("created", null, null), lookups)).toBe("Alan creó el pendiente");
    expect(describeEvent(ev("description", null, null, "u1"), lookups)).toBe("Leo editó la descripción");
  });

  it("describes a title change without values", () => {
    expect(describeEvent(ev("title", "A", "B"), lookups)).toBe("Alan cambió el título");
  });

  it("uses Spanish labels for status and priority", () => {
    expect(describeEvent(ev("status", "pending", "in_progress"), lookups)).toBe("Alan cambió el estado Pendiente → En Progreso");
    expect(describeEvent(ev("priority", "medium", "urgent"), lookups)).toBe("Alan cambió la prioridad Media → Urgente");
  });

  it("formats due dates and blanks", () => {
    expect(describeEvent(ev("due_date", "2026-09-27", "2026-09-30"), lookups)).toBe("Alan cambió la fecha límite 27/9/2026 → 30/9/2026");
    expect(describeEvent(ev("due_date", null, "2026-09-30"), lookups)).toBe("Alan cambió la fecha límite sin fecha → 30/9/2026");
  });

  it("resolves ids to names, 'ninguno' for null and '(eliminado)' for unknown", () => {
    expect(describeEvent(ev("assigned_to", "u1", "u2"), lookups)).toBe("Alan cambió el asignado Leo → Alan");
    expect(describeEvent(ev("project_id", null, "p1"), lookups)).toBe("Alan cambió el proyecto ninguno → kairos");
    expect(describeEvent(ev("deliverable_id", "d1", "gone"), lookups)).toBe("Alan cambió el entregable Login → (eliminado)");
  });

  it("uses 'Alguien' when the actor is null or unknown", () => {
    expect(describeEvent(ev("created", null, null, null), lookups)).toBe("Alguien creó el pendiente");
    expect(describeEvent(ev("created", null, null, "zzz"), lookups)).toBe("Alguien creó el pendiente");
  });
});

describe("mergeTimeline", () => {
  const comment = (id: string, created_at: string): TaskComment => ({
    id, task_id: "t1", author_id: "u1", body: "x", created_at, updated_at: created_at,
  });
  const event = (id: string, created_at: string): TaskEvent => ({
    id, task_id: "t1", actor_id: "u1", field: "status", old_value: null, new_value: null, created_at,
  });

  it("orders comments and events chronologically, oldest first", () => {
    const result = mergeTimeline(
      [comment("c2", "2026-09-24T12:00:00Z"), comment("c1", "2026-09-24T09:00:00Z")],
      [event("e1", "2026-09-24T10:00:00Z")]
    );
    expect(result.map((r) => r.item.id)).toEqual(["c1", "e1", "c2"]);
  });

  it("puts events before comments on identical timestamps", () => {
    const t = "2026-09-24T10:00:00Z";
    expect(mergeTimeline([comment("c", t)], [event("e", t)]).map((r) => r.kind)).toEqual(["event", "comment"]);
  });
});

describe("formatEventTime", () => {
  it("renders day/month and time in Mexico City", () => {
    const text = formatEventTime("2026-09-24T16:15:00Z");
    expect(text).toContain("24/9");
    expect(text).toContain("10:15");
  });
});
