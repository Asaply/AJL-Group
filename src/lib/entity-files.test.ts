import { describe, expect, it } from "vitest";
import {
  DOC_TYPE_LABELS,
  describeFileLabel,
  parseFileMeta,
  storagePath,
  validateDocType,
} from "./entity-files";

const OWNER = "11111111-1111-1111-1111-111111111111";
const FILE_ID = "22222222-2222-2222-2222-222222222222";

describe("storagePath", () => {
  it("prefixes with the entity kind and owner id", () => {
    expect(storagePath("project", OWNER, "Contrato Final.pdf", FILE_ID)).toBe(
      `project/${OWNER}/${FILE_ID}-Contrato-Final.pdf`
    );
    expect(storagePath("client", OWNER, "nda.pdf", FILE_ID)).toBe(`client/${OWNER}/${FILE_ID}-nda.pdf`);
  });
});

describe("validateDocType", () => {
  it("accepts the fixed list", () => {
    for (const t of ["contrato", "acuerdo_nda", "cotizacion", "factura", "otro"]) {
      expect(validateDocType(t)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(validateDocType("random")).toBe(false);
    expect(validateDocType("")).toBe(false);
  });
});

describe("describeFileLabel", () => {
  it("uses the fixed label for known types", () => {
    expect(describeFileLabel({ doc_type: "contrato", custom_label: null })).toBe(DOC_TYPE_LABELS.contrato);
    expect(describeFileLabel({ doc_type: "factura", custom_label: "ignored" })).toBe(DOC_TYPE_LABELS.factura);
  });

  it("uses the custom label for 'otro', falling back to the fixed label if blank", () => {
    expect(describeFileLabel({ doc_type: "otro", custom_label: "Poder notarial" })).toBe("Poder notarial");
    expect(describeFileLabel({ doc_type: "otro", custom_label: null })).toBe(DOC_TYPE_LABELS.otro);
    expect(describeFileLabel({ doc_type: "otro", custom_label: "   " })).toBe(DOC_TYPE_LABELS.otro);
  });
});

describe("parseFileMeta", () => {
  const validMeta = {
    storage_path: `project/${OWNER}/${FILE_ID}-Contrato.pdf`,
    file_name: "Contrato.pdf",
    size_bytes: 1000,
    mime_type: "application/pdf",
    doc_type: "contrato",
    custom_label: null,
  };

  it("accepts a well-formed meta object", () => {
    const result = parseFileMeta("project", OWNER, validMeta);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.file_name).toBe("Contrato.pdf");
  });

  it("rejects a path for the wrong entity kind", () => {
    const result = parseFileMeta("client", OWNER, validMeta);
    expect(result).toEqual({ ok: false, error: "Ruta de archivo inválida" });
  });

  it("rejects a path for another owner", () => {
    const other = "33333333-3333-3333-3333-333333333333";
    const result = parseFileMeta("project", other, validMeta);
    expect(result).toEqual({ ok: false, error: "Ruta de archivo inválida" });
  });

  it("rejects path traversal via the file name segment", () => {
    const result = parseFileMeta("project", OWNER, {
      ...validMeta,
      storage_path: `project/${OWNER}/${FILE_ID}-../../secret`,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid doc_type", () => {
    const result = parseFileMeta("project", OWNER, { ...validMeta, doc_type: "made-up" });
    expect(result).toEqual({ ok: false, error: "Tipo de documento inválido" });
  });

  it("requires a non-empty custom_label when doc_type is 'otro'", () => {
    const result = parseFileMeta("project", OWNER, { ...validMeta, doc_type: "otro", custom_label: null });
    expect(result).toEqual({ ok: false, error: "Escribe una etiqueta para este tipo de archivo" });
  });

  it("accepts 'otro' with a trimmed custom_label", () => {
    const result = parseFileMeta("project", OWNER, {
      ...validMeta,
      doc_type: "otro",
      custom_label: "  Poder notarial  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.custom_label).toBe("Poder notarial");
  });

  it("ignores a custom_label sent for a fixed type", () => {
    const result = parseFileMeta("project", OWNER, { ...validMeta, custom_label: "should be dropped" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.custom_label).toBeNull();
  });

  it("rejects an oversized file", () => {
    const result = parseFileMeta("project", OWNER, { ...validMeta, size_bytes: 26214401 });
    expect(result).toEqual({ ok: false, error: "El archivo supera 25 MB" });
  });

  it("rejects a malformed meta object", () => {
    expect(parseFileMeta("project", OWNER, null)).toEqual({ ok: false, error: "Archivo inválido" });
    expect(parseFileMeta("project", OWNER, { ...validMeta, file_name: 5 })).toEqual({
      ok: false,
      error: "Archivo inválido",
    });
  });
});
