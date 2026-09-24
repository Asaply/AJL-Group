import { afterEach, describe, expect, it, vi } from "vitest";
import { actionError, isForeignKeyViolation, SAVE_ERROR } from "./action-error";

describe("actionError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the raw error server-side and returns only the generic message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = { message: 'duplicate key value violates unique constraint "users_email_key"', code: "23505" };
    expect(actionError("createProject", raw, SAVE_ERROR)).toEqual({ error: SAVE_ERROR });
    expect(spy).toHaveBeenCalledWith("[createProject]", raw);
  });
});

describe("isForeignKeyViolation", () => {
  it("detects Postgres code 23503", () => {
    expect(isForeignKeyViolation({ code: "23503", message: "x" })).toBe(true);
  });

  it("is false for other errors and non-objects", () => {
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation("23503")).toBe(false);
  });
});
