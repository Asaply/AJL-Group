# Task Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking any task opens a side panel where partners edit every field, write a markdown description, keep a checklist, attach links and files (≤25 MB), comment, and see an automatic change history.

**Architecture:** Migration `003` adds five task-child tables, a `SECURITY DEFINER` trigger that writes `task_events` on every task insert/update, and a private Storage bucket. A single client `<TaskDetailSheet />` mounted in the dashboard layout reads `?task=<id>`, loads everything through one server action (`getTaskDetail`) and refetches on a per-task realtime channel. Validation, event wording, timeline ordering and file-name sanitizing are pure functions with Vitest tests.

**Tech Stack:** Next.js 14.2.35 App Router, React 18, TypeScript strict, Tailwind v3, shadcn/ui (Sheet, Select, Button, Input, Textarea, Progress), sonner, react-markdown (no rehype-raw), Supabase (`@supabase/ssr`, Postgres RLS + triggers, Storage, Realtime), Vitest 1.6.1 + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-24-task-details-design.md`

## Global Constraints

- Next.js 14 (14.2.35), TypeScript strict, Node >= 20.19.0
- All DB/Storage access via Supabase clients (`@/lib/supabase/server` in actions, `@/lib/supabase/client` in the browser)
- RLS: every policy includes `public.is_partner()`; comments editable/deletable only by `author_id = auth.uid()`; attachment rows deletable only by `uploaded_by = auth.uid()`; `task_events` has no write policies (trigger only)
- Server actions: validation errors return specific Spanish `{ error }`; DB errors go through `actionError(context, error, SAVE_ERROR | DELETE_ERROR | LOAD_ERROR)` from `@/lib/action-error`; mutations filter by `id` AND `task_id`; all revalidate `revalidatePath("/", "layout")`
- Client callers surface `{ error }` via `toast.error` from `"sonner"`
- Spanish UI labels with correct orthography
- Dates via `formatDate` (`@/lib/utils`); date-times via `formatEventTime` (Task 1) in `APP_TIME_ZONE`
- Markdown rendered only with `react-markdown` defaults (no raw HTML) inside `prose prose-sm dark:prose-invert max-w-none`
- Files: any type, max `25 * 1024 * 1024` bytes; bucket `task-files` private; downloads via signed URL valid 60 s
- Verification for every task: `npm test`, `npx tsc --noEmit`, `npm run lint` — all pass, pristine. A dev server is running on port 3100 using `.next`: do NOT run `npm run build` (it corrupts the running dev server); the controller runs the build at the end.
- Do not commit `supabase/config.toml` or `supabase/.gitignore`. Stage only your files.
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

## File Structure

```
supabase/migrations/003_task_details.sql                 NEW  tables, trigger, RLS, bucket, realtime
src/types/index.ts                                       MOD  child-table types, TaskDetail, Task.updated_at + counts
src/lib/task-update.ts (+ .test.ts)                      NEW  parseTaskField, checklistProgress
src/lib/attachments.ts (+ .test.ts)                      NEW  size limit, sanitize, path, formatFileSize, isImage
src/lib/task-events.ts (+ .test.ts)                      NEW  describeEvent, mergeTimeline, formatEventTime
src/lib/realtime.ts                                      MOD  TASK_DETAIL_TABLES
src/app/(dashboard)/tasks/detail-actions.ts              NEW  all detail server actions
src/app/(dashboard)/tasks/actions.ts                     MOD  deleteTask cleans Storage
src/components/tasks/use-open-task.ts                    NEW  useOpenTask() hook
src/components/tasks/open-task-button.tsx                NEW  text button that opens a task
src/components/tasks/task-card.tsx (+ .test.tsx)         MOD  clickable, badges
src/components/tasks/detail/task-detail-sheet.tsx        NEW  Sheet shell, loading, realtime
src/components/tasks/detail/task-fields.tsx              NEW  header + editable fields
src/components/tasks/detail/task-description.tsx         NEW  markdown editor with autosave
src/components/tasks/detail/task-checklist.tsx (+ .test.tsx) NEW
src/components/tasks/detail/task-links.tsx               NEW
src/components/tasks/detail/task-attachments.tsx         NEW
src/components/tasks/detail/task-activity.tsx (+ .test.tsx) NEW
src/app/(dashboard)/layout.tsx                           MOD  mount sheet
src/app/(dashboard)/tasks/page.tsx                       MOD  select checklist/attachment counts
src/components/dashboard/urgent-tasks.tsx                MOD  OpenTaskButton
src/app/(dashboard)/projects/[id]/page.tsx               MOD  OpenTaskButton in task list
src/components/projects/deliverable-row.tsx              MOD  OpenTaskButton in linked list
README.md                                                MOD  run migration 003
```

**Plan decision (calendar):** calendar chips live inside the day `<button>`; nesting another button is invalid HTML. Tasks open from the calendar through the day dialog's `TaskCard`s (which become clickable in Task 4). Chips themselves stay non-interactive.

---

### Task 1: Types and pure logic

**Files:**
- Create: `src/lib/task-update.ts`, `src/lib/task-update.test.ts`, `src/lib/attachments.ts`, `src/lib/attachments.test.ts`, `src/lib/task-events.ts`, `src/lib/task-events.test.ts`
- Modify: `src/types/index.ts`, `src/lib/realtime.ts`

**Interfaces:**
- Consumes: `isValidDateKey(value: string): boolean` from `@/lib/project-form`; `formatDate` from `@/lib/utils`; `PRIORITY_LABELS`, `TASK_STATUS_LABELS`, `APP_TIME_ZONE` from `@/lib/constants`; types `User`, `Project`, `Deliverable`
- Produces:
  - Types `TaskChecklistItem`, `TaskLink`, `TaskComment`, `TaskEventField`, `TaskEvent`, `TaskAttachment`, `TaskDetail`; `Task` gains `updated_at: string`, `checklist?: { done: boolean }[]`, `attachments?: { count: number }[]`
  - `EDITABLE_TASK_FIELDS`, `type EditableTaskField`, `parseTaskField(field: string, value: unknown): ParseFieldResult`, `checklistProgress(items: { done: boolean }[]): { done: number; total: number }`
  - `MAX_ATTACHMENT_BYTES`, `validateUpload(file: { size: number }): string | null`, `sanitizeFileName(name: string): string`, `storagePath(taskId: string, fileName: string, id: string): string`, `formatFileSize(bytes: number): string`, `isImage(mime: string | null): boolean`
  - `describeEvent(event: TaskEvent, lookups: EventLookups): string`, `type TimelineItem`, `mergeTimeline(comments: TaskComment[], events: TaskEvent[]): TimelineItem[]`, `formatEventTime(iso: string): string`
  - `TASK_DETAIL_TABLES = ["task_checklist_items", "task_links", "task_comments", "task_events", "task_attachments"] as const`

- [ ] **Step 1: Add types**

In `src/types/index.ts`:
- In `Task`, add after `created_at`: `updated_at: string;` and at the end: `checklist?: { done: boolean }[];` and `attachments?: { count: number }[];`
- Append:
```ts
export interface TaskChecklistItem {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface TaskLink {
  id: string;
  task_id: string;
  label: string;
  url: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author?: User | null;
}

export type TaskEventField =
  | "created"
  | "title"
  | "status"
  | "priority"
  | "due_date"
  | "assigned_to"
  | "project_id"
  | "deliverable_id"
  | "description";

export interface TaskEvent {
  id: string;
  task_id: string;
  actor_id: string | null;
  field: TaskEventField;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  actor?: User | null;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
  uploader?: User | null;
}

export interface TaskDetail {
  task: Task & { deliverable?: Deliverable | null };
  checklist: TaskChecklistItem[];
  links: TaskLink[];
  comments: TaskComment[];
  events: TaskEvent[];
  attachments: TaskAttachment[];
  users: User[];
  projects: Project[];
  deliverables: Deliverable[];
  currentUserId: string;
}
```
Run `npx tsc --noEmit`. Fix any test fixture typed as `Task` by adding `updated_at: "2026-09-24T00:00:00Z"` (do not make the field optional).

In `src/lib/realtime.ts` add below `REALTIME_TABLES`:
```ts
/** Child tables of a task; the detail panel subscribes to these filtered by task_id. */
export const TASK_DETAIL_TABLES = [
  "task_checklist_items",
  "task_links",
  "task_comments",
  "task_events",
  "task_attachments",
] as const;
```

- [ ] **Step 2: Failing tests for task-update**

Create `src/lib/task-update.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { checklistProgress, parseTaskField } from "./task-update";

describe("parseTaskField", () => {
  it("rejects fields that are not editable", () => {
    expect(parseTaskField("created_by", "x")).toEqual({ ok: false, error: "Campo no editable" });
    expect(parseTaskField("id", "x")).toEqual({ ok: false, error: "Campo no editable" });
  });

  it("trims and requires the title", () => {
    expect(parseTaskField("title", "  Login  ")).toEqual({ ok: true, field: "title", value: "Login" });
    expect(parseTaskField("title", "   ")).toEqual({ ok: false, error: "El título es obligatorio" });
  });

  it("keeps description markdown as-is and maps blank to null", () => {
    expect(parseTaskField("description", "- a\n- b\n")).toEqual({ ok: true, field: "description", value: "- a\n- b\n" });
    expect(parseTaskField("description", "  ")).toEqual({ ok: true, field: "description", value: null });
  });

  it("validates status and priority against their enums", () => {
    expect(parseTaskField("status", "in_progress")).toEqual({ ok: true, field: "status", value: "in_progress" });
    expect(parseTaskField("status", "done")).toEqual({ ok: false, error: "Estado inválido" });
    expect(parseTaskField("priority", "urgent")).toEqual({ ok: true, field: "priority", value: "urgent" });
    expect(parseTaskField("priority", "max")).toEqual({ ok: false, error: "Prioridad inválida" });
  });

  it("accepts a real date or blank for due_date", () => {
    expect(parseTaskField("due_date", "2026-09-30")).toEqual({ ok: true, field: "due_date", value: "2026-09-30" });
    expect(parseTaskField("due_date", "")).toEqual({ ok: true, field: "due_date", value: null });
    expect(parseTaskField("due_date", "2026-02-30")).toEqual({ ok: false, error: "La fecha límite no es válida" });
  });

  it("requires assigned_to", () => {
    expect(parseTaskField("assigned_to", "u1")).toEqual({ ok: true, field: "assigned_to", value: "u1" });
    expect(parseTaskField("assigned_to", "")).toEqual({ ok: false, error: "Debes asignar el pendiente a un socio" });
  });

  it("maps blank or 'none' project/deliverable to null", () => {
    expect(parseTaskField("project_id", "p1")).toEqual({ ok: true, field: "project_id", value: "p1" });
    expect(parseTaskField("project_id", "none")).toEqual({ ok: true, field: "project_id", value: null });
    expect(parseTaskField("deliverable_id", "")).toEqual({ ok: true, field: "deliverable_id", value: null });
  });

  it("rejects non-string values", () => {
    expect(parseTaskField("title", 42)).toEqual({ ok: false, error: "Valor inválido" });
  });
});

describe("checklistProgress", () => {
  it("counts done items", () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0 });
    expect(checklistProgress([{ done: true }, { done: false }, { done: true }])).toEqual({ done: 2, total: 3 });
  });
});
```
Run: `npx vitest run src/lib/task-update.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement task-update**

