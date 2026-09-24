# Project Color + Deliverable-Based Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every project a customizable color shown across the app, and replace the manual progress slider with progress computed from weighted, partner-approved deliverables.

**Architecture:** New migration `002` adds `projects.color`, a `deliverables` table and `tasks.deliverable_id`, and drops `projects.progress`. All rules (deliverable status, project progress, weight validation, color parsing, reordering) are pure functions in `src/lib/` with Vitest tests; server actions and components consume them. Progress is never stored — it is derived from deliverable rows on every render.

**Tech Stack:** Next.js 14.2.35 App Router, React 18, TypeScript strict, Tailwind v3, shadcn/ui, sonner, Supabase (`@supabase/ssr`, Postgres RLS, Realtime), Vitest 1.6.1 + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-24-project-color-deliverables-design.md` (extends `docs/superpowers/specs/2026-09-24-ajl-group-dashboard-design.md`)

## Global Constraints

- Next.js 14 (14.2.35), TypeScript strict mode, Node >= 20.19.0
- All DB access via Supabase client (no raw pg connections)
- Every RLS policy uses `TO authenticated USING (public.is_partner()) WITH CHECK (public.is_partner())`
- Server actions: validation errors return specific Spanish `{ error }`; DB errors go through `actionError(context, error, SAVE_ERROR | DELETE_ERROR | LOAD_ERROR)` from `@/lib/action-error` (never return raw `error.message`)
- Client callers surface `{ error }` via `toast.error` from `"sonner"`
- Spanish UI labels with correct orthography throughout
- Money via `formatCurrency`, dates via `formatDate` from `@/lib/utils`
- Colors: only `#RRGGBB` hex (DB CHECK `'^#[0-9A-Fa-f]{6}$'`), default `#6366F1`
- Deliverable weights: decimal 0..100 per deliverable; project total must not exceed 100 (`exceedsHundred`), UI warns when `!isHundred(total)`
- Progress: Σ weight of approved deliverables, clamped 0..100, integer; no deliverables → "Sin entregables"
- Priority colors unchanged: urgent=#EF4444, high=#F97316, medium=#EAB308, low=#22C55E
- Verification for every task: `npm test`, `npx tsc --noEmit`, `npm run lint`, `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run build` — all pass with pristine output
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

## File Structure

```
supabase/migrations/002_project_color_deliverables.sql   NEW  schema changes
src/lib/colors.ts (+ .test.ts)                           NEW  palette, parseHexColor, nextPaletteColor
src/lib/deliverables.ts (+ .test.ts)                     NEW  deliverableStatus, projectProgress, weightTotal, moveItem
src/lib/deliverable-form.ts (+ .test.ts)                 NEW  parseDeliverableForm
src/lib/project-form.ts (+ .test.ts)                     MOD  drop progress, add color
src/lib/constants.ts                                     MOD  DELIVERABLE_STATUS_LABELS
src/lib/realtime.ts                                      MOD  + "deliverables"
src/types/index.ts                                       MOD  Project.color, -progress, Deliverable, Task.deliverable_id
src/components/ui/progress.tsx                           MOD  indicatorColor prop
src/components/projects/color-picker.tsx                 NEW  swatches + custom input
src/components/projects/project-progress.tsx             NEW  ProjectProgressBar (label + bar)
src/components/projects/project-dot.tsx                  NEW  colored dot
src/components/projects/deliverables-panel.tsx           NEW  header, list, add form
src/components/projects/deliverable-row.tsx (+ .test.tsx) NEW one deliverable row
src/app/(dashboard)/projects/deliverable-actions.ts      NEW  deliverable server actions
src/app/(dashboard)/projects/actions.ts                  MOD  (uses updated parser only)
src/app/(dashboard)/tasks/actions.ts                     MOD  deliverable_id
src/components/projects/project-form.tsx                 MOD  ColorPicker, defaultColor prop
src/components/projects/project-edit-form.tsx            MOD  ColorPicker, remove slider
src/components/projects/project-card.tsx                 MOD  stripe + ProjectProgressBar
src/components/dashboard/active-projects.tsx             MOD  ProjectProgressBar
src/components/dashboard/urgent-tasks.tsx                MOD  project dot + name
src/components/tasks/task-form.tsx                       MOD  deliverable select, default project/deliverable
src/components/tasks/task-card.tsx                       MOD  project dot
src/components/calendar/calendar-grid.tsx                MOD  chip border color
src/components/finance/project-breakdown.tsx             MOD  project dot
src/components/finance/transaction-table.tsx             MOD  project dot
src/app/(dashboard)/projects/page.tsx                    MOD  select deliverables, defaultColor
src/app/(dashboard)/projects/[id]/page.tsx               MOD  deliverables panel, header dot
src/app/(dashboard)/page.tsx                             MOD  select deliverables
src/app/(dashboard)/tasks/page.tsx                       MOD  pass deliverables to TaskForm
src/app/(dashboard)/calendar/page.tsx                    MOD  pass deliverables to CalendarGrid→TaskForm
README.md                                                MOD  run migration 002
```

---

### Task 1: Pure logic — colors, deliverables, deliverable form

**Files:**
- Create: `src/lib/colors.ts`, `src/lib/colors.test.ts`, `src/lib/deliverables.ts`, `src/lib/deliverables.test.ts`, `src/lib/deliverable-form.ts`, `src/lib/deliverable-form.test.ts`
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Consumes: `round2(n: number): number` from `@/lib/finance`; `ParseResult<T>` from `@/lib/project-form`; `TaskStatus` from `@/types`
- Produces:
  - `PROJECT_COLORS: readonly string[]` (12 entries), `DEFAULT_PROJECT_COLOR = "#6366F1"`, `parseHexColor(raw: unknown): string | null`, `nextPaletteColor(used: string[]): string`
  - `type DeliverableStatus = "pending" | "ready" | "approved"`, `interface DeliverableStatusInfo { status: DeliverableStatus; openTasks: number; totalTasks: number; approvedWithOpenTasks: boolean }`, `deliverableStatus(d: { approved_at: string | null }, tasks: { status: TaskStatus }[]): DeliverableStatusInfo`, `projectProgress(ds: { weight: number | string; approved_at: string | null }[]): number | null`, `weightTotal(ds: { weight: number | string }[]): number`, `moveItem(ids: string[], id: string, direction: "up" | "down"): string[]`
  - `parseDeliverableForm(formData: FormData): ParseResult<{ title: string; weight: number }>`
  - `DELIVERABLE_STATUS_LABELS = { pending: "Pendiente", ready: "Listo para revisión", approved: "Aprobado" } as const` in constants

- [ ] **Step 1: Write failing tests for colors**

