import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientCard } from "./client-card";
import type { Client } from "@/types";

const client = {
  id: "c1", name: "Dr.Alejandro Nevarez", status: "prospect", industry: "Salud", city: "Monterrey",
  logo_path: null,
  contacts: [
    { id: "k1", name: "Ana López", is_primary: true },
    { id: "k2", name: "Luis", is_primary: false },
  ],
  projects: [{ id: "p1", status: "active" }, { id: "p2", status: "completed" }],
} as unknown as Client;

describe("ClientCard", () => {
  it("shows initials, status, primary contact and project counts", () => {
    render(<ClientCard client={client} />);
    expect(screen.getByText("AN")).toBeInTheDocument();
    expect(screen.getByText("Prospecto")).toBeInTheDocument();
    expect(screen.getByText("Salud · Monterrey")).toBeInTheDocument();
    expect(screen.getByText("Ana López (principal)")).toBeInTheDocument();
    expect(screen.getByText("2 proyectos (1 activo)")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/clients/c1");
  });

  it("handles no contacts and singular project", () => {
    render(<ClientCard client={{ ...client, contacts: [], projects: [{ id: "p1", status: "paused" }] } as unknown as Client} />);
    expect(screen.getByText("Sin contactos")).toBeInTheDocument();
    expect(screen.getByText("1 proyecto (0 activos)")).toBeInTheDocument();
  });
});