Create `src/lib/task-update.ts`:
```ts
import { isValidDateKey } from "@/lib/project-form";

export const EDITABLE_TASK_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "due_date",
  "assigned_to",
  "project_id",
  "deliverable_id",
] as const;

export type EditableTaskField = (typeof EDITABLE_TASK_FIELDS)[number];

export type ParseFieldResult =
  | { ok: true; field: EditableTaskField; value: string | null }
  | { ok: false; error: string };

const STATUSES = ["pending", "in_progress", "completed"];
const PRIORITIES = ["urgent", "high", "medium", "low"];

/** Validates a single-field edit coming from the task detail panel. */
export function parseTaskField(field: string, value: unknown): ParseFieldResult {
  if (!(EDITABLE_TASK_FIELDS as readonly string[]).includes(field)) {
    return { ok: false, error: "Campo no editable" };
  }
  const f = field as EditableTaskField;
  if (value !== null && value !== undefined && typeof value !== "string") {
    return { ok: false, error: "Valor inválido" };
  }
  const raw = typeof value === "string" ? value : "";
  const trimmed = raw.trim();
  const ok = (v: string | null): ParseFieldResult => ({ ok: true, field: f, value: v });
  const fail = (error: string): ParseFieldResult => ({ ok: false, error });

  switch (f) {
    case "title":
      return trimmed ? ok(trimmed) : fail("El título es obligatorio");
    case "description":
      return ok(trimmed ? raw : null);
    case "status":
      return STATUSES.includes(trimmed) ? ok(trimmed) : fail("Estado inválido");
    case "priority":
      return PRIORITIES.includes(trimmed) ? ok(trimmed) : fail("Prioridad inválida");
    case "due_date":
      if (!trimmed) return ok(null);
      return isValidDateKey(trimmed) ? ok(trimmed) : fail("La fecha límite no es válida");
    case "assigned_to":
      return trimmed ? ok(trimmed) : fail("Debes asignar el pendiente a un socio");
    case "project_id":
    case "deliverable_id":
      return ok(trimmed && trimmed !== "none" ? trimmed : null);
  }
}

export function checklistProgress(items: { done: boolean }[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}
```
Run: `npx vitest run src/lib/task-update.test.ts` → PASS.

- [ ] **Step 4: Failing tests for attachments**

Create `src/lib/attachments.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_BYTES, formatFileSize, isImage, sanitizeFileName, storagePath, validateUpload,
} from "./attachments";

describe("validateUpload", () => {
  it("accepts up to exactly 25 MB and rejects one byte more", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(26214400);
    expect(validateUpload({ size: MAX_ATTACHMENT_BYTES })).toBeNull();
    expect(validateUpload({ size: MAX_ATTACHMENT_BYTES + 1 })).toBe("El archivo supera 25 MB");
  });

  it("rejects empty files", () => {
    expect(validateUpload({ size: 0 })).toBe("El archivo está vacío");
  });
});

describe("sanitizeFileName", () => {
  it("strips directories and traversal", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\leo\\foto.png")).toBe("foto.png");
  });

  it("replaces unsafe characters and accents", () => {
    expect(sanitizeFileName("Contrato Final (v2).pdf")).toBe("Contrato-Final-v2-.pdf");
    expect(sanitizeFileName("diseño ñ.png")).toBe("diseno-n.png");
  });

  it("drops leading dots and falls back to 'archivo'", () => {
    expect(sanitizeFileName(".env")).toBe("env");
    expect(sanitizeFileName("   ")).toBe("archivo");
    expect(sanitizeFileName("")).toBe("archivo");
  });

  it("caps the length at 100", () => {
    expect(sanitizeFileName(`${"a".repeat(150)}.txt`)).toHaveLength(100);
  });
});

describe("storagePath", () => {
  it("builds <taskId>/<id>-<safe name>", () => {
    expect(storagePath("t1", "Mi logo.png", "u-1")).toBe("t1/u-1-Mi-logo.png");
  });
});

describe("formatFileSize", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1258291)).toBe("1.2 MB");
  });
});

describe("isImage", () => {
  it("detects image mime types", () => {
    expect(isImage("image/png")).toBe(true);
    expect(isImage("application/pdf")).toBe(false);
    expect(isImage(null)).toBe(false);
  });
});
```
Run: `npx vitest run src/lib/attachments.test.ts` → FAIL.

- [ ] **Step 5: Implement attachments**

Create `src/lib/attachments.ts`:
```ts
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function validateUpload(file: { size: number }): string | null {
  if (file.size <= 0) return "El archivo está vacío";
  if (file.size > MAX_ATTACHMENT_BYTES) return "El archivo supera 25 MB";
  return null;
}

/**
 * Storage-safe file name: last path segment only, ASCII letters/digits/._-,
 * no leading dots, max 100 chars. The original name is kept in the DB row.
 */
export function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+/, "")
    .slice(0, 100);
  return cleaned || "archivo";
}

export function storagePath(taskId: string, fileName: string, id: string): string {
  return `${taskId}/${id}-${sanitizeFileName(fileName)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}
```
Run: `npx vitest run src/lib/attachments.test.ts` → PASS.

- [ ] **Step 6: Failing tests for task-events**

Create `src/lib/task-events.test.ts`:
```ts
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
```
Run: `npx vitest run src/lib/task-events.test.ts` → FAIL.

- [ ] **Step 7: Implement task-events**

Create `src/lib/task-events.ts`:
```ts
import { APP_TIME_ZONE, PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Deliverable, Project, TaskComment, TaskEvent, User } from "@/types";

