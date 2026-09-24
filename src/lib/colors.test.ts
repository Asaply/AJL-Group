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
