import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createDebouncedRefresh } from "./realtime";

describe("createDebouncedRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("single trigger → one call after delay", () => {
    const refresh = vi.fn();
    const debounced = createDebouncedRefresh(refresh, 300);

    debounced.trigger();
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("burst of 5 → one call", () => {
    const refresh = vi.fn();
    const debounced = createDebouncedRefresh(refresh, 300);

    debounced.trigger();
    debounced.trigger();
    debounced.trigger();
    debounced.trigger();
    debounced.trigger();

    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("no call before delay elapses", () => {
    const refresh = vi.fn();
    const debounced = createDebouncedRefresh(refresh, 300);

    debounced.trigger();
    vi.advanceTimersByTime(299);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("cancel prevents call", () => {
    const refresh = vi.fn();
    const debounced = createDebouncedRefresh(refresh, 300);

    debounced.trigger();
    debounced.cancel();

    vi.advanceTimersByTime(300);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("two bursts separated > delay → two calls", () => {
    const refresh = vi.fn();
    const debounced = createDebouncedRefresh(refresh, 300);

    debounced.trigger();
    debounced.trigger();
    vi.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledOnce();

    debounced.trigger();
    debounced.trigger();
    vi.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