export interface EventLookups {
  users: Pick<User, "id" | "name">[];
  projects: Pick<Project, "id" | "name">[];
  deliverables: Pick<Deliverable, "id" | "title">[];
}

const FIELD_LABELS = {
  status: "el estado",
  priority: "la prioridad",
  due_date: "la fecha límite",
  assigned_to: "el asignado",
  project_id: "el proyecto",
  deliverable_id: "el entregable",
} as const;

type ValueField = keyof typeof FIELD_LABELS;

function valueLabel(field: ValueField, value: string | null, lookups: EventLookups): string {
  switch (field) {
    case "status":
      return value ? (TASK_STATUS_LABELS as Record<string, string>)[value] ?? value : "ninguno";
    case "priority":
      return value ? (PRIORITY_LABELS as Record<string, string>)[value] ?? value : "ninguno";
    case "due_date":
      return value ? formatDate(value) : "sin fecha";
    case "assigned_to":
      if (!value) return "ninguno";
      return lookups.users.find((u) => u.id === value)?.name ?? "(eliminado)";
    case "project_id":
      if (!value) return "ninguno";
      return lookups.projects.find((p) => p.id === value)?.name ?? "(eliminado)";
    case "deliverable_id":
      if (!value) return "ninguno";
      return lookups.deliverables.find((d) => d.id === value)?.title ?? "(eliminado)";
  }
}

export function describeEvent(event: TaskEvent, lookups: EventLookups): string {
  const actor = lookups.users.find((u) => u.id === event.actor_id)?.name ?? "Alguien";
  switch (event.field) {
    case "created":
      return `${actor} creó el pendiente`;
    case "description":
      return `${actor} editó la descripción`;
    case "title":
      return `${actor} cambió el título`;
    default: {
      const field = event.field as ValueField;
      const from = valueLabel(field, event.old_value, lookups);
      const to = valueLabel(field, event.new_value, lookups);
      return `${actor} cambió ${FIELD_LABELS[field]} ${from} → ${to}`;
    }
  }
}

export type TimelineItem =
  | { kind: "comment"; item: TaskComment }
  | { kind: "event"; item: TaskEvent };

/** Oldest first; on identical timestamps events come before comments. */
export function mergeTimeline(comments: TaskComment[], events: TaskEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...events.map((item) => ({ kind: "event" as const, item })),
    ...comments.map((item) => ({ kind: "comment" as const, item })),
  ];
  return items.sort((a, b) => {
    const diff = Date.parse(a.item.created_at) - Date.parse(b.item.created_at);
    if (diff !== 0) return diff;
    if (a.kind === b.kind) return 0;
    return a.kind === "event" ? -1 : 1;
  });
}

