import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_BYTES, formatFileSize, isImage, parseAttachmentMeta, sanitizeFileName, storagePath, validateUpload,
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

describe("parseAttachmentMeta", () => {
  const taskId = "11111111-1111-4111-8111-111111111111";
  const uuid = "22222222-2222-4222-8222-222222222222";
  const valid = {
    storage_path: `${taskId}/${uuid}-Mi-logo.png`,
    file_name: "Mi logo.png",
    size_bytes: 1024,
    mime_type: "image/png",
  };

  it("accepts the path the client builds", () => {
    expect(storagePath(taskId, "Mi logo.png", uuid)).toBe(valid.storage_path);
    expect(parseAttachmentMeta(taskId, valid)).toEqual({
      ok: true,
      value: { storage_path: valid.storage_path, file_name: "Mi logo.png", size_bytes: 1024, mime_type: "image/png" },
    });
  });

  it("normalizes an empty mime type to null, caps it at 255 chars and falls back on blank names", () => {
    const empty = parseAttachmentMeta(taskId, { ...valid, mime_type: "" });
    expect(empty.ok && empty.value.mime_type).toBeNull();
    const nul = parseAttachmentMeta(taskId, { ...valid, mime_type: null });
    expect(nul.ok && nul.value.mime_type).toBeNull();
    const long = parseAttachmentMeta(taskId, { ...valid, mime_type: "a".repeat(400) });
    expect(long.ok && long.value.mime_type).toHaveLength(255);
    const blank = parseAttachmentMeta(taskId, { ...valid, file_name: "   " });
    expect(blank.ok && blank.value.file_name).toBe("archivo");
  });

  it("rejects traversal out of the task folder", () => {
    expect(parseAttachmentMeta(taskId, { ...valid, storage_path: `${taskId}/../x` })).toEqual({
      ok: false,
      error: "Ruta de archivo inválida",
    });
    expect(parseAttachmentMeta(taskId, { ...valid, storage_path: `${taskId}/${uuid}-../x` })).toEqual({
      ok: false,
      error: "Ruta de archivo inválida",
    });
  });

  it("rejects another task's prefix", () => {
    const other = "33333333-3333-4333-8333-333333333333";
    expect(parseAttachmentMeta(taskId, { ...valid, storage_path: `${other}/${uuid}-Mi-logo.png` })).toEqual({
      ok: false,
      error: "Ruta de archivo inválida",
    });
  });

  it("rejects a non-uuid id segment", () => {
    expect(parseAttachmentMeta(taskId, { ...valid, storage_path: `${taskId}/abc-Mi-logo.png` })).toEqual({
      ok: false,
      error: "Ruta de archivo inválida",
    });
  });

  it("rejects a name segment that is not sanitized", () => {
    expect(parseAttachmentMeta(taskId, { ...valid, storage_path: `${taskId}/${uuid}-Mi logo.png` })).toEqual({
      ok: false,
      error: "Ruta de archivo inválida",
    });
    expect(parseAttachmentMeta(taskId, { ...valid, storage_path: `${taskId}/${uuid}-.env` })).toEqual({
      ok: false,
      error: "Ruta de archivo inválida",
    });
  });

  it("rejects non-string / non-number fields", () => {
    const bad = { ok: false, error: "Archivo inválido" };
    expect(parseAttachmentMeta(taskId, { ...valid, storage_path: 42 })).toEqual(bad);
    expect(parseAttachmentMeta(taskId, { ...valid, file_name: null })).toEqual(bad);
    expect(parseAttachmentMeta(taskId, { ...valid, size_bytes: "1024" })).toEqual(bad);
    expect(parseAttachmentMeta(taskId, { ...valid, mime_type: 7 })).toEqual(bad);
    expect(parseAttachmentMeta(taskId, null)).toEqual(bad);
    expect(parseAttachmentMeta(taskId, "x")).toEqual(bad);
  });

  it("rejects empty or oversize files", () => {
    const tooBig = { ok: false, error: "El archivo supera 25 MB" };
    expect(parseAttachmentMeta(taskId, { ...valid, size_bytes: MAX_ATTACHMENT_BYTES + 1 })).toEqual(tooBig);
    expect(parseAttachmentMeta(taskId, { ...valid, size_bytes: 0 })).toEqual(tooBig);
    expect(parseAttachmentMeta(taskId, { ...valid, size_bytes: Number.NaN })).toEqual(tooBig);
    expect(parseAttachmentMeta(taskId, { ...valid, size_bytes: MAX_ATTACHMENT_BYTES }).ok).toBe(true);
  });
});