Create `src/lib/colors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_COLOR, PROJECT_COLORS, nextPaletteColor, parseHexColor } from "./colors";

describe("PROJECT_COLORS", () => {
  it("has 12 unique uppercase hex colors including the default", () => {
    expect(PROJECT_COLORS).toHaveLength(12);
    expect(new Set(PROJECT_COLORS).size).toBe(12);
    for (const c of PROJECT_COLORS) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    expect(PROJECT_COLORS).toContain(DEFAULT_PROJECT_COLOR);
  });
});

describe("parseHexColor", () => {
  it("accepts #RRGGBB and normalizes to uppercase", () => {
    expect(parseHexColor("#6366f1")).toBe("#6366F1");
    expect(parseHexColor("  #ABCDEF ")).toBe("#ABCDEF");
  });

  it("rejects anything else", () => {
    expect(parseHexColor("6366F1")).toBeNull();
    expect(parseHexColor("#FFF")).toBeNull();
    expect(parseHexColor("#GGGGGG")).toBeNull();
    expect(parseHexColor("red")).toBeNull();
    expect(parseHexColor("#6366F1; background:url(x)")).toBeNull();
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor(null)).toBeNull();
    expect(parseHexColor(123)).toBeNull();
  });
});

describe("nextPaletteColor", () => {
  it("returns the first palette color when none are used", () => {
    expect(nextPaletteColor([])).toBe(PROJECT_COLORS[0]);
  });

  it("skips used colors, case-insensitively", () => {
    expect(nextPaletteColor([PROJECT_COLORS[0].toLowerCase(), PROJECT_COLORS[1]])).toBe(PROJECT_COLORS[2]);
  });

  it("cycles by count when every palette color is used", () => {
    const all = [...PROJECT_COLORS];
    expect(nextPaletteColor(all)).toBe(PROJECT_COLORS[0]);
    expect(nextPaletteColor([...all, "#123456"])).toBe(PROJECT_COLORS[1]);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/lib/colors.test.ts`
Expected: FAIL — cannot resolve `./colors`.

- [ ] **Step 3: Implement colors**

Create `src/lib/colors.ts`:
```ts
/**
 * Project color palette. Mid-saturation colors that stay legible as dots,
 * stripes and progress bars in both light and dark themes.
 */
export const DEFAULT_PROJECT_COLOR = "#6366F1";

export const PROJECT_COLORS = [
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#84CC16", // lime
  "#22C55E", // green
  "#14B8A6", // teal
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#64748B", // slate
] as const;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Only "#RRGGBB" is accepted (it ends up in inline styles); returns uppercase or null. */
export function parseHexColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return HEX_RE.test(value) ? value.toUpperCase() : null;
}

/** First palette color not already used; cycles by count once all are taken. */
export function nextPaletteColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toUpperCase()));
  const free = PROJECT_COLORS.find((c) => !taken.has(c));
  return free ?? PROJECT_COLORS[used.length % PROJECT_COLORS.length];
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run src/lib/colors.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write failing tests for deliverables**

Create `src/lib/deliverables.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { deliverableStatus, moveItem, projectProgress, weightTotal } from "./deliverables";

const done = { status: "completed" as const };
const open = { status: "pending" as const };
const doing = { status: "in_progress" as const };

describe("deliverableStatus", () => {
  it("is pending with no linked tasks", () => {
    expect(deliverableStatus({ approved_at: null }, [])).toEqual({
      status: "pending", openTasks: 0, totalTasks: 0, approvedWithOpenTasks: false,
    });
  });

  it("is pending while any task is not completed", () => {
    expect(deliverableStatus({ approved_at: null }, [done, doing]).status).toBe("pending");
    expect(deliverableStatus({ approved_at: null }, [done, doing]).openTasks).toBe(1);
  });

  it("is ready when every linked task is completed", () => {
    expect(deliverableStatus({ approved_at: null }, [done, done])).toEqual({
      status: "ready", openTasks: 0, totalTasks: 2, approvedWithOpenTasks: false,
    });
  });

  it("is approved when approved_at is set, regardless of tasks", () => {
    expect(deliverableStatus({ approved_at: "2026-09-24T10:00:00Z" }, []).status).toBe("approved");
    expect(deliverableStatus({ approved_at: "2026-09-24T10:00:00Z" }, [done]).approvedWithOpenTasks).toBe(false);
  });

  it("flags an approved deliverable whose tasks were reopened", () => {
    expect(deliverableStatus({ approved_at: "2026-09-24T10:00:00Z" }, [done, open])).toEqual({
      status: "approved", openTasks: 1, totalTasks: 2, approvedWithOpenTasks: true,
    });
  });
});

describe("projectProgress", () => {
  it("is null without deliverables", () => {
    expect(projectProgress([])).toBeNull();
  });

  it("is 0 when nothing is approved", () => {
    expect(projectProgress([{ weight: 50, approved_at: null }, { weight: 50, approved_at: null }])).toBe(0);
  });

  it("sums approved weights, accepting numeric strings", () => {
    expect(
      projectProgress([
        { weight: "20.00", approved_at: "2026-09-24T10:00:00Z" },
        { weight: 30, approved_at: "2026-09-25T10:00:00Z" },
        { weight: 50, approved_at: null },
      ])
    ).toBe(50);
  });

  it("rounds to an integer", () => {
    expect(projectProgress([{ weight: 33.33, approved_at: "x" }, { weight: 66.67, approved_at: null }])).toBe(33);
  });

  it("clamps to 100 when weights overshoot", () => {
    expect(projectProgress([{ weight: 80, approved_at: "x" }, { weight: 40, approved_at: "y" }])).toBe(100);
  });

  it("treats non-numeric weights as 0", () => {
    expect(projectProgress([{ weight: "abc", approved_at: "x" }])).toBe(0);
  });
});

describe("weightTotal", () => {
  it("sums weights to 2 decimals", () => {
    expect(weightTotal([{ weight: "33.33" }, { weight: 33.33 }, { weight: 33.33 }])).toBe(99.99);
    expect(weightTotal([])).toBe(0);
  });
});

