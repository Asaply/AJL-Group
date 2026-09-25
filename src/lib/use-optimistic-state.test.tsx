import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { toast } from "sonner";
import { useOptimisticState } from "./use-optimistic-state";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("useOptimisticState", () => {
  it("shows the change before the server answers", async () => {
    const d = deferred<undefined>();
    const { result } = renderHook(({ server }) => useOptimisticState(server), { initialProps: { server: 1 } });
    let pending!: Promise<boolean>;
    act(() => { pending = result.current[1](() => 2, () => d.promise); });
    expect(result.current[0]).toBe(2);
    await act(async () => { d.resolve(undefined); await pending; });
    expect(result.current[0]).toBe(2);
  });

  it("rolls back and toasts when the server fails", async () => {
    const { result } = renderHook(({ server }) => useOptimisticState(server), { initialProps: { server: 1 } });
    let ok!: boolean;
    await act(async () => { ok = await result.current[1](() => 2, async () => ({ error: "Falló" })); });
    expect(ok).toBe(false);
    expect(result.current[0]).toBe(1);
    expect(toast.error).toHaveBeenCalledWith("Falló");
  });

  it("ignores server updates while a change is in flight, then adopts them", async () => {
    const d = deferred<undefined>();
    const { result, rerender } = renderHook(({ server }) => useOptimisticState(server), { initialProps: { server: 1 } });
    let pending!: Promise<boolean>;
    act(() => { pending = result.current[1](() => 2, () => d.promise); });
    rerender({ server: 5 });
    expect(result.current[0]).toBe(2);
    await act(async () => { d.resolve(undefined); await pending; });
    // The refresh that arrived mid-flight is older than the change; keep the change
    // until the next server value lands.
    expect(result.current[0]).toBe(2);
    rerender({ server: 6 });
    expect(result.current[0]).toBe(6);
  });

  it("rolls back to the latest server value, not the stale one", async () => {
    const d = deferred<{ error: string }>();
    const { result, rerender } = renderHook(({ server }) => useOptimisticState(server), { initialProps: { server: 1 } });
    let pending!: Promise<boolean>;
    act(() => { pending = result.current[1](() => 2, () => d.promise); });
    rerender({ server: 3 });
    await act(async () => { d.resolve({ error: "x" }); await pending; });
    expect(result.current[0]).toBe(3);
  });

  it("rolls back when the action throws", async () => {
    const { result } = renderHook(({ server }) => useOptimisticState(server), { initialProps: { server: 1 } });
    await act(async () => { await result.current[1](() => 2, async () => { throw new Error("red"); }); });
    expect(result.current[0]).toBe(1);
  });
});
