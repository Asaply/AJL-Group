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
});
