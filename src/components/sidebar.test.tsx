import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/app/(auth)/login/actions", () => ({ logout: vi.fn() }));
vi.mock("./theme-toggle", () => ({ ThemeToggle: () => null }));

import { Sidebar } from "./sidebar";

const user = {
  id: "u1", name: "Leo", email: "leo@example.com", avatar_url: null, created_at: "2026-09-24T00:00:00Z",
} as Parameters<typeof Sidebar>[0]["user"];

describe("Sidebar", () => {
  it("marks the clicked item active before the navigation lands", () => {
    render(<Sidebar user={user} />);
    const projects = screen.getByRole("link", { name: "Proyectos" });
    expect(projects).not.toHaveAttribute("aria-current");
    fireEvent.click(projects);
    expect(projects).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("leaves the active item alone on a modified (new tab) click", () => {
    render(<Sidebar user={user} />);
    const projects = screen.getByRole("link", { name: "Proyectos" });
    fireEvent.click(projects, { metaKey: true });
    expect(projects).not.toHaveAttribute("aria-current");
  });
});
