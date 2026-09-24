import { describe, expect, it } from "vitest";
import { parseHttpUrl } from "./url";

describe("parseHttpUrl", () => {
  it("accepts an https URL", () => {
    expect(parseHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
  });

  it("accepts an http URL", () => {
    expect(parseHttpUrl("http://example.com")).toBe("http://example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(parseHttpUrl("  https://example.com/x  ")).toBe("https://example.com/x");
  });

  it("rejects javascript: URLs", () => {
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("  JavaScript:alert(document.cookie)")).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(parseHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects ftp: URLs", () => {
    expect(parseHttpUrl("ftp://example.com/file")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseHttpUrl("not a url")).toBeNull();
  });

  it("rejects blank strings", () => {
    expect(parseHttpUrl("")).toBeNull();
    expect(parseHttpUrl("   ")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(parseHttpUrl(null)).toBeNull();
    expect(parseHttpUrl(undefined)).toBeNull();
    expect(parseHttpUrl(42)).toBeNull();
  });
});
