import { describe, expect, it } from "vitest";
import { parseProfileForm } from "./profile";

describe("parseProfileForm", () => {
  it("trims name and returns it", () => {
    const formData = new FormData();
    formData.append("name", "  John  ");
    formData.append("avatar_url", "");

    const result = parseProfileForm(formData);
    expect(result).toEqual({
      ok: true,
      name: "John",
      avatar_url: null,
    });
  });

  it("returns error for blank name", () => {
    const formData = new FormData();
    formData.append("name", "   ");
    formData.append("avatar_url", "");

    const result = parseProfileForm(formData);
    expect(result).toEqual({
      ok: false,
      error: "El nombre es obligatorio",
    });
  });

  it("returns null for empty avatar_url", () => {
    const formData = new FormData();
    formData.append("name", "John");
    formData.append("avatar_url", "");

    const result = parseProfileForm(formData);
    expect(result).toEqual({
      ok: true,
      name: "John",
      avatar_url: null,
    });
  });

  it("accepts https URL", () => {
    const formData = new FormData();
    formData.append("name", "John");
    formData.append("avatar_url", "https://example.com/avatar.jpg");

    const result = parseProfileForm(formData);
    expect(result).toEqual({
      ok: true,
      name: "John",
      avatar_url: "https://example.com/avatar.jpg",
    });
  });

  it("accepts http URL", () => {
    const formData = new FormData();
    formData.append("name", "John");
    formData.append("avatar_url", "http://example.com/avatar.jpg");

    const result = parseProfileForm(formData);
    expect(result).toEqual({
      ok: true,
      name: "John",
      avatar_url: "http://example.com/avatar.jpg",
    });
  });

  it("rejects javascript: URL", () => {
    const formData = new FormData();
    formData.append("name", "John");
    formData.append("avatar_url", "javascript:alert(1)");

    const result = parseProfileForm(formData);
    expect(result).toEqual({
      ok: false,
      error: "La URL del avatar no es válida",
    });
  });

  it("rejects ftp:// URL", () => {
    const formData = new FormData();
    formData.append("name", "John");
    formData.append("avatar_url", "ftp://example.com/avatar.jpg");

    const result = parseProfileForm(formData);
    expect(result).toEqual({
      ok: false,
      error: "La URL del avatar no es válida",
    });
  });

  it("rejects garbage string as URL", () => {
    const formData = new FormData();
    formData.append("name", "John");
    formData.append("avatar_url", "not a url");

    const result = parseProfileForm(formData);
    expect(result).toEqual({
      ok: false,
      error: "La URL del avatar no es válida",
    });
  });
});
