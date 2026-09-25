import { describe, expect, it } from "vitest";
import { MAX_LOGO_BYTES, logoPath, logoUrl, parseLogoPath, validateLogo } from "./client-logo";

const CLIENT = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("validateLogo", () => {
  it("accepts png/jpeg/webp up to 2 MB", () => {
    expect(MAX_LOGO_BYTES).toBe(2097152);
    expect(validateLogo({ size: MAX_LOGO_BYTES, type: "image/png" })).toBeNull();
    expect(validateLogo({ size: 10, type: "image/jpeg" })).toBeNull();
    expect(validateLogo({ size: 10, type: "image/webp" })).toBeNull();
  });
  it("rejects other types, empty and oversize files", () => {
    const msg = "El logo debe ser PNG, JPG o WEBP de máximo 2 MB";
    expect(validateLogo({ size: 10, type: "image/svg+xml" })).toBe(msg);
    expect(validateLogo({ size: 10, type: "image/gif" })).toBe(msg);
    expect(validateLogo({ size: 0, type: "image/png" })).toBe(msg);
    expect(validateLogo({ size: MAX_LOGO_BYTES + 1, type: "image/png" })).toBe(msg);
  });
});

describe("logoPath / parseLogoPath", () => {
  it("builds and accepts the exact path", () => {
    const path = logoPath(CLIENT, ID, "image/jpeg");
    expect(path).toBe(`${CLIENT}/${ID}.jpg`);
    expect(parseLogoPath(CLIENT, path)).toBe(path);
  });
  it("rejects traversal, other clients, bad ids and extensions", () => {
    expect(parseLogoPath(CLIENT, `${CLIENT}/../${OTHER}/${ID}.png`)).toBeNull();
    expect(parseLogoPath(CLIENT, `${OTHER}/${ID}.png`)).toBeNull();
    expect(parseLogoPath(CLIENT, `${CLIENT}/not-a-uuid.png`)).toBeNull();
    expect(parseLogoPath(CLIENT, `${CLIENT}/${ID}.svg`)).toBeNull();
    expect(parseLogoPath(CLIENT, 42)).toBeNull();
    expect(parseLogoPath("not-a-uuid", `not-a-uuid/${ID}.png`)).toBeNull();
  });
});

describe("logoUrl", () => {
  it("builds the public URL or null", () => {
    expect(logoUrl(`${CLIENT}/${ID}.png`, "http://127.0.0.1:54321")).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/client-logos/${CLIENT}/${ID}.png`
    );
    expect(logoUrl(null, "http://x")).toBeNull();
  });
});
