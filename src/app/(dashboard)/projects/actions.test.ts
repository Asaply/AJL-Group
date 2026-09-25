import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type Resp = { data?: unknown; error?: unknown };
type Call = { table: string; method: string; args: unknown[] };

/**
 * Minimal chainable fake for the Supabase query builder, local to this file.
 * Responses are keyed by `"<table>.<terminal-method>"`, where the terminal
 * method is whichever of select/update/delete/insert was called first in the
 * chain (matching how the real builder resolves once awaited).
 */
function makeSupabase(responses: Record<string, Resp>) {
  const calls: Call[] = [];

  function from(table: string) {
    let method = "";
    const resolved = () => responses[`${table}.${method}`] ?? { data: null, error: null };
    const builder: PromiseLike<Resp> & Record<string, unknown> = {
      select: (...args: unknown[]) => {
        if (!method) method = "select";
        calls.push({ table, method: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        calls.push({ table, method: "eq", args });
        return builder;
      },
      update: (...args: unknown[]) => {
        method = "update";
        calls.push({ table, method: "update", args });
        return builder;
      },
      delete: (...args: unknown[]) => {
        method = "delete";
        calls.push({ table, method: "delete", args });
        return builder;
      },
      insert: (...args: unknown[]) => {
        method = "insert";
        calls.push({ table, method: "insert", args });
        return builder;
      },
      maybeSingle: async () => resolved(),
      then: (onFulfilled, onRejected) => Promise.resolve(resolved()).then(onFulfilled, onRejected),
    } as PromiseLike<Resp> & Record<string, unknown>;
    return builder;
  }

  return { supabase: { from }, calls };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

function fd(overrides: Record<string, string> = {}): FormData {
  const f = new FormData();
  const base = {
    name: "Video",
    client_id: "c2",
    status: "active",
    start_date: "2026-01-01",
    end_date: "",
    budget: "1000",
    production_cost: "200",
    color: "#6366F1",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) f.append(k, v);
  return f;
}

function findCalls(calls: Call[], table: string, method: string) {
  return calls.filter((c) => c.table === table && c.method === method);
}

describe("updateProject", () => {
  it("deletes project_contacts when the client changes to a different existing client", async () => {
    const { supabase, calls } = makeSupabase({
      "clients.select": { data: { id: "c2" }, error: null }, // clientExists(c2)
      "projects.select": { data: { client_id: "c1" }, error: null }, // current project
      "projects.update": { error: null },
      "project_contacts.delete": { error: null },
    });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const { updateProject } = await import("./actions");
    const result = await updateProject("p1", fd({ client_id: "c2" }));

    expect(result).toBeUndefined();
    const deletes = findCalls(calls, "project_contacts", "delete");
    expect(deletes).toHaveLength(1);
    const eqAfterDelete = calls.filter((c) => c.table === "project_contacts" && c.method === "eq");
    expect(eqAfterDelete).toEqual([{ table: "project_contacts", method: "eq", args: ["project_id", "p1"] }]);
  });

  it("does not delete project_contacts when the client is unchanged", async () => {
    const { supabase, calls } = makeSupabase({
      "clients.select": { data: { id: "c1" }, error: null },
      "projects.select": { data: { client_id: "c1" }, error: null },
      "projects.update": { error: null },
    });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const { updateProject } = await import("./actions");
    const result = await updateProject("p1", fd({ client_id: "c1" }));

    expect(result).toBeUndefined();
    expect(findCalls(calls, "project_contacts", "delete")).toHaveLength(0);
  });

  it("returns 'Cliente no encontrado' and skips the update when the client_id does not exist", async () => {
    const { supabase, calls } = makeSupabase({
      "clients.select": { data: null, error: null }, // client not found
    });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const { updateProject } = await import("./actions");
    const result = await updateProject("p1", fd({ client_id: "c-missing" }));

    expect(result).toEqual({ error: "Cliente no encontrado" });
    expect(findCalls(calls, "projects", "update")).toHaveLength(0);
    expect(findCalls(calls, "project_contacts", "delete")).toHaveLength(0);
  });
});
