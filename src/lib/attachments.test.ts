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
