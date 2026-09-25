import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ProjectFile } from "@/types";
import type { EntityFileActions } from "./file-manager";

// Radix's Select needs browser layout APIs jsdom doesn't implement
// (scrollIntoView, hasPointerCapture); this repo's precedent (see
// client-filters.test.tsx) is a native <select> with the same value/
// onValueChange contract. This component always composes Select as
// <Select><SelectTrigger aria-label>…</SelectTrigger><SelectContent>…</SelectContent></Select>,
// so the mock lifts the trigger's aria-label onto the native element.
vi.mock("@/components/ui/select", () => {
  function Select({
    value, onValueChange, children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) {
    const trigger = Children.toArray(children)[0] as ReactElement<{ "aria-label"?: string }> | undefined;
    const ariaLabel = trigger && isValidElement(trigger) ? trigger.props["aria-label"] : undefined;
    return (
      <select aria-label={ariaLabel} value={value} onChange={(e) => onValueChange(e.target.value)}>
        {children}
      </select>
    );
  }
  function Passthrough({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  function SelectItem({ value, children }: { value: string; children: ReactNode }) {
    return <option value={value}>{children}</option>;
  }
  return { Select, SelectTrigger: Passthrough, SelectContent: Passthrough, SelectValue: () => null, SelectItem };
});

type UploadResolve = (value: { error: null }) => void;
let resolvers: UploadResolve[] = [];
const uploadMock = vi.fn(() => new Promise((resolve) => { resolvers.push(resolve as UploadResolve); }));
const removeMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ upload: uploadMock, remove: removeMock }) } }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { FileManager } from "./file-manager";
import { toast } from "sonner";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

function makeFile(name: string) {
  return new File(["x"], name, { type: "application/pdf" });
}

function makeActions(overrides: Partial<EntityFileActions> = {}): EntityFileActions {
  return {
    register: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    updateType: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn().mockResolvedValue({ url: "https://signed.example/file" }),
    ...overrides,
  };
}

const contract: ProjectFile = {
  id: "f1", project_id: PROJECT_ID, storage_path: "project/x/f1-contrato.pdf",
  file_name: "contrato.pdf", size_bytes: 2048, mime_type: "application/pdf",
  doc_type: "contrato", custom_label: null, uploaded_by: "u1",
  created_at: "2026-09-25T00:00:00Z", deleted_at: null, deleted_by: null,
  uploader: { id: "u1", name: "Leo", email: "leo@x.com", avatar_url: null, created_at: "x" },
};

describe("FileManager", () => {
  beforeEach(() => {
    resolvers = [];
    uploadMock.mockClear();
    removeMock.mockClear();
  });

  it("shows the file's type badge from its doc_type", () => {
    render(<FileManager entity="project" ownerId={PROJECT_ID} files={[contract]} actions={makeActions()} reload={vi.fn()} />);
    expect(screen.getByLabelText("Cambiar tipo de contrato.pdf")).toHaveTextContent("Contrato");
  });

  it("uploads with the selected doc type and reloads", async () => {
    const actions = makeActions();
    const reload = vi.fn();
    render(<FileManager entity="project" ownerId={PROJECT_ID} files={[]} actions={actions} reload={reload} />);

    fireEvent.change(screen.getByLabelText("Tipo de documento a subir"), { target: { value: "factura" } });

    const input = screen.getByLabelText("Seleccionar archivos") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("f1.pdf")] } });

    await waitFor(() => expect(resolvers).toHaveLength(1));
    resolvers[0]({ error: null });

    await waitFor(() =>
      expect(actions.register).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({ file_name: "f1.pdf", doc_type: "factura", custom_label: null })
      )
    );
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("requires a label before uploading as 'otro'", () => {
    const actions = makeActions();
    render(<FileManager entity="project" ownerId={PROJECT_ID} files={[]} actions={actions} reload={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tipo de documento a subir"), { target: { value: "otro" } });

    const input = screen.getByLabelText("Seleccionar archivos") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("x.pdf")] } });

    expect(toast.error).toHaveBeenCalledWith("Escribe una etiqueta para este tipo de archivo");
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("shows a deleted file struck through with who deleted it, and no action buttons", () => {
    const deleted: ProjectFile = {
      ...contract, id: "f2", deleted_at: "2026-09-26T00:00:00Z", deleted_by: "u2",
      deleter: { id: "u2", name: "Jaziel", email: "j@x.com", avatar_url: null, created_at: "x" },
    };
    render(<FileManager entity="project" ownerId={PROJECT_ID} files={[deleted]} actions={makeActions()} reload={vi.fn()} />);
    expect(screen.getByText(/Eliminado por Jaziel/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Eliminar archivo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Descargar archivo")).not.toBeInTheDocument();
  });

  it("deletes a file after confirmation and reloads", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const actions = makeActions();
    const reload = vi.fn();
    render(<FileManager entity="project" ownerId={PROJECT_ID} files={[contract]} actions={actions} reload={reload} />);
    fireEvent.click(screen.getByLabelText("Eliminar archivo"));
    await waitFor(() => expect(actions.softDelete).toHaveBeenCalledWith("f1", PROJECT_ID));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("does not delete without confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const actions = makeActions();
    render(<FileManager entity="project" ownerId={PROJECT_ID} files={[contract]} actions={actions} reload={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Eliminar archivo"));
    expect(actions.softDelete).not.toHaveBeenCalled();
  });

  it("changes a file's type inline", async () => {
    const actions = makeActions();
    const reload = vi.fn();
    render(<FileManager entity="project" ownerId={PROJECT_ID} files={[contract]} actions={actions} reload={reload} />);
    fireEvent.click(screen.getByLabelText("Cambiar tipo de contrato.pdf"));
    fireEvent.change(screen.getByLabelText("Tipo de contrato.pdf"), { target: { value: "cotizacion" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(actions.updateType).toHaveBeenCalledWith("f1", PROJECT_ID, "cotizacion", null));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("downloads via a signed URL", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const actions = makeActions();
    render(<FileManager entity="project" ownerId={PROJECT_ID} files={[contract]} actions={actions} reload={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Descargar archivo"));
    await waitFor(() => expect(actions.getUrl).toHaveBeenCalledWith("f1", PROJECT_ID, true));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://signed.example/file", "_blank", "noopener,noreferrer"));
    open.mockRestore();
  });
});
