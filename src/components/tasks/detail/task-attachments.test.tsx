import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TaskDetail } from "@/types";

vi.mock("@/app/(dashboard)/tasks/detail-actions", () => ({
  registerAttachment: vi.fn().mockResolvedValue(undefined),
  deleteAttachment: vi.fn(),
  getAttachmentUrl: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

type UploadResolve = (value: { error: null }) => void;
let resolvers: UploadResolve[] = [];
const uploadMock = vi.fn(() => new Promise((resolve) => { resolvers.push(resolve as UploadResolve); }));
const removeMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ upload: uploadMock, remove: removeMock }),
    },
  }),
}));

import { TaskAttachments } from "./task-attachments";
import { registerAttachment } from "@/app/(dashboard)/tasks/detail-actions";

const detail = {
  task: { id: "t1" },
  attachments: [],
  currentUserId: "u1",
} as unknown as TaskDetail;

function makeFile(name: string) {
  return new File(["x"], name, { type: "image/png" });
}

describe("TaskAttachments", () => {
  beforeEach(() => {
    resolvers = [];
    uploadMock.mockClear();
    removeMock.mockClear();
  });

  it("tracks two concurrent same-named uploads independently, not by name", async () => {
    render(<TaskAttachments detail={detail} reload={vi.fn()} />);

    const input = screen.getByLabelText("Seleccionar archivos") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("photo.png"), makeFile("photo.png")] } });

    await waitFor(() => expect(screen.getAllByText(/Subiendo photo\.png/)).toHaveLength(2));
    await waitFor(() => expect(resolvers).toHaveLength(2));

    resolvers[0]({ error: null });

    await waitFor(() => expect(screen.getAllByText(/Subiendo photo\.png/)).toHaveLength(1));
  });

  it("clears the uploading row and removes the object when registering throws", async () => {
    vi.mocked(registerAttachment).mockRejectedValueOnce(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TaskAttachments detail={detail} reload={vi.fn()} />);

    const input = screen.getByLabelText("Seleccionar archivos") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("doc.png")] } });

    await waitFor(() => expect(resolvers).toHaveLength(1));
    resolvers[0]({ error: null });

    await waitFor(() => expect(screen.queryByText(/Subiendo doc\.png/)).not.toBeInTheDocument());
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock.mock.calls[0][0][0]).toMatch(/^t1\/[0-9a-f-]{36}-doc\.png$/);
    errorSpy.mockRestore();
  });
});