describe("moveItem", () => {
  const ids = ["a", "b", "c"];

  it("moves an item up or down by one", () => {
    expect(moveItem(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveItem(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("is a no-op at the edges or for unknown ids", () => {
    expect(moveItem(ids, "a", "up")).toEqual(ids);
    expect(moveItem(ids, "c", "down")).toEqual(ids);
    expect(moveItem(ids, "z", "up")).toEqual(ids);
  });

  it("does not mutate the input", () => {
    const input = [...ids];
    moveItem(input, "b", "up");
    expect(input).toEqual(ids);
  });
});
```

- [ ] **Step 6: Run to verify RED**

Run: `npx vitest run src/lib/deliverables.test.ts`
Expected: FAIL — cannot resolve `./deliverables`.

- [ ] **Step 7: Implement deliverables**

Create `src/lib/deliverables.ts`:
```ts
import { round2 } from "@/lib/finance";
import type { TaskStatus } from "@/types";

/**
 * Deliverable rules. Progress is never stored: it is derived from which
 * deliverables a partner has approved, so the % always has a paper trail.
 */

export type DeliverableStatus = "pending" | "ready" | "approved";

export interface DeliverableStatusInfo {
  status: DeliverableStatus;
  openTasks: number;
  totalTasks: number;
  /** Approved, but a linked task was reopened afterwards. Approval stands. */
  approvedWithOpenTasks: boolean;
}

function toNumber(value: number | string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function deliverableStatus(
  d: { approved_at: string | null },
  tasks: { status: TaskStatus }[]
): DeliverableStatusInfo {
  const totalTasks = tasks.length;
  const openTasks = tasks.filter((t) => t.status !== "completed").length;

  if (d.approved_at) {
    return { status: "approved", openTasks, totalTasks, approvedWithOpenTasks: openTasks > 0 };
  }
  const status: DeliverableStatus = totalTasks > 0 && openTasks === 0 ? "ready" : "pending";
  return { status, openTasks, totalTasks, approvedWithOpenTasks: false };
}

/** Σ weight of approved deliverables, clamped to 0..100 and rounded; null when there are none. */
export function projectProgress(
  deliverables: { weight: number | string; approved_at: string | null }[]
): number | null {
  if (deliverables.length === 0) return null;
  const approved = deliverables
    .filter((d) => d.approved_at)
    .reduce((sum, d) => sum + toNumber(d.weight), 0);
  return Math.min(100, Math.max(0, Math.round(round2(approved))));
}

export function weightTotal(deliverables: { weight: number | string }[]): number {
  return round2(deliverables.reduce((sum, d) => sum + toNumber(d.weight), 0));
}

/** New order with `id` swapped one step up/down; unchanged at the edges or if missing. */
export function moveItem(ids: string[], id: string, direction: "up" | "down"): string[] {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
```

- [ ] **Step 8: Run to verify GREEN**

Run: `npx vitest run src/lib/deliverables.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 9: Write failing tests for the deliverable form parser**

Create `src/lib/deliverable-form.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseDeliverableForm } from "./deliverable-form";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("parseDeliverableForm", () => {
  it("trims the title and parses the weight", () => {
    expect(parseDeliverableForm(fd({ title: "  Login  ", weight: "30" }))).toEqual({
      ok: true,
      values: { title: "Login", weight: 30 },
    });
  });

  it("rounds weight to 2 decimals and accepts 0 and 100", () => {
    expect(parseDeliverableForm(fd({ title: "A", weight: "33.333" }))).toEqual({
      ok: true, values: { title: "A", weight: 33.33 },
    });
    expect(parseDeliverableForm(fd({ title: "A", weight: "0" })).ok).toBe(true);
    expect(parseDeliverableForm(fd({ title: "A", weight: "100" })).ok).toBe(true);
  });

  it("requires a title", () => {
    expect(parseDeliverableForm(fd({ title: "   ", weight: "10" }))).toEqual({
      ok: false, error: "El título es obligatorio",
    });
  });

  it("rejects blank, non-numeric or out-of-range weights", () => {
    const error = { ok: false, error: "Peso inválido" };
    expect(parseDeliverableForm(fd({ title: "A", weight: "" }))).toEqual(error);
    expect(parseDeliverableForm(fd({ title: "A", weight: "abc" }))).toEqual(error);
    expect(parseDeliverableForm(fd({ title: "A", weight: "-1" }))).toEqual(error);
    expect(parseDeliverableForm(fd({ title: "A", weight: "100.5" }))).toEqual(error);
    expect(parseDeliverableForm(fd({ title: "A" }))).toEqual(error);
  });
});
```

- [ ] **Step 10: Run to verify RED**

Run: `npx vitest run src/lib/deliverable-form.test.ts`
Expected: FAIL — cannot resolve `./deliverable-form`.

- [ ] **Step 11: Implement the parser and the status labels**

Create `src/lib/deliverable-form.ts`:
```ts
import { round2 } from "@/lib/finance";
import type { ParseResult } from "@/lib/project-form";

export interface DeliverableFormValues {
  title: string;
  weight: number;
}

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parseDeliverableForm(formData: FormData): ParseResult<DeliverableFormValues> {
  const title = str(formData, "title");
  if (!title) return { ok: false, error: "El título es obligatorio" };

  const rawWeight = str(formData, "weight");
  const weight = rawWeight ? Number(rawWeight) : NaN;
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
    return { ok: false, error: "Peso inválido" };
  }

  return { ok: true, values: { title, weight: round2(weight) } };
}
```

Append to `src/lib/constants.ts`:
```ts
export const DELIVERABLE_STATUS_LABELS = {
  pending: "Pendiente",
  ready: "Listo para revisión",
  approved: "Aprobado",
} as const;
```

- [ ] **Step 12: Run to verify GREEN and full verification**

Run: `npx vitest run src/lib/deliverable-form.test.ts` → PASS (4 tests).
Then run the Global Constraints verification commands; all pass.

- [ ] **Step 13: Commit**

```bash
git add src/lib/colors.ts src/lib/colors.test.ts src/lib/deliverables.ts src/lib/deliverables.test.ts src/lib/deliverable-form.ts src/lib/deliverable-form.test.ts src/lib/constants.ts
git commit -m "feat: add pure logic for project colors and deliverable progress"
```

---

### Task 2: Migration 002, types, project color picker, computed progress

**Files:**
- Create: `supabase/migrations/002_project_color_deliverables.sql`, `src/components/projects/color-picker.tsx`, `src/components/projects/project-progress.tsx`
- Modify: `src/types/index.ts`, `src/lib/project-form.ts`, `src/lib/project-form.test.ts`, `src/lib/realtime.ts`, `src/components/ui/progress.tsx`, `src/components/projects/project-form.tsx`, `src/components/projects/project-edit-form.tsx`, `src/components/projects/project-card.tsx`, `src/components/dashboard/active-projects.tsx`, `src/app/(dashboard)/projects/page.tsx`, `src/app/(dashboard)/page.tsx`, `README.md`

**Interfaces:**
- Consumes: from Task 1 — `parseHexColor`, `nextPaletteColor`, `PROJECT_COLORS`, `DEFAULT_PROJECT_COLOR`, `projectProgress`
- Produces:
  - Types: `Project { ...; color: string; deliverables?: Deliverable[] }` (no `progress`), `Deliverable { id: string; project_id: string; title: string; weight: number; approved_at: string | null; approved_by: string | null; position: number; created_at: string; approver?: User | null }`, `Task { ...; deliverable_id: string | null; deliverable?: Deliverable | null }`
  - `ProjectFormValues` gains `color: string`, loses `progress`
  - `<Progress value indicatorColor?: string />`
  - `<ColorPicker name="color" defaultValue: string />`
  - `<ProjectProgressBar deliverables: { weight: number | string; approved_at: string | null }[]; color: string; showCount?: boolean />`
  - `<ProjectForm defaultColor: string />`
  - Pages that list projects select `"*, deliverables(id, weight, approved_at)"`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/002_project_color_deliverables.sql`:
```sql
-- Project color (shown across the app) and deliverable-based progress.
-- Progress is derived from approved deliverables in the app, so the manual
-- projects.progress column is dropped.

ALTER TABLE projects
  ADD COLUMN color TEXT NOT NULL DEFAULT '#6366F1'
  CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE projects DROP COLUMN progress;

CREATE TABLE deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  weight DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks
  ADD COLUMN deliverable_id UUID REFERENCES deliverables(id) ON DELETE SET NULL;

CREATE INDEX deliverables_project_id_idx ON deliverables(project_id);
CREATE INDEX tasks_deliverable_id_idx ON tasks(deliverable_id);

ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deliverables: full access" ON deliverables FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());

ALTER PUBLICATION supabase_realtime ADD TABLE deliverables;
```

In `README.md`, in the "Database setup" steps, after the line that runs `001_initial_schema.sql`, add: `3. Then run \`supabase/migrations/002_project_color_deliverables.sql\` the same way (migrations run in order).` and renumber the following steps.

In `src/lib/realtime.ts` change the tables constant to:
```ts
export const REALTIME_TABLES = ["projects", "project_links", "project_members", "tasks", "transactions", "deliverables"] as const;
```

- [ ] **Step 2: Update types**

In `src/types/index.ts`:
- In `Project`: delete `progress: number;`, add `color: string;` after `status`, and add `deliverables?: Deliverable[];` at the end.
- In `Task`: add `deliverable_id: string | null;` after `project_id`, and `deliverable?: Deliverable | null;` after `project?`.
- Add after `ProjectMember`:
```ts
export interface Deliverable {
  id: string;
  project_id: string;
  title: string;
  weight: number;
  approved_at: string | null;
  approved_by: string | null;
  position: number;
  created_at: string;
  approver?: User | null;
}
```

- [ ] **Step 3: Update project-form tests (RED)**

In `src/lib/project-form.test.ts`:
- In the `base` object replace `progress: "40",` with `color: "#6366f1",`.
- Delete the tests "does not include progress on create", "includes progress", "accepts progress 0 and 100", and "rejects out-of-range, fractional or blank progress".
- Add inside the `parseProjectForm` describe block(s) (one for create is enough, the parser is mode-independent for color):
```ts
  it("normalizes the color to uppercase hex", () => {
    const result = parseProjectForm(fd(base), "create");
    expect(result.ok && result.values.color).toBe("#6366F1");
  });

  it("rejects a missing or invalid color", () => {
    const error = { ok: false, error: "Color inválido" };
    const { color: _omit, ...noColor } = base;
    expect(parseProjectForm(fd(noColor), "create")).toEqual(error);
    expect(parseProjectForm(fd({ ...base, color: "red" }), "update")).toEqual(error);
    expect(parseProjectForm(fd({ ...base, color: "#FFF" }), "create")).toEqual(error);
  });

  it("never includes progress", () => {
    const result = parseProjectForm(fd({ ...base, progress: "40" } as Record<string, string>), "update");
    expect(result.ok && "progress" in result.values).toBe(false);
  });
```
If any other existing test asserts an exact `values` object, add `color: "#6366F1"` to its expected value.

Run: `npx vitest run src/lib/project-form.test.ts`
Expected: FAIL — color tests fail (`color` undefined / no "Color inválido").

- [ ] **Step 4: Update the parser (GREEN)**

In `src/lib/project-form.ts`:
- Add `import { parseHexColor } from "@/lib/colors";`
- In `ProjectFormValues`: remove `progress?: number;`, add `color: string;`.
- After the `production_cost` validation add:
```ts
  const color = parseHexColor(formData.get("color"));
  if (!color) return { ok: false, error: "Color inválido" };
```
- Build `values` as `{ name, client, status, start_date, end_date, budget, production_cost, color }`.
- Delete the whole `if (mode === "update") { ...progress... }` block. Keep the `mode` parameter (status fallback still depends on it).

Run: `npx vitest run src/lib/project-form.test.ts` → PASS.

- [ ] **Step 5: Progress bar color + shared components**

In `src/components/ui/progress.tsx`, change the component to accept an optional indicator color:
```tsx
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorColor?: string }
>(({ className, value, indicatorColor, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
        ...(indicatorColor ? { backgroundColor: indicatorColor } : {}),
      }}
    />
  </ProgressPrimitive.Root>
))
```

Create `src/components/projects/project-progress.tsx`:
```tsx
import { Progress } from "@/components/ui/progress";
import { projectProgress } from "@/lib/deliverables";

export function ProjectProgressBar({
  deliverables,
  color,
  showCount = true,
}: {
  deliverables: { weight: number | string; approved_at: string | null }[];
  color: string;
  showCount?: boolean;
}) {
  const progress = projectProgress(deliverables);

  if (progress === null) {
    return <p className="text-sm text-muted-foreground">Sin entregables</p>;
  }

  const approved = deliverables.filter((d) => d.approved_at).length;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>Progreso</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} indicatorColor={color} />
      {showCount && (
        <p className="text-xs text-muted-foreground">
          {approved} de {deliverables.length} entregables aprobados
        </p>
      )}
    </div>
  );
}
```

Create `src/components/projects/color-picker.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS, parseHexColor } from "@/lib/colors";

export function ColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [color, setColor] = useState(parseHexColor(defaultValue) ?? PROJECT_COLORS[0]);
  const isCustom = !(PROJECT_COLORS as readonly string[]).includes(color);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={color} />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color del proyecto">
        {PROJECT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center ring-offset-background transition",
              color === c && "ring-2 ring-ring ring-offset-2"
            )}
            style={{ backgroundColor: c }}
          >
            {color === c && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
        <label
          className={cn(
            "h-7 px-2 rounded-full border text-xs flex items-center gap-1 cursor-pointer",
            isCustom && "ring-2 ring-ring ring-offset-2"
          )}
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          Otro…
          <input
            type="color"
            className="sr-only"
            value={color.toLowerCase()}
            onChange={(e) => setColor(parseHexColor(e.target.value) ?? color)}
            aria-label="Color personalizado"
          />
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Project forms**

In `src/components/projects/project-form.tsx`:
- Import `ColorPicker` from `@/components/projects/color-picker`.
- Change signature to `export function ProjectForm({ defaultColor }: { defaultColor: string })`.
- Add after the Cliente field:
```tsx
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker name="color" defaultValue={defaultColor} />
          </div>
```

In `src/components/projects/project-edit-form.tsx`:
- Remove `const [progress, setProgress] = useState(project.progress);` (keep `useState` import for `deleting`).
- Delete the whole Progreso block (the `<div className="space-y-2">` containing the `progress` label, span and range input).
- Import `ColorPicker` and add after the Estado field:
```tsx
      <div className="space-y-2">
        <Label>Color</Label>
        <ColorPicker name="color" defaultValue={project.color} />
      </div>
```

In `src/app/(dashboard)/projects/page.tsx`:
- Change the list query to `supabase.from("projects").select("*, deliverables(id, weight, approved_at)")` (keep the existing order and filters).
- Fetch all colors for the default: `const { data: colorRows } = await supabase.from("projects").select("color");` (run it in the same `Promise.all` as the users query if convenient).
- Import `nextPaletteColor` from `@/lib/colors` and render `<ProjectForm defaultColor={nextPaletteColor((colorRows || []).map((r) => r.color))} />`.

- [ ] **Step 7: Computed progress on card and dashboard**

In `src/components/projects/project-card.tsx`:
- Remove the `Progress` import and the Progreso block (the `flex justify-between` row with `project.progress` and `<Progress value={project.progress} />`).
- Import `ProjectProgressBar` and render in its place: `<ProjectProgressBar deliverables={project.deliverables ?? []} color={project.color} />`.
- Add a color stripe to the card: `<Card className="hover:border-primary transition-colors cursor-pointer border-l-4" style={{ borderLeftColor: project.color }}>`.

In `src/components/dashboard/active-projects.tsx` replace the per-project block with:
```tsx
          <Link key={p.id} href={`/projects/${p.id}`} className="block space-y-1">
            <span className="font-medium text-sm">{p.name}</span>
            <ProjectProgressBar deliverables={p.deliverables ?? []} color={p.color} showCount={false} />
          </Link>
```
Remove the `Progress` import; import `ProjectProgressBar`.

In `src/app/(dashboard)/page.tsx` change `supabase.from("projects").select("*")` to `supabase.from("projects").select("*, deliverables(id, weight, approved_at)")`.

Run `grep -rn "progress" src --include="*.ts" --include="*.tsx" | grep -v "components/ui/" | grep -v in_progress` and fix any remaining reference to `project.progress` / `p.progress` / `values.progress`.

`npx tsc --noEmit` may now flag test fixtures typed as `Project` or `Task` (new required `color` / `deliverable_id`). Fix each by adding `color: "#6366F1"` or `deliverable_id: null` to the fixture — do not make the fields optional in the types.

- [ ] **Step 8: Verify**

Run the Global Constraints verification commands. All pass.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/002_project_color_deliverables.sql README.md src/types/index.ts src/lib/project-form.ts src/lib/project-form.test.ts src/lib/realtime.ts src/components/ui/progress.tsx src/components/projects/ src/components/dashboard/active-projects.tsx "src/app/(dashboard)/projects/page.tsx" "src/app/(dashboard)/page.tsx"
git commit -m "feat: add project color and deliverable-based progress schema"
```

---

### Task 3: Deliverable actions, deliverables panel, task↔deliverable link

**Files:**
- Create: `src/app/(dashboard)/projects/deliverable-actions.ts`, `src/components/projects/deliverables-panel.tsx`, `src/components/projects/deliverable-row.tsx`, `src/components/projects/deliverable-row.test.tsx`
- Modify: `src/app/(dashboard)/tasks/actions.ts`, `src/components/tasks/task-form.tsx`, `src/app/(dashboard)/projects/[id]/page.tsx`, `src/app/(dashboard)/tasks/page.tsx`, `src/app/(dashboard)/calendar/page.tsx`, `src/components/calendar/calendar-grid.tsx`

**Interfaces:**
- Consumes: Task 1 — `deliverableStatus`, `weightTotal`, `moveItem`, `parseDeliverableForm`, `DELIVERABLE_STATUS_LABELS`; finance — `exceedsHundred(total: number): boolean`, `isHundred(total: number): boolean`; Task 2 — `Deliverable`, `Task.deliverable_id`, `ProjectProgressBar`; existing — `createClient()` (async, `@/lib/supabase/server`), `actionError`, `SAVE_ERROR`, `DELETE_ERROR`, `LOAD_ERROR`, `TaskForm`
- Produces:
  - Server actions (all return `{ error: string } | undefined`): `createDeliverable(projectId: string, formData: FormData)`, `updateDeliverable(id: string, projectId: string, formData: FormData)`, `moveDeliverable(id: string, projectId: string, direction: "up" | "down")`, `approveDeliverable(id: string, projectId: string)`, `revokeDeliverable(id: string, projectId: string)`, `deleteDeliverable(id: string, projectId: string)`
  - `<TaskForm users projects defaultDueDate? deliverables?: Deliverable[] defaultProjectId?: string defaultDeliverableId?: string />`
  - `<DeliverablesPanel projectId color deliverables: Deliverable[] tasks: Task[] users: User[] projects: Project[] />`
  - `<DeliverableRow deliverable tasks: Task[] canMoveUp canMoveDown users projects deliverables />`

- [ ] **Step 1: Deliverable server actions**

Create `src/app/(dashboard)/projects/deliverable-actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exceedsHundred } from "@/lib/finance";
import { deliverableStatus, moveItem, weightTotal } from "@/lib/deliverables";
import { parseDeliverableForm } from "@/lib/deliverable-form";
import { actionError, SAVE_ERROR, DELETE_ERROR, LOAD_ERROR } from "@/lib/action-error";

const WEIGHT_SUM_ERROR = "La suma de pesos no puede exceder 100%";

/** Deliverables drive project progress, which is shown on the dashboard, projects and finance. */
function revalidateDashboard() {
  revalidatePath("/", "layout");
}

export async function createDeliverable(projectId: string, formData: FormData) {
  const parsed = parseDeliverableForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("deliverables")
    .select("weight, position")
    .eq("project_id", projectId);
  if (fetchError) return actionError("createDeliverable:fetch", fetchError, LOAD_ERROR);

  const rows = existing || [];
  if (exceedsHundred(weightTotal([...rows, { weight: parsed.values.weight }]))) {
    return { error: WEIGHT_SUM_ERROR };
  }
  const position = rows.reduce((max, r) => Math.max(max, r.position), -1) + 1;

  const { error } = await supabase
    .from("deliverables")
    .insert({ project_id: projectId, ...parsed.values, position });
  if (error) return actionError("createDeliverable", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function updateDeliverable(id: string, projectId: string, formData: FormData) {
  const parsed = parseDeliverableForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("deliverables")
    .select("id, weight")
    .eq("project_id", projectId);
  if (fetchError) return actionError("updateDeliverable:fetch", fetchError, LOAD_ERROR);

  const others = (existing || []).filter((d) => d.id !== id);
  if (exceedsHundred(weightTotal([...others, { weight: parsed.values.weight }]))) {
    return { error: WEIGHT_SUM_ERROR };
  }

  const { error } = await supabase
    .from("deliverables")
    .update(parsed.values)
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) return actionError("updateDeliverable", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function moveDeliverable(id: string, projectId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase
    .from("deliverables")
    .select("id")
    .eq("project_id", projectId)
    .order("position")
    .order("created_at");
  if (fetchError) return actionError("moveDeliverable:fetch", fetchError, LOAD_ERROR);

  const order = moveItem((rows || []).map((r) => r.id), id, direction);
  const results = await Promise.all(
    order.map((deliverableId, position) =>
      supabase.from("deliverables").update({ position }).eq("id", deliverableId).eq("project_id", projectId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return actionError("moveDeliverable", failed.error, SAVE_ERROR);
  revalidateDashboard();
}

export async function approveDeliverable(id: string, projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const [{ data: deliverable, error: dError }, { data: tasks, error: tError }] = await Promise.all([
    supabase.from("deliverables").select("approved_at").eq("id", id).eq("project_id", projectId).single(),
    supabase.from("tasks").select("status").eq("deliverable_id", id),
  ]);
  if (dError || !deliverable) return actionError("approveDeliverable:fetch", dError, LOAD_ERROR);
  if (tError) return actionError("approveDeliverable:tasks", tError, LOAD_ERROR);

  const { status } = deliverableStatus(deliverable, tasks || []);
  if (status === "approved") return { error: "El entregable ya está aprobado" };
  if (status !== "ready") return { error: "Aún hay pendientes abiertos" };

  const { error } = await supabase
    .from("deliverables")
    .update({ approved_at: new Date().toISOString(), approved_by: user.id })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) return actionError("approveDeliverable", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function revokeDeliverable(id: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("deliverables")
    .update({ approved_at: null, approved_by: null })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) return actionError("revokeDeliverable", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function deleteDeliverable(id: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("deliverables").delete().eq("id", id).eq("project_id", projectId);
  if (error) return actionError("deleteDeliverable", error, DELETE_ERROR);
  revalidateDashboard();
}
```

Note: `actionError(context, error, message)` accepts `unknown` for `error`; passing `null` when `.single()` returns no row is fine (it logs and returns the generic message).

- [ ] **Step 2: createTask accepts deliverable_id**

In `src/app/(dashboard)/tasks/actions.ts`, in `createTask`, replace the insert with:
```ts
  const project_id = normalizeProjectId(formData.get("project_id"));
  const deliverable_id = normalizeProjectId(formData.get("deliverable_id"));

  if (deliverable_id) {
    if (!project_id) return { error: "El entregable no pertenece a este proyecto" };
    const { data: deliverable, error: dError } = await supabase
      .from("deliverables")
      .select("id")
      .eq("id", deliverable_id)
      .eq("project_id", project_id)
      .maybeSingle();
    if (dError) return actionError("createTask:deliverable", dError, LOAD_ERROR);
    if (!deliverable) return { error: "El entregable no pertenece a este proyecto" };
  }

  const { error } = await supabase.from("tasks").insert({
    title,
    description: (formData.get("description") as string) || null,
    priority,
    due_date: (formData.get("due_date") as string) || null,
    project_id,
    deliverable_id,
    assigned_to,
    created_by: user.id,
  });
```
Add `LOAD_ERROR` to the `@/lib/action-error` import. (`normalizeProjectId` already maps `"none"`/empty → `null`; it is reused for the deliverable select, which also uses `"none"`.)

- [ ] **Step 3: TaskForm deliverable select**

In `src/components/tasks/task-form.tsx`:
- Import `Deliverable` type.
- Extend props:
```tsx
export function TaskForm({
  users,
  projects,
  defaultDueDate,
  deliverables = [],
  defaultProjectId,
  defaultDeliverableId,
}: {
  users: User[];
  projects: Project[];
  defaultDueDate?: string;
  deliverables?: Deliverable[];
  defaultProjectId?: string;
  defaultDeliverableId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "none");
  const projectDeliverables = deliverables.filter((d) => d.project_id === projectId);
```
- Make the project Select controlled: `<Select name="project_id" value={projectId} onValueChange={setProjectId}>`.
- After the grid containing "Asignar a" / "Proyecto (opcional)", add:
```tsx
          {projectId !== "none" && projectDeliverables.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="deliverable_id">Entregable (opcional)</Label>
              <Select key={projectId} name="deliverable_id" defaultValue={defaultDeliverableId ?? "none"}>
                <SelectTrigger id="deliverable_id"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin entregable</SelectItem>
                  {projectDeliverables.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
```
- In `handleSubmit`, on success also reset: `setProjectId(defaultProjectId ?? "none");` before `setOpen(false)`.

Pass deliverables wherever TaskForm is rendered:
- `src/app/(dashboard)/tasks/page.tsx`: add `supabase.from("deliverables").select("*").order("position")` to the existing `Promise.all`, and pass `deliverables={deliverables || []}` to `<TaskForm>`.
- `src/app/(dashboard)/calendar/page.tsx`: same query in its `Promise.all`; pass `deliverables={deliverables || []}` to `<CalendarGrid>`.
- `src/components/calendar/calendar-grid.tsx`: add prop `deliverables: Deliverable[]` and forward it to its `<TaskForm ... deliverables={deliverables} />`.

- [ ] **Step 4: Write the failing DeliverableRow test**

Create `src/components/projects/deliverable-row.test.tsx`:
```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Deliverable, Task } from "@/types";

vi.mock("@/app/(dashboard)/projects/deliverable-actions", () => ({
  approveDeliverable: vi.fn(),
  revokeDeliverable: vi.fn(),
  updateDeliverable: vi.fn(),
  moveDeliverable: vi.fn(),
  deleteDeliverable: vi.fn(),
}));
vi.mock("@/app/(dashboard)/tasks/actions", () => ({ createTask: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { DeliverableRow } from "./deliverable-row";

const deliverable: Deliverable = {
  id: "d1", project_id: "p1", title: "Login", weight: 30,
  approved_at: null, approved_by: null, position: 0, created_at: "2026-09-24T00:00:00Z",
};

function task(status: Task["status"]): Task {
  return {
    id: `t-${status}-${Math.random()}`, title: "T", description: null, priority: "medium", status,
    due_date: null, project_id: "p1", deliverable_id: "d1", assigned_to: "u1", created_by: "u1",
    created_at: "2026-09-24T00:00:00Z",
  };
}

function renderRow(d: Deliverable, tasks: Task[]) {
  return render(
    <DeliverableRow
      deliverable={d} tasks={tasks} canMoveUp={false} canMoveDown={false}
      users={[]} projects={[]} deliverables={[d]}
    />
  );
}

describe("DeliverableRow", () => {
  it("disables Aprobar while tasks are open", () => {
    renderRow(deliverable, [task("completed"), task("pending")]);
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("disables Aprobar when there are no linked tasks", () => {
    renderRow(deliverable, []);
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
  });

  it("enables Aprobar when every linked task is completed", () => {
    renderRow(deliverable, [task("completed"), task("completed")]);
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled();
    expect(screen.getByText("Listo para revisión")).toBeInTheDocument();
  });

  it("shows Revocar and the reopened warning for an approved deliverable", () => {
    renderRow({ ...deliverable, approved_at: "2026-09-24T10:00:00Z" }, [task("pending")]);
    expect(screen.queryByRole("button", { name: "Aprobar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Revocar" })).toBeInTheDocument();
    expect(screen.getByText("⚠️ Aprobado con pendientes abiertos")).toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/components/projects/deliverable-row.test.tsx`
Expected: FAIL — cannot resolve `./deliverable-row`.

- [ ] **Step 5: Implement DeliverableRow**

Create `src/components/projects/deliverable-row.tsx`:
```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TaskForm } from "@/components/tasks/task-form";
import { deliverableStatus } from "@/lib/deliverables";
import { DELIVERABLE_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  approveDeliverable,
  deleteDeliverable,
  moveDeliverable,
  revokeDeliverable,
  updateDeliverable,
} from "@/app/(dashboard)/projects/deliverable-actions";
import type { Deliverable, Project, Task, User } from "@/types";

const STATUS_ICON = { pending: "⬜", ready: "🟡", approved: "✅" } as const;

export function DeliverableRow({
  deliverable, tasks, canMoveUp, canMoveDown, users, projects, deliverables,
}: {
  deliverable: Deliverable;
  tasks: Task[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  users: User[];
  projects: Project[];
  deliverables: Deliverable[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const info = deliverableStatus(deliverable, tasks);
  const done = info.totalTasks - info.openTasks;
  const { id, project_id: projectId } = deliverable;

  async function run(action: () => Promise<{ error: string } | undefined>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result?.error) toast.error(result.error);
    return !result?.error;
  }

  async function handleSave(formData: FormData) {
    if (await run(() => updateDeliverable(id, projectId, formData))) setEditing(false);
  }

  function handleApprove() {
    if (!confirm(`¿Aprobar "${deliverable.title}"? Contará ${deliverable.weight}% al progreso.`)) return;
    run(() => approveDeliverable(id, projectId));
  }

  function handleDelete() {
    const note = info.totalTasks > 0 ? ` Sus ${info.totalTasks} pendientes quedarán sin entregable.` : "";
    if (!confirm(`¿Eliminar "${deliverable.title}"?${note}`)) return;
    run(() => deleteDeliverable(id, projectId));
  }

  return (
    <li className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Ocultar pendientes" : "Ver pendientes"}
          aria-expanded={expanded}
          className="text-muted-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span aria-hidden>{STATUS_ICON[info.status]}</span>

        {editing ? (
          <form action={handleSave} className="flex flex-1 items-center gap-2">
            <Input name="title" defaultValue={deliverable.title} required className="h-8" aria-label="Título" />
            <Input
              name="weight" type="number" step="0.01" min={0} max={100}
              defaultValue={deliverable.weight} required className="h-8 w-20 text-right" aria-label="Peso"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <Button type="submit" size="sm" disabled={busy}>Guardar</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </form>
        ) : (
          <>
            <span className="flex-1 font-medium">{deliverable.title}</span>
            <span className="text-sm tabular-nums">{Number(deliverable.weight)}%</span>
          </>
        )}
      </div>

      {!editing && (
        <div className="flex flex-wrap items-center gap-2 pl-10 text-sm">
          <Badge variant="outline">{DELIVERABLE_STATUS_LABELS[info.status]}</Badge>
          <span className="text-muted-foreground">{done}/{info.totalTasks}</span>
          {deliverable.approved_at && (
            <span className="text-muted-foreground">
              Aprobado {formatDate(deliverable.approved_at)}
              {deliverable.approver ? ` por ${deliverable.approver.name}` : ""}
            </span>
          )}
          {info.approvedWithOpenTasks && (
            <span className="text-amber-500">⚠️ Aprobado con pendientes abiertos</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {info.status === "approved" ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => revokeDeliverable(id, projectId))}>
                Revocar
              </Button>
            ) : (
              <Button size="sm" disabled={busy || info.status !== "ready"} onClick={handleApprove}>
                Aprobar
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Subir" disabled={!canMoveUp || busy}
              onClick={() => run(() => moveDeliverable(id, projectId, "up"))}>
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Bajar" disabled={!canMoveDown || busy}
              onClick={() => run(() => moveDeliverable(id, projectId, "down"))}>
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Editar" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Eliminar" disabled={busy} onClick={handleDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="pl-10 space-y-2">
          {tasks.length > 0 ? (
            <ul className="space-y-1">
              {tasks.map((t) => (
                <li key={t.id} className="flex justify-between text-sm">
                  <span className={t.status === "completed" ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                  <span className="text-muted-foreground">{TASK_STATUS_LABELS[t.status]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pendientes ligados</p>
          )}
          <TaskForm
            users={users}
            projects={projects}
            deliverables={deliverables}
            defaultProjectId={projectId}
            defaultDeliverableId={id}
          />
        </div>
      )}
    </li>
  );
}
```

Run: `npx vitest run src/components/projects/deliverable-row.test.tsx`
Expected: PASS (4 tests). If `toBeDisabled`/`toBeInTheDocument` are undefined, the jest-dom setup from `vitest.setup.ts` is not loaded — check `vitest.config.ts` `setupFiles` (it already exists for the notes tests).

- [ ] **Step 6: DeliverablesPanel**

Create `src/components/projects/deliverables-panel.tsx`:
```tsx
"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectProgressBar } from "@/components/projects/project-progress";
import { DeliverableRow } from "@/components/projects/deliverable-row";
import { isHundred } from "@/lib/finance";
import { weightTotal } from "@/lib/deliverables";
import { createDeliverable } from "@/app/(dashboard)/projects/deliverable-actions";
import type { Deliverable, Project, Task, User } from "@/types";

export function DeliverablesPanel({
  projectId, color, deliverables, tasks, users, projects,
}: {
  projectId: string;
  color: string;
  deliverables: Deliverable[];
  tasks: Task[];
  users: User[];
  projects: Project[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const total = weightTotal(deliverables);
  const unlinked = tasks.filter((t) => !t.deliverable_id).length;

  async function handleAdd(formData: FormData) {
    const result = await createDeliverable(projectId, formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    formRef.current?.reset();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold">Entregables</h3>
        <ProjectProgressBar deliverables={deliverables} color={color} />
        {deliverables.length > 0 && (
          <p className={isHundred(total) ? "text-xs text-muted-foreground" : "text-xs text-amber-500"}>
            {isHundred(total)
              ? `Suma de pesos: ${total}% ✅`
              : `Los pesos suman ${total}%, deben sumar 100%`}
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {deliverables.map((d, i) => (
          <DeliverableRow
            key={d.id}
            deliverable={d}
            tasks={tasks.filter((t) => t.deliverable_id === d.id)}
            canMoveUp={i > 0}
            canMoveDown={i < deliverables.length - 1}
            users={users}
            projects={projects}
            deliverables={deliverables}
          />
        ))}
      </ul>

      {unlinked > 0 && (
        <p className="text-xs text-muted-foreground">
          {unlinked === 1 ? "1 pendiente sin entregable" : `${unlinked} pendientes sin entregable`} (no afectan el progreso)
        </p>
      )}

      <form ref={formRef} action={handleAdd} className="flex items-center gap-2">
        <Input name="title" placeholder="Nuevo entregable" required aria-label="Título del entregable" />
        <Input
          name="weight" type="number" step="0.01" min={0} max={100} placeholder="%"
          required className="w-24 text-right" aria-label="Peso del entregable"
        />
        <Button type="submit" size="sm"><Plus className="h-4 w-4 mr-1" />Agregar</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 7: Wire the panel into the project detail page**

In `src/app/(dashboard)/projects/[id]/page.tsx`:
- Extend the `Promise.all` with two more queries (keep existing ones):
```ts
    supabase
      .from("deliverables")
      .select("*, approver:users!approved_by(*)")
      .eq("project_id", params.id)
      .order("position")
      .order("created_at"),
    supabase.from("projects").select("*").eq("status", "active").order("name"),
```
destructured as `{ data: deliverables }, { data: activeProjects }`.
- Import `DeliverablesPanel` and add, directly after the "Información general" card:
```tsx
      <Card>
        <CardContent className="pt-6">
          <DeliverablesPanel
            projectId={params.id}
            color={project.color}
            deliverables={deliverables || []}
            tasks={tasks || []}
            users={allUsers || []}
            projects={activeProjects || []}
          />
        </CardContent>
      </Card>
```

- [ ] **Step 8: Verify**

Run the Global Constraints verification commands. All pass (test output pristine, no act() warnings).

- [ ] **Step 9: Commit**

```bash
git add "src/app/(dashboard)/projects/deliverable-actions.ts" src/components/projects/deliverable-row.tsx src/components/projects/deliverable-row.test.tsx src/components/projects/deliverables-panel.tsx "src/app/(dashboard)/projects/[id]/page.tsx" "src/app/(dashboard)/tasks/actions.ts" src/components/tasks/task-form.tsx "src/app/(dashboard)/tasks/page.tsx" "src/app/(dashboard)/calendar/page.tsx" src/components/calendar/calendar-grid.tsx
git commit -m "feat: add deliverables panel with approval flow and task linking"
```

---

### Task 4: Show the project color across the app

**Files:**
- Create: `src/components/projects/project-dot.tsx`
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx`, `src/components/tasks/task-card.tsx`, `src/components/dashboard/urgent-tasks.tsx`, `src/components/calendar/calendar-grid.tsx`, `src/components/finance/project-breakdown.tsx`, `src/components/finance/transaction-table.tsx`

**Interfaces:**
- Consumes: `Project.color` (Task 2); `Task.project?: Project` and `Transaction.project?: Project` (already embedded by the existing `project:projects(*)` selects on tasks, calendar, dashboard and finance pages)
- Produces: `<ProjectDot color: string className?: string />`

- [ ] **Step 1: ProjectDot**

Create `src/components/projects/project-dot.tsx`:
```tsx
import { cn } from "@/lib/utils";

/** Small colored circle identifying a project. `color` is a DB-validated #RRGGBB. */
export function ProjectDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
```

- [ ] **Step 2: Apply the dot**

- `src/app/(dashboard)/projects/[id]/page.tsx`: in the header `<div className="flex items-center gap-4">`, render `<ProjectDot color={project.color} className="h-4 w-4" />` before the `<h1>`.
- `src/components/tasks/task-card.tsx` line with `{task.project && <span>· {task.project.name}</span>}` → 
```tsx
{task.project && (
  <span className="inline-flex items-center gap-1">· <ProjectDot color={task.project.color} />{task.project.name}</span>
)}
```
- `src/components/dashboard/urgent-tasks.tsx`: next to each task title, when `t.project` exists, render
```tsx
<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
  <ProjectDot color={t.project.color} />{t.project.name}
</span>
```
inside the same left-side flex container as the title (the page already selects `project:projects(*)`).
- `src/components/finance/project-breakdown.tsx`: inside the `<Link>` wrapping `{project.name}`, change it to `className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"` and put `<ProjectDot color={project.color} />` before the name.
- `src/components/finance/transaction-table.tsx`: replace `<TableCell>{t.project?.name}</TableCell>` with
```tsx
<TableCell>
  {t.project && (
    <span className="inline-flex items-center gap-2"><ProjectDot color={t.project.color} />{t.project.name}</span>
  )}
</TableCell>
```

- [ ] **Step 3: Calendar chip border**

In `src/components/calendar/calendar-grid.tsx`, the chip `style={{ backgroundColor: PRIORITY_COLORS[t.priority] }}` becomes:
```tsx
style={{
  backgroundColor: PRIORITY_COLORS[t.priority],
  ...(t.project ? { borderLeft: `3px solid ${t.project.color}` } : {}),
}}
```

- [ ] **Step 4: Verify**

Run the Global Constraints verification commands. All pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/project-dot.tsx "src/app/(dashboard)/projects/[id]/page.tsx" src/components/tasks/task-card.tsx src/components/dashboard/urgent-tasks.tsx src/components/calendar/calendar-grid.tsx src/components/finance/project-breakdown.tsx src/components/finance/transaction-table.tsx
git commit -m "feat: show project color in tasks, calendar, dashboard and finance"
```

---

### Task 5: Apply migration locally and verify end to end

**Files:** none (verification only; fix-ups go back to the owning task's files)

**Interfaces:**
- Consumes: local Supabase (`supabase start` already running; `.env.local` points at `http://127.0.0.1:54321`), dev server `npx next dev -p 3100`

- [ ] **Step 1: Apply pending migration without wiping data**

Run: `supabase migration up`
Expected: `Applying migration 002_project_color_deliverables.sql...` and no error. (Do NOT run `supabase db reset` — it deletes local data.)

- [ ] **Step 2: Schema smoke checks**

Run:
```bash
docker exec supabase_db_AJL-Group psql -U postgres -tAc "select column_name from information_schema.columns where table_name='projects' and column_name in ('color','progress');"
docker exec supabase_db_AJL-Group psql -U postgres -tAc "select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='deliverables';"
docker exec supabase_db_AJL-Group psql -U postgres -tAc "insert into projects(name, client, color) values ('x','y','red');" 2>&1 | head -1
```
Expected: only `color` listed; `1`; a `violates check constraint` error.

- [ ] **Step 3: End-to-end walkthrough (browser at http://localhost:3100, log in as leo@ajlgroup.com)**

1. /projects: existing project shows a color stripe and "Sin entregables". "Nuevo Proyecto" preselects the next unused palette color.
2. Project detail: change color → Guardar cambios → dot, stripe and bar use the new color.
3. Add entregables 20 / 30 / 50 → "Suma de pesos: 100% ✅"; adding another 10 is rejected with "La suma de pesos no puede exceder 100%".
4. Expand "Login" (30) → Nuevo Pendiente (project + entregable preselected) → create two tasks. Aprobar is disabled.
5. /tasks: mark both completed → back on detail, "Login" shows 🟡 Listo para revisión, Aprobar enabled → approve → Progreso 30%, "Aprobado <fecha> por Leo", card and dashboard show 30%.
6. Reopen one of those tasks → "⚠️ Aprobado con pendientes abiertos", progress stays 30%. Revocar → 0%.
7. Move entregables ↑↓ and reload → order persists. Delete one with tasks → confirmation mentions them; tasks remain, now "sin entregable".
8. Calendar chips of project tasks have the project-colored left border; finance breakdown and transactions show the dot.
9. Second browser (incognito) as alan@ajlgroup.com on the same project: approving in one window updates the other within a second (realtime).

- [ ] **Step 4: Record results**

If everything passes, no commit is needed. Any defect found goes back as a fix to the task that owns the file, re-verified with the Global Constraints commands.