const EVENT_TIME = new Intl.DateTimeFormat("es-MX", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatEventTime(iso: string): string {
  return EVENT_TIME.format(new Date(iso));
}
```
Run: `npx vitest run src/lib/task-events.test.ts` → PASS. If the `formatEventTime` test fails only because of ICU spacing/format, keep the assertions (`24/9`, `10:15`) and adjust the formatter options, not the test.

- [ ] **Step 8: Verify and commit**

Run the Global Constraints verification commands. All pass.
```bash
git add src/types/index.ts src/lib/realtime.ts src/lib/task-update.ts src/lib/task-update.test.ts src/lib/attachments.ts src/lib/attachments.test.ts src/lib/task-events.ts src/lib/task-events.test.ts
# plus any test fixture files you had to update for Task.updated_at
git commit -m "feat: add task detail types and pure logic"
```

---

### Task 2: Migration 003 (tables, history trigger, RLS, Storage)

**Files:**
- Create: `supabase/migrations/003_task_details.sql`
- Modify: `README.md`

**Interfaces:**
- Consumes: `public.is_partner()`, `update_updated_at()` (both from 001)
- Produces: tables `task_checklist_items`, `task_links`, `task_comments`, `task_events`, `task_attachments`; `tasks.updated_at`; trigger `tasks_log_changes`; bucket `task-files`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/003_task_details.sql`:
```sql
-- Task detail panel: checklist, links, comments, change history, attachments.

ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER task_comments_updated_at BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  field TEXT NOT NULL CHECK (field IN (
    'created', 'title', 'status', 'priority', 'due_date',
    'assigned_to', 'project_id', 'deliverable_id', 'description'
  )),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX task_checklist_items_task_id_idx ON task_checklist_items(task_id);
CREATE INDEX task_links_task_id_idx ON task_links(task_id);
CREATE INDEX task_comments_task_id_idx ON task_comments(task_id);
CREATE INDEX task_events_task_id_created_idx ON task_events(task_id, created_at);
CREATE INDEX task_attachments_task_id_idx ON task_attachments(task_id);

-- Change history. SECURITY DEFINER so it can write task_events, which has
-- no INSERT policy for users; auth.uid() still resolves to the caller.
CREATE OR REPLACE FUNCTION public.log_task_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_events (task_id, actor_id, field) VALUES (NEW.id, auth.uid(), 'created');
    RETURN NEW;
  END IF;

  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'title', OLD.title, NEW.title);
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'priority', OLD.priority::text, NEW.priority::text);
  END IF;
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'due_date', OLD.due_date::text, NEW.due_date::text);
  END IF;
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;
  IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'project_id', OLD.project_id::text, NEW.project_id::text);
  END IF;
  IF OLD.deliverable_id IS DISTINCT FROM NEW.deliverable_id THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'deliverable_id', OLD.deliverable_id::text, NEW.deliverable_id::text);
  END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO public.task_events (task_id, actor_id, field) VALUES (NEW.id, auth.uid(), 'description');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_log_changes
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_changes();

-- RLS
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task checklist: full access" ON task_checklist_items FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());
CREATE POLICY "Task links: full access" ON task_links FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());

CREATE POLICY "Task comments: read" ON task_comments FOR SELECT TO authenticated
  USING (public.is_partner());
CREATE POLICY "Task comments: insert own" ON task_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_partner() AND author_id = auth.uid());
CREATE POLICY "Task comments: update own" ON task_comments FOR UPDATE TO authenticated
  USING (public.is_partner() AND author_id = auth.uid())
  WITH CHECK (public.is_partner() AND author_id = auth.uid());
CREATE POLICY "Task comments: delete own" ON task_comments FOR DELETE TO authenticated
  USING (public.is_partner() AND author_id = auth.uid());

CREATE POLICY "Task events: read" ON task_events FOR SELECT TO authenticated
  USING (public.is_partner());

CREATE POLICY "Task attachments: read" ON task_attachments FOR SELECT TO authenticated
  USING (public.is_partner());
CREATE POLICY "Task attachments: insert own" ON task_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_partner() AND uploaded_by = auth.uid());
CREATE POLICY "Task attachments: delete own" ON task_attachments FOR DELETE TO authenticated
  USING (public.is_partner() AND uploaded_by = auth.uid());

-- Storage: private bucket, 25 MB per object. Object deletion is open to
-- partners so deleteTask can clean up other partners' files; "only the
-- uploader deletes" is enforced on the task_attachments row.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-files', 'task-files', false, 26214400)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Task files: read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-files' AND public.is_partner());
CREATE POLICY "Task files: upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files' AND public.is_partner());
CREATE POLICY "Task files: delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-files' AND public.is_partner());

ALTER PUBLICATION supabase_realtime ADD TABLE
  task_checklist_items, task_links, task_comments, task_events, task_attachments;
```

In `README.md` "Database setup", after the 002 step add: `4. Then run \`supabase/migrations/003_task_details.sql\` (creates the private \`task-files\` Storage bucket too).` and renumber the following steps.

- [ ] **Step 2: Apply locally (non-destructive) and test the trigger + RLS**

Run: `supabase migration up`
Expected: `Applying migration 003_task_details.sql...` without error. Never run `supabase db reset`.

Then run (each prints one line):
```bash
q(){ docker exec supabase_db_AJL-Group psql -U postgres -tAc "$1"; }
# trigger records status change with the acting user
LEO=$(q "select id from public.users where name='Leo'")
TASK=$(q "select id from public.tasks limit 1")
q "begin; set local role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$LEO\",\"role\":\"authenticated\"}', true); update public.tasks set status='in_progress' where id='$TASK'; select field||'|'||coalesce(old_value,'')||'|'||coalesce(new_value,'')||'|'||(actor_id='$LEO') from public.task_events where task_id='$TASK' order by created_at desc limit 1; rollback;"
# bucket exists, private, 25 MB
q "select public||'|'||file_size_limit from storage.buckets where id='task-files'"
# realtime publication
q "select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename like 'task_%'"
```
Expected: a line `status|pending|in_progress|t` (old value may differ if the task was not pending — the actor flag must be `t`), then `f|26214400`, then `5`.

If there is no row in `public.tasks`, create one through the app first or skip the trigger check and say so in the report.

- [ ] **Step 3: Verify and commit**

Run the Global Constraints verification commands.
```bash
git add supabase/migrations/003_task_details.sql README.md
git commit -m "feat: add task detail schema, history trigger, and file storage"
```

---

### Task 3: Server actions

**Files:**
- Create: `src/app/(dashboard)/tasks/detail-actions.ts`
- Modify: `src/app/(dashboard)/tasks/actions.ts`

**Interfaces:**
- Consumes: Task 1 — `parseTaskField`, `MAX_ATTACHMENT_BYTES`; existing — `moveItem(ids, id, direction)` from `@/lib/deliverables`, `parseHttpUrl(raw: unknown): string | null` from `@/lib/url`, `actionError`, `logActionError(context, error)`, `SAVE_ERROR`, `DELETE_ERROR`, `LOAD_ERROR`, `createClient()` (async server)
- Produces (all `"use server"`, return `{ error: string } | undefined` unless noted):
  - `getTaskDetail(id: string): Promise<{ detail: TaskDetail } | { error: string }>`
  - `updateTaskField(id: string, field: string, value: string | null)`
  - `addChecklistItem(taskId: string, text: string)`, `updateChecklistItem(id: string, taskId: string, patch: { text?: string; done?: boolean })`, `moveChecklistItem(id: string, taskId: string, direction: "up" | "down")`, `deleteChecklistItem(id: string, taskId: string)`
  - `addTaskLink(taskId: string, formData: FormData)`, `deleteTaskLink(id: string, taskId: string)`
  - `addComment(taskId: string, body: string)`, `updateComment(id: string, taskId: string, body: string)`, `deleteComment(id: string, taskId: string)`
  - `registerAttachment(taskId: string, meta: { storage_path: string; file_name: string; size_bytes: number; mime_type: string | null })`, `deleteAttachment(id: string, taskId: string)`, `getAttachmentUrl(id: string, taskId: string, download: boolean): Promise<{ url: string } | { error: string }>`

- [ ] **Step 1: Write detail-actions.ts**

Create `src/app/(dashboard)/tasks/detail-actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTaskField } from "@/lib/task-update";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { moveItem } from "@/lib/deliverables";
import { parseHttpUrl } from "@/lib/url";
import { actionError, logActionError, SAVE_ERROR, DELETE_ERROR, LOAD_ERROR } from "@/lib/action-error";
import type { TaskDetail } from "@/types";

const BUCKET = "task-files";

function revalidateDashboard() {
  revalidatePath("/", "layout");
}

export async function getTaskDetail(id: string): Promise<{ detail: TaskDetail } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const [task, checklist, links, comments, events, attachments, users, projects, deliverables] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:users!assigned_to(*), project:projects(*), deliverable:deliverables(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("task_checklist_items").select("*").eq("task_id", id).order("position").order("created_at"),
    supabase.from("task_links").select("*").eq("task_id", id).order("created_at"),
    supabase.from("task_comments").select("*, author:users(*)").eq("task_id", id).order("created_at"),
    supabase.from("task_events").select("*, actor:users(*)").eq("task_id", id).order("created_at"),
    supabase.from("task_attachments").select("*, uploader:users(*)").eq("task_id", id).order("created_at"),
    supabase.from("users").select("*").order("name"),
    supabase.from("projects").select("*").order("name"),
    supabase.from("deliverables").select("*").order("position"),
  ]);

  const failed = [task, checklist, links, comments, events, attachments, users, projects, deliverables].find(
    (r) => r.error
  );
  if (failed?.error) return actionError("getTaskDetail", failed.error, LOAD_ERROR);
  if (!task.data) return { error: "Pendiente no encontrado" };

  return {
    detail: {
      task: task.data,
      checklist: checklist.data || [],
      links: links.data || [],
      comments: comments.data || [],
      events: events.data || [],
      attachments: attachments.data || [],
      users: users.data || [],
      projects: projects.data || [],
      deliverables: deliverables.data || [],
      currentUserId: user.id,
    },
  };
}

export async function updateTaskField(id: string, field: string, value: string | null) {
  const parsed = parseTaskField(field, value);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const patch: Record<string, string | null> = { [parsed.field]: parsed.value };

  if (parsed.field === "project_id" || parsed.field === "deliverable_id") {
    const { data: current, error: currentError } = await supabase
      .from("tasks")
      .select("project_id, deliverable_id")
      .eq("id", id)
      .maybeSingle();
    if (currentError) return actionError("updateTaskField:current", currentError, LOAD_ERROR);
    if (!current) return { error: "Pendiente no encontrado" };

    const projectId = parsed.field === "project_id" ? parsed.value : current.project_id;
    const deliverableId = parsed.field === "deliverable_id" ? parsed.value : current.deliverable_id;

    if (deliverableId) {
      let belongs = false;
      if (projectId) {
        const { data: deliverable, error: dError } = await supabase
          .from("deliverables")
          .select("id")
          .eq("id", deliverableId)
          .eq("project_id", projectId)
          .maybeSingle();
        if (dError) return actionError("updateTaskField:deliverable", dError, LOAD_ERROR);
        belongs = !!deliverable;
      }
      if (!belongs) {
        if (parsed.field === "deliverable_id") return { error: "El entregable no pertenece a este proyecto" };
        patch.deliverable_id = null; // moving projects drops a deliverable from the old project
      }
    }
  }

  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select("id");
  if (error) return actionError("updateTaskField", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: "Pendiente no encontrado" };
  revalidateDashboard();
}

// ---------- Checklist ----------

export async function addChecklistItem(taskId: string, text: string) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { error: "El paso no puede estar vacío" };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("task_checklist_items")
    .select("position")
    .eq("task_id", taskId);
  if (fetchError) return actionError("addChecklistItem:fetch", fetchError, LOAD_ERROR);
  const position = (existing || []).reduce((max, r) => Math.max(max, r.position), -1) + 1;

  const { error } = await supabase.from("task_checklist_items").insert({ task_id: taskId, text: trimmed, position });
  if (error) return actionError("addChecklistItem", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function updateChecklistItem(id: string, taskId: string, patch: { text?: string; done?: boolean }) {
  const update: { text?: string; done?: boolean } = {};
  if (patch.text !== undefined) {
    const trimmed = patch.text.trim();
    if (!trimmed) return { error: "El paso no puede estar vacío" };
    update.text = trimmed;
  }
  if (patch.done !== undefined) update.done = patch.done;
  if (Object.keys(update).length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("task_checklist_items").update(update).eq("id", id).eq("task_id", taskId);
  if (error) return actionError("updateChecklistItem", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function moveChecklistItem(id: string, taskId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase
    .from("task_checklist_items")
    .select("id")
    .eq("task_id", taskId)
    .order("position")
    .order("created_at");
  if (fetchError) return actionError("moveChecklistItem:fetch", fetchError, LOAD_ERROR);

  const order = moveItem((rows || []).map((r) => r.id), id, direction);
  const results = await Promise.all(
    order.map((itemId, position) =>
      supabase.from("task_checklist_items").update({ position }).eq("id", itemId).eq("task_id", taskId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return actionError("moveChecklistItem", failed.error, SAVE_ERROR);
  revalidateDashboard();
}

export async function deleteChecklistItem(id: string, taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("task_checklist_items").delete().eq("id", id).eq("task_id", taskId);
  if (error) return actionError("deleteChecklistItem", error, DELETE_ERROR);
  revalidateDashboard();
}

// ---------- Links ----------

export async function addTaskLink(taskId: string, formData: FormData) {
  const label = ((formData.get("label") as string) || "").trim();
  if (!label) return { error: "La etiqueta es obligatoria" };
  const url = parseHttpUrl(formData.get("url"));
  if (!url) return { error: "La URL no es válida" };

  const supabase = await createClient();
  const { error } = await supabase.from("task_links").insert({ task_id: taskId, label, url });
  if (error) return actionError("addTaskLink", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function deleteTaskLink(id: string, taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("task_links").delete().eq("id", id).eq("task_id", taskId);
  if (error) return actionError("deleteTaskLink", error, DELETE_ERROR);
  revalidateDashboard();
}

// ---------- Comments ----------

export async function addComment(taskId: string, body: string) {
  const trimmed = (body || "").trim();
  if (!trimmed) return { error: "El comentario no puede estar vacío" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("task_comments").insert({ task_id: taskId, author_id: user.id, body: trimmed });
  if (error) return actionError("addComment", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function updateComment(id: string, taskId: string, body: string) {
  const trimmed = (body || "").trim();
  if (!trimmed) return { error: "El comentario no puede estar vacío" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .update({ body: trimmed })
    .eq("id", id)
    .eq("task_id", taskId)
    .select("id");
  if (error) return actionError("updateComment", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: "No puedes editar este comentario" };
  revalidateDashboard();
}

export async function deleteComment(id: string, taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", id)
    .eq("task_id", taskId)
    .select("id");
  if (error) return actionError("deleteComment", error, DELETE_ERROR);
  if (!data || data.length === 0) return { error: "No puedes eliminar este comentario" };
  revalidateDashboard();
}

// ---------- Attachments ----------

export async function registerAttachment(
  taskId: string,
  meta: { storage_path: string; file_name: string; size_bytes: number; mime_type: string | null }
) {
  if (!meta.storage_path.startsWith(`${taskId}/`)) return { error: "Ruta de archivo inválida" };
  if (!Number.isFinite(meta.size_bytes) || meta.size_bytes <= 0 || meta.size_bytes > MAX_ATTACHMENT_BYTES) {
    return { error: "El archivo supera 25 MB" };
  }
  const fileName = (meta.file_name || "").trim().slice(0, 255) || "archivo";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    uploaded_by: user.id,
    storage_path: meta.storage_path,
    file_name: fileName,
    size_bytes: meta.size_bytes,
    mime_type: meta.mime_type || null,
  });
  if (error) return actionError("registerAttachment", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function deleteAttachment(id: string, taskId: string) {
  const supabase = await createClient();
  // RLS lets only the uploader delete the row; the object is removed only if the row was.
  const { data, error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", id)
    .eq("task_id", taskId)
    .select("storage_path");
  if (error) return actionError("deleteAttachment", error, DELETE_ERROR);
  if (!data || data.length === 0) return { error: "No puedes eliminar este archivo" };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove(data.map((r) => r.storage_path));
  if (storageError) logActionError("deleteAttachment:storage", storageError);
  revalidateDashboard();
}

export async function getAttachmentUrl(
  id: string,
  taskId: string,
  download: boolean
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("task_attachments")
    .select("storage_path, file_name")
    .eq("id", id)
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) return actionError("getAttachmentUrl", error, LOAD_ERROR);
  if (!row) return { error: "Archivo no encontrado" };

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60, download ? { download: row.file_name } : undefined);
  if (signError || !data) return actionError("getAttachmentUrl:sign", signError, LOAD_ERROR);
  return { url: data.signedUrl };
}
```
Check `src/lib/action-error.ts` for `logActionError`'s exact export name/signature and adjust the import if it differs.

- [ ] **Step 2: deleteTask cleans Storage**

In `src/app/(dashboard)/tasks/actions.ts`, at the start of `deleteTask` (after `createClient()`), add:
```ts
  // Remove this task's files from Storage first; the rows cascade with the task.
  const { data: files, error: filesError } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("task_id", id);
  if (filesError) {
    logActionError("deleteTask:files", filesError);
  } else if (files && files.length > 0) {
    const { error: storageError } = await supabase.storage.from("task-files").remove(files.map((f) => f.storage_path));
    if (storageError) logActionError("deleteTask:storage", storageError);
  }
```
Import `logActionError` from `@/lib/action-error`.

- [ ] **Step 3: Verify and commit**

Run the Global Constraints verification commands. All pass.
```bash
git add "src/app/(dashboard)/tasks/detail-actions.ts" "src/app/(dashboard)/tasks/actions.ts"
git commit -m "feat: add task detail server actions"
```

---

### Task 4: Sheet shell, fields, description, open-from-anywhere

**Files:**
- Create: `src/components/tasks/use-open-task.ts`, `src/components/tasks/open-task-button.tsx`, `src/components/tasks/task-card.test.tsx`, `src/components/tasks/detail/task-detail-sheet.tsx`, `src/components/tasks/detail/task-fields.tsx`, `src/components/tasks/detail/task-description.tsx`
- Modify: `src/components/tasks/task-card.tsx`, `src/app/(dashboard)/layout.tsx`, `src/components/dashboard/urgent-tasks.tsx`, `src/app/(dashboard)/projects/[id]/page.tsx`, `src/components/projects/deliverable-row.tsx`

**Interfaces:**
- Consumes: Task 3 — `getTaskDetail`, `updateTaskField`; Task 1 — `TaskDetail`, `TASK_DETAIL_TABLES`; existing — `createDebouncedRefresh(fn, ms)`, `createClient()` (browser), `ProjectDot`, `PRIORITY_LABELS`, `TASK_STATUS_LABELS`, shadcn `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`
- Produces:
  - `useOpenTask(): (id: string) => void` and `useCloseTask(): () => void`
  - `<OpenTaskButton taskId: string className?: string>{children}</OpenTaskButton>`
  - `<TaskDetailSheet />` exposing to sections: `detail: TaskDetail`, `reload: () => void`
  - Section contract used by Tasks 5-6: `({ detail, reload }: { detail: TaskDetail; reload: () => void })`

- [ ] **Step 1: Open/close hooks and button**

Create `src/components/tasks/use-open-task.ts`:
```ts
"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Opens the task detail panel by setting ?task=<id>, keeping other params. */
export function useOpenTask() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("task", id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );
}

export function useCloseTask() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);
}
```

Create `src/components/tasks/open-task-button.tsx`:
```tsx
"use client";

import { cn } from "@/lib/utils";
import { useOpenTask } from "@/components/tasks/use-open-task";

export function OpenTaskButton({
  taskId,
  className,
  children,
}: {
  taskId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const openTask = useOpenTask();
  return (
    <button type="button" onClick={() => openTask(taskId)} className={cn("text-left hover:underline", className)}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Failing test for the clickable TaskCard**

Create `src/components/tasks/task-card.test.tsx`:
```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Task } from "@/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/tasks",
  useSearchParams: () => new URLSearchParams("priority=high"),
}));
vi.mock("@/app/(dashboard)/tasks/actions", () => ({ updateTaskStatus: vi.fn(), deleteTask: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskCard } from "./task-card";

const task: Task = {
  id: "t1", title: "Ajustar login", description: null, priority: "medium", status: "pending",
  due_date: null, project_id: null, deliverable_id: null, assigned_to: "u1", created_by: "u1",
  created_at: "2026-09-24T00:00:00Z", updated_at: "2026-09-24T00:00:00Z",
  checklist: [{ done: true }, { done: false }], attachments: [{ count: 2 }],
};

describe("TaskCard", () => {
  beforeEach(() => push.mockClear());

  it("opens the detail panel when the card is clicked, keeping other params", () => {
    render(<TaskCard task={task} />);
    fireEvent.click(screen.getByText("Ajustar login"));
    expect(push).toHaveBeenCalledWith("/tasks?priority=high&task=t1", { scroll: false });
  });

  it("opens with Enter for keyboard users", () => {
    render(<TaskCard task={task} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Ajustar login/ }), { key: "Enter" });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("does not open when interacting with the status select or delete button", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TaskCard task={task} />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar pendiente" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("shows checklist progress and attachment count", () => {
    render(<TaskCard task={task} />);
    expect(screen.getByText("☑ 1/2")).toBeInTheDocument();
    expect(screen.getByText("📎 2")).toBeInTheDocument();
  });
});
```
Run: `npx vitest run src/components/tasks/task-card.test.tsx` → FAIL.

- [ ] **Step 3: Make TaskCard clickable**

In `src/components/tasks/task-card.tsx`:
- Import `useOpenTask` and `checklistProgress` (`@/lib/task-update`).
- Inside the component: `const openTask = useOpenTask();` and
```tsx
  const progress = checklistProgress(task.checklist ?? []);
  const attachmentCount = task.attachments?.[0]?.count ?? 0;
```
- Change the outer `<div className="flex items-center justify-between border rounded-lg p-4">` to:
```tsx
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${task.title}`}
      onClick={() => openTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openTask(task.id);
        }
      }}
      className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
```
- In the metadata row (after the due date span) add:
```tsx
            {progress.total > 0 && <span>· ☑ {progress.done}/{progress.total}</span>}
            {attachmentCount > 0 && <span>· 📎 {attachmentCount}</span>}
```
  and adjust the test strings if your separator differs — the test expects the exact texts `☑ 1/2` and `📎 2` as their own text nodes, so render them as `<span>☑ {…}</span>` with the `·` in a sibling span: `<span aria-hidden>·</span><span>☑ {progress.done}/{progress.total}</span>`.
- Wrap the right-side controls container with propagation stops (React portal events bubble through the React tree, so this also covers the Select dropdown):
```tsx
      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
```
- Give the delete button `aria-label="Eliminar pendiente"`.

In `src/app/(dashboard)/tasks/page.tsx`, change the tasks select to
`"*, assignee:users!assigned_to(*), project:projects(*), checklist:task_checklist_items(done), attachments:task_attachments(count)"`.

Run: `npx vitest run src/components/tasks/task-card.test.tsx` → PASS.

- [ ] **Step 4: Fields and description sections**

Create `src/components/tasks/detail/task-fields.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectDot } from "@/components/projects/project-dot";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { updateTaskField } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskDetail } from "@/types";

export function TaskFields({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const { task, users, projects, deliverables } = detail;
  const [title, setTitle] = useState(task.title);
  useEffect(() => setTitle(task.title), [task.title]);

  const projectDeliverables = deliverables.filter((d) => d.project_id === task.project_id);

  async function save(field: string, value: string | null) {
    const result = await updateTaskField(task.id, field, value);
    if (result?.error) {
      toast.error(result.error);
      if (field === "title") setTitle(task.title);
      return;
    }
    reload();
  }

  function saveTitle() {
    if (title.trim() && title.trim() !== task.title) save("title", title);
    else setTitle(task.title);
  }

  return (
    <div className="space-y-4">
      {task.project && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ProjectDot color={task.project.color} />
          {task.project.name}
          {task.deliverable && <span>› {task.deliverable.title}</span>}
        </p>
      )}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        aria-label="Título"
        className="text-lg font-semibold"
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Estado</Label>
          <Select value={task.status} onValueChange={(v) => save("status", v)}>
            <SelectTrigger aria-label="Estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Prioridad</Label>
          <Select value={task.priority} onValueChange={(v) => save("priority", v)}>
            <SelectTrigger aria-label="Prioridad"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Asignado</Label>
          <Select value={task.assigned_to} onValueChange={(v) => save("assigned_to", v)}>
            <SelectTrigger aria-label="Asignado"><SelectValue /></SelectTrigger>
            <SelectContent>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="detail-due-date">Fecha límite</Label>
          <Input
            id="detail-due-date"
            type="date"
            defaultValue={task.due_date ?? ""}
            key={task.due_date ?? "none"}
            onChange={(e) => save("due_date", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Proyecto</Label>
          <Select value={task.project_id ?? "none"} onValueChange={(v) => save("project_id", v)}>
            <SelectTrigger aria-label="Proyecto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">General (sin proyecto)</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {task.project_id && (
          <div className="space-y-1">
            <Label>Entregable</Label>
            <Select value={task.deliverable_id ?? "none"} onValueChange={(v) => save("deliverable_id", v)}>
              <SelectTrigger aria-label="Entregable"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin entregable</SelectItem>
                {projectDeliverables.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
```

Create `src/components/tasks/detail/task-description.tsx`:
```tsx
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
```

- [ ] **Step 5: The Sheet shell**

Create `src/components/tasks/detail/task-detail-sheet.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { TASK_DETAIL_TABLES, createDebouncedRefresh } from "@/lib/realtime";
import { useCloseTask } from "@/components/tasks/use-open-task";
import { getTaskDetail } from "@/app/(dashboard)/tasks/detail-actions";
import { TaskFields } from "./task-fields";
import { TaskDescription } from "./task-description";
import type { TaskDetail } from "@/types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; detail: TaskDetail };

export function TaskDetailSheet() {
  const taskId = useSearchParams().get("task");
  const closeTask = useCloseTask();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const latestId = useRef(taskId);
  latestId.current = taskId;

  const load = useCallback(async (id: string) => {
    const result = await getTaskDetail(id);
    if (latestId.current !== id) return; // user switched tasks while loading
    if ("error" in result) setState({ status: "error", message: result.error });
    else setState({ status: "ready", detail: result.detail });
  }, []);

  const reload = useCallback(() => {
    if (latestId.current) load(latestId.current);
  }, [load]);

  useEffect(() => {
    if (!taskId) return;
    setState({ status: "loading" });
    load(taskId);

    const supabase = createClient();
    const debounced = createDebouncedRefresh(() => load(taskId), 300);
    const channel = supabase.channel(`task-detail-${taskId}`);
    TASK_DETAIL_TABLES.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `task_id=eq.${taskId}` }, () =>
        debounced.trigger()
      );
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `id=eq.${taskId}` }, () =>
      debounced.trigger()
    );
    channel.subscribe();

    return () => {
      debounced.cancel();
      supabase.removeChannel(channel);
    };
  }, [taskId, load]);

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && closeTask()}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Detalle del pendiente</SheetTitle>
        </SheetHeader>
        {state.status === "loading" && (
          <div className="space-y-3 pt-4" aria-busy="true">
            <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-24 rounded bg-muted animate-pulse" />
            <div className="h-40 rounded bg-muted animate-pulse" />
          </div>
        )}
        {state.status === "error" && <p className="pt-6 text-sm text-muted-foreground">{state.message}</p>}
        {state.status === "ready" && (
          <div className="space-y-6 pt-2" key={state.detail.task.id}>
            <TaskFields detail={state.detail} reload={reload} />
            <Separator />
            <TaskDescription detail={state.detail} reload={reload} />
            {/* Checklist, links, attachments (Task 5) and activity (Task 6) go below. */}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```
Remove the placeholder comment line in Task 5/6 when the sections are added.

In `src/app/(dashboard)/layout.tsx`: import `{ Suspense } from "react"` and `TaskDetailSheet`; after `<RealtimeRefresh />` render:
```tsx
      <Suspense fallback={null}>
        <TaskDetailSheet />
      </Suspense>
```

- [ ] **Step 6: Open from the other lists**

- `src/components/dashboard/urgent-tasks.tsx`: replace `<Link href="/tasks" className="hover:underline">{t.title}</Link>` with `<OpenTaskButton taskId={t.id}>{t.title}</OpenTaskButton>`; remove the `Link` import if unused.
- `src/app/(dashboard)/projects/[id]/page.tsx`: in the "Pendientes del Proyecto" list replace `<span>{task.title}</span>` with `<OpenTaskButton taskId={task.id}>{task.title}</OpenTaskButton>`.
- `src/components/projects/deliverable-row.tsx`: in the expanded linked-task list replace the title `<span className={…}>{t.title}</span>` with `<OpenTaskButton taskId={t.id} className={t.status === "completed" ? "line-through text-muted-foreground" : ""}>{t.title}</OpenTaskButton>`. Its test mocks do not cover `next/navigation`: add `vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/projects/p1", useSearchParams: () => new URLSearchParams() }))` to `deliverable-row.test.tsx`.
- Calendar: no change (see Plan decision) — the day dialog's `TaskCard`s are now clickable.

- [ ] **Step 7: Verify and commit**

Run the Global Constraints verification commands. All pass.
```bash
git add src/components/tasks/ "src/app/(dashboard)/layout.tsx" "src/app/(dashboard)/tasks/page.tsx" src/components/dashboard/urgent-tasks.tsx "src/app/(dashboard)/projects/[id]/page.tsx" src/components/projects/deliverable-row.tsx src/components/projects/deliverable-row.test.tsx
git commit -m "feat: add task detail sheet with editable fields and description"
```

---

### Task 5: Checklist, links and attachments sections

**Files:**
- Create: `src/components/tasks/detail/task-checklist.tsx`, `src/components/tasks/detail/task-checklist.test.tsx`, `src/components/tasks/detail/task-links.tsx`, `src/components/tasks/detail/task-attachments.tsx`
- Modify: `src/components/tasks/detail/task-detail-sheet.tsx`

**Interfaces:**
- Consumes: Task 3 — `addChecklistItem`, `updateChecklistItem`, `moveChecklistItem`, `deleteChecklistItem`, `addTaskLink`, `deleteTaskLink`, `registerAttachment`, `deleteAttachment`, `getAttachmentUrl`; Task 1 — `checklistProgress`, `validateUpload`, `storagePath`, `formatFileSize`, `isImage`; `parseHttpUrl` (render-time check); `createClient()` browser; `formatDate`; `Progress`
- Produces: `<TaskChecklist detail reload />`, `<TaskLinks detail reload />`, `<TaskAttachments detail reload />`

- [ ] **Step 1: Failing checklist test**

Create `src/components/tasks/detail/task-checklist.test.tsx`:
```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TaskDetail } from "@/types";

const updateChecklistItem = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/(dashboard)/tasks/detail-actions", () => ({
  updateChecklistItem: (...args: unknown[]) => updateChecklistItem(...args),
  addChecklistItem: vi.fn(),
  moveChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskChecklist } from "./task-checklist";

const detail = {
  task: { id: "t1" },
  checklist: [
    { id: "c1", task_id: "t1", text: "Configurar OAuth", done: false, position: 0, created_at: "x" },
    { id: "c2", task_id: "t1", text: "Probar", done: true, position: 1, created_at: "x" },
  ],
} as unknown as TaskDetail;

describe("TaskChecklist", () => {
  it("shows progress", () => {
    render(<TaskChecklist detail={detail} reload={vi.fn()} />);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("toggles an item", async () => {
    const reload = vi.fn();
    render(<TaskChecklist detail={detail} reload={reload} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Configurar OAuth" }));
    await waitFor(() => expect(updateChecklistItem).toHaveBeenCalledWith("c1", "t1", { done: true }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });
});
```
Run: `npx vitest run src/components/tasks/detail/task-checklist.test.tsx` → FAIL.

- [ ] **Step 2: Checklist section**

Create `src/components/tasks/detail/task-checklist.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { checklistProgress } from "@/lib/task-update";
import {
  addChecklistItem, deleteChecklistItem, moveChecklistItem, updateChecklistItem,
} from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskChecklistItem, TaskDetail } from "@/types";

export function TaskChecklist({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const taskId = detail.task.id;
  const items = detail.checklist;
  const progress = checklistProgress(items);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function run(action: () => Promise<{ error: string } | undefined>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result?.error) {
      toast.error(result.error);
      return false;
    }
    reload();
    return true;
  }

  async function handleAdd(formData: FormData) {
    const text = String(formData.get("text") ?? "");
    if (await run(() => addChecklistItem(taskId, text))) formRef.current?.reset();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Checklist</h3>
        {progress.total > 0 && <span className="text-xs text-muted-foreground">{progress.done}/{progress.total}</span>}
      </div>
      {progress.total > 0 && <Progress value={(progress.done / progress.total) * 100} />}
      <ul className="space-y-1">
        {items.map((item, i) => (
          <ChecklistRow
            key={item.id}
            item={item}
            canMoveUp={i > 0}
            canMoveDown={i < items.length - 1}
            busy={busy}
            run={run}
          />
        ))}
      </ul>
      <form ref={formRef} action={handleAdd} className="flex gap-2">
        <Input name="text" placeholder="Agregar paso" aria-label="Nuevo paso" className="h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={busy}><Plus className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function ChecklistRow({
  item, canMoveUp, canMoveDown, busy, run,
}: {
  item: TaskChecklistItem;
  canMoveUp: boolean;
  canMoveDown: boolean;
  busy: boolean;
  run: (action: () => Promise<{ error: string } | undefined>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  async function saveText() {
    setEditing(false);
    if (text.trim() === item.text) return;
    if (!(await run(() => updateChecklistItem(item.id, item.task_id, { text })))) setText(item.text);
  }

  return (
    <li className="flex items-center gap-2 text-sm group">
      <input
        type="checkbox"
        checked={item.done}
        aria-label={item.text}
        disabled={busy}
        onChange={(e) => run(() => updateChecklistItem(item.id, item.task_id, { done: e.target.checked }))}
        className="h-4 w-4"
      />
      {editing ? (
        <Input
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onBlur={saveText}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setText(item.text); setEditing(false); }
          }}
          className="h-7"
          aria-label="Editar paso"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`flex-1 text-left ${item.done ? "line-through text-muted-foreground" : ""}`}
        >
          {item.text}
        </button>
      )}
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Subir paso" disabled={!canMoveUp || busy}
        onClick={() => run(() => moveChecklistItem(item.id, item.task_id, "up"))}>
        <ArrowUp className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Bajar paso" disabled={!canMoveDown || busy}
        onClick={() => run(() => moveChecklistItem(item.id, item.task_id, "down"))}>
        <ArrowDown className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Eliminar paso" disabled={busy}
        onClick={() => run(() => deleteChecklistItem(item.id, item.task_id))}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </li>
  );
}
```
Run: `npx vitest run src/components/tasks/detail/task-checklist.test.tsx` → PASS.

- [ ] **Step 3: Links section**

Create `src/components/tasks/detail/task-links.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseHttpUrl } from "@/lib/url";
import { addTaskLink, deleteTaskLink } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskDetail } from "@/types";

export function TaskLinks({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const taskId = detail.task.id;
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAdd(formData: FormData) {
    setBusy(true);
    const result = await addTaskLink(taskId, formData);
    setBusy(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    formRef.current?.reset();
    setAdding(false);
    reload();
  }

  async function handleDelete(id: string) {
    const result = await deleteTaskLink(id, taskId);
    if (result?.error) toast.error(result.error);
    else reload();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Links</h3>
        <Button size="sm" variant="ghost" onClick={() => setAdding(!adding)} aria-label="Agregar link">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {adding && (
        <form ref={formRef} action={handleAdd} className="flex gap-2">
          <Input name="label" placeholder="Etiqueta" required className="h-8 w-32" aria-label="Etiqueta del link" />
          <Input name="url" type="url" placeholder="https://…" required className="h-8 flex-1" aria-label="URL del link" />
          <Button type="submit" size="sm" disabled={busy}>Agregar</Button>
        </form>
      )}
      {detail.links.length === 0 && !adding && <p className="text-sm text-muted-foreground">Sin links</p>}
      <ul className="space-y-1">
        {detail.links.map((link) => {
          const safeUrl = parseHttpUrl(link.url);
          return (
            <li key={link.id} className="flex items-center justify-between text-sm">
              {safeUrl ? (
                <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />{link.label}
                </a>
              ) : (
                <span>{link.label}</span>
              )}
              <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Eliminar link" onClick={() => handleDelete(link.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Attachments section**

Create `src/components/tasks/detail/task-attachments.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatFileSize, isImage, storagePath, validateUpload } from "@/lib/attachments";
import { formatDate } from "@/lib/utils";
import { deleteAttachment, getAttachmentUrl, registerAttachment } from "@/app/(dashboard)/tasks/detail-actions";
import type { TaskAttachment, TaskDetail } from "@/types";

export function TaskAttachments({ detail, reload }: { detail: TaskDetail; reload: () => void }) {
  const taskId = detail.task.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  async function uploadOne(file: File) {
    const problem = validateUpload(file);
    if (problem) {
      toast.error(`${file.name}: ${problem}`);
      return;
    }
    setUploading((u) => [...u, file.name]);
    const supabase = createClient();
    const path = storagePath(taskId, file.name, crypto.randomUUID());
    const { error: uploadError } = await supabase.storage
      .from("task-files")
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (uploadError) {
      toast.error(`${file.name}: no se pudo subir`);
    } else {
      const result = await registerAttachment(taskId, {
        storage_path: path,
        file_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || null,
      });
      if (result?.error) {
        toast.error(`${file.name}: ${result.error}`);
        await supabase.storage.from("task-files").remove([path]); // don't leave an orphan object
      }
    }
    setUploading((u) => u.filter((n) => n !== file.name));
  }

  async function uploadFiles(files: FileList | File[]) {
    await Promise.all(Array.from(files).map(uploadOne));
    reload();
  }

  return (
    <div
      className={`space-y-2 rounded-lg ${dragging ? "ring-2 ring-primary ring-offset-2" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Archivos ({detail.attachments.length})</h3>
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-4 w-4 mr-1" />Subir
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Seleccionar archivos"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {uploading.map((name) => (
        <p key={name} className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />Subiendo {name}…
        </p>
      ))}
      {detail.attachments.length === 0 && uploading.length === 0 && (
        <p className="text-sm text-muted-foreground">Arrastra archivos aquí o usa “Subir” (máx. 25 MB)</p>
      )}
      <ul className="space-y-2">
        {detail.attachments.map((a) => (
          <AttachmentRow key={a.id} attachment={a} canDelete={a.uploaded_by === detail.currentUserId} reload={reload} />
        ))}
      </ul>
    </div>
  );
}

function AttachmentRow({
  attachment, canDelete, reload,
}: {
  attachment: TaskAttachment;
  canDelete: boolean;
  reload: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const image = isImage(attachment.mime_type);

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    getAttachmentUrl(attachment.id, attachment.task_id, false).then((r) => {
      if (!cancelled && "url" in r) setThumb(r.url);
    });
    return () => { cancelled = true; };
  }, [attachment.id, attachment.task_id, image]);

  async function handleDownload() {
    const result = await getAttachmentUrl(attachment.id, attachment.task_id, true);
    if ("error" in result) toast.error(result.error);
    else window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${attachment.file_name}"?`)) return;
    const result = await deleteAttachment(attachment.id, attachment.task_id);
    if (result?.error) toast.error(result.error);
    else reload();
  }

  return (
    <li className="flex items-center gap-3 text-sm">
      {image && thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL
        <img src={thumb} alt="" className="h-10 w-10 rounded object-cover border" />
      ) : (
        <FileText className="h-10 w-10 p-2 text-muted-foreground border rounded" />
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{attachment.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size_bytes)} · {attachment.uploader?.name ?? "—"} · {formatDate(attachment.created_at)}
        </p>
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Descargar archivo" onClick={handleDownload}>
        <Download className="h-3 w-3" />
      </Button>
      {canDelete && (
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Eliminar archivo" onClick={handleDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </li>
  );
}
```
If lint still flags the `<img>` despite the disable comment, replace it with `next/image`: `<Image src={thumb} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded object-cover border" />` (import `Image from "next/image"`) and drop the comment. Do not change `.eslintrc.json` or `next.config`.

Note: `formatDate` receives an ISO timestamp here; it already falls back to `new Date(str)` for non date-only strings.

- [ ] **Step 5: Mount the sections**

In `task-detail-sheet.tsx`, import the three components and replace the placeholder comment with:
```tsx
            <Separator />
            <TaskChecklist detail={state.detail} reload={reload} />
            <Separator />
            <TaskLinks detail={state.detail} reload={reload} />
            <Separator />
            <TaskAttachments detail={state.detail} reload={reload} />
            {/* Activity (Task 6) goes below. */}
```

- [ ] **Step 6: Verify and commit**

Run the Global Constraints verification commands. All pass.
```bash
git add src/components/tasks/detail/
git commit -m "feat: add checklist, links and file attachments to task detail"
```

---

### Task 6: Activity timeline and comments

**Files:**
- Create: `src/components/tasks/detail/task-activity.tsx`, `src/components/tasks/detail/task-activity.test.tsx`
- Modify: `src/components/tasks/detail/task-detail-sheet.tsx`

**Interfaces:**
- Consumes: Task 1 — `mergeTimeline`, `describeEvent`, `formatEventTime`; Task 3 — `addComment`, `updateComment`, `deleteComment`
- Produces: `<TaskActivity detail reload />`

- [ ] **Step 1: Failing test**

Create `src/components/tasks/detail/task-activity.test.tsx`:
```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TaskDetail } from "@/types";

vi.mock("@/app/(dashboard)/tasks/detail-actions", () => ({
  addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskActivity } from "./task-activity";

const leo = { id: "u1", name: "Leo" };
const alan = { id: "u2", name: "Alan" };

const detail = {
  task: { id: "t1" },
  currentUserId: "u1",
  users: [leo, alan],
  projects: [],
  deliverables: [],
  events: [
    { id: "e1", task_id: "t1", actor_id: "u2", field: "status", old_value: "pending", new_value: "in_progress", created_at: "2026-09-24T09:00:00Z" },
  ],
  comments: [
    { id: "c1", task_id: "t1", author_id: "u1", body: "Mío", created_at: "2026-09-24T10:00:00Z", updated_at: "2026-09-24T10:00:00Z", author: leo },
    { id: "c2", task_id: "t1", author_id: "u2", body: "De Alan", created_at: "2026-09-24T11:00:00Z", updated_at: "2026-09-24T11:30:00Z", author: alan },
  ],
} as unknown as TaskDetail;

describe("TaskActivity", () => {
  it("renders events as sentences", () => {
    render(<TaskActivity detail={detail} reload={vi.fn()} />);
    expect(screen.getByText("Alan cambió el estado Pendiente → En Progreso")).toBeInTheDocument();
  });

  it("shows edit/delete only on the current user's comments", () => {
    render(<TaskActivity detail={detail} reload={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Editar comentario" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Eliminar comentario" })).toHaveLength(1);
  });

  it("marks edited comments", () => {
    render(<TaskActivity detail={detail} reload={vi.fn()} />);
    expect(screen.getAllByText("(editado)")).toHaveLength(1);
  });
});
```
Run: `npx vitest run src/components/tasks/detail/task-activity.test.tsx` → FAIL.

- [ ] **Step 2: Implement TaskActivity**

Create `src/components/tasks/detail/task-activity.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const result = await addComment(taskId, body);
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
              {describeEvent(entry.item, detail)} · {formatEventTime(entry.item.created_at)}
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
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Editar comentario" />
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
```
Note: `describeEvent(entry.item, detail)` works because `TaskDetail` has `users`, `projects`, `deliverables` (structurally satisfies `EventLookups`).

Run: `npx vitest run src/components/tasks/detail/task-activity.test.tsx` → PASS.

- [ ] **Step 3: Mount and verify**

In `task-detail-sheet.tsx` import `TaskActivity` and replace `{/* Activity (Task 6) goes below. */}` with:
```tsx
            <Separator />
            <TaskActivity detail={state.detail} reload={reload} />
```
Run the Global Constraints verification commands. All pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/detail/
git commit -m "feat: add activity timeline with comments to task detail"
```

---

### Task 7: End-to-end verification (controller)

**Files:** none (fixes go back to the owning task's files)

- [ ] **Step 1: Build**

Stop the dev server on port 3100, then run `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run build` → success; `rm -rf .next`; restart `npx next dev -p 3100`.

- [ ] **Step 2: API checks as Leo and Alan (local Supabase)**

With access tokens for leo@ajlgroup.com and alan@ajlgroup.com (password grant against `http://127.0.0.1:54321/auth/v1/token`):
1. Leo uploads a 1 MB file to `task-files/<taskId>/<uuid>-test.bin` (POST `/storage/v1/object/task-files/<path>`) → 200; inserts the `task_attachments` row → 201.
2. Leo creates a signed URL (POST `/storage/v1/object/sign/task-files/<path>` `{"expiresIn":60}`) and downloads it → 200, 1 MB.
3. Uploading a 26 MB file → rejected (413 / "exceeded the maximum allowed size").
4. Alan deletes Leo's `task_attachments` row (DELETE `/rest/v1/task_attachments?id=eq.<id>` with `Prefer: return=representation`) → `[]` (0 rows).
5. Alan inserts a comment as himself → 201; Leo PATCHes Alan's comment → `[]`.
6. Leo PATCHes the task status → a new `task_events` row with `field=status`, `actor_id=<Leo>`.
7. Delete the task through the app's `deleteTask` path (or replicate: remove objects then delete row) → object gone from `storage.objects`, child rows gone.
Clean up any test data created.

- [ ] **Step 3: Browser walkthrough (user)**

Hand to the user: open a task from /tasks, dashboard, project detail and calendar day dialog; edit each field and see the activity line; description autosave; checklist add/toggle/reorder/delete and "☑ n/m" on the card; add a link; drag a file and download it; comment, edit, delete; second browser sees changes live.
