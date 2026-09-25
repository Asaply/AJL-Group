import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ClientContact } from "@/types";

const setPrimaryContact = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/(dashboard)/clients/actions", () => ({
  setPrimaryContact: (...a: unknown[]) => setPrimaryContact(...a),
  addContact: vi.fn(), updateContact: vi.fn(), deleteContact: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { ClientContacts } from "./client-contacts";

const contacts = [
  { id: "k1", client_id: "c1", name: "Ana", position: "Directora", email: "ana@acme.mx", phone: "8112345678", whatsapp: "81 1234 5678", notes: null, is_primary: true, created_at: "x",
    project_contacts: [{ id: "pc1", project_id: "p1", contact_id: "k1", role: "Aprueba diseño", created_at: "x", project: { id: "p1", name: "kairos", color: "#6366F1" } }] },
  { id: "k2", client_id: "c1", name: "Luis", position: null, email: null, phone: null, whatsapp: null, notes: null, is_primary: false, created_at: "x", project_contacts: [] },
] as ClientContact[];

const maliciousContacts = [
  { id: "k3", client_id: "c1", name: "Eve", position: null, email: "a@b.mx?bcc=x@evil.com", phone: null, whatsapp: null, notes: null, is_primary: false, created_at: "x", project_contacts: [] },
] as ClientContact[];

describe("ClientContacts", () => {
  it("renders contact links and project roles", () => {
    render(<ClientContacts clientId="c1" contacts={contacts} />);
    expect(screen.getByRole("link", { name: "ana@acme.mx" })).toHaveAttribute("href", "mailto:ana@acme.mx");
    expect(screen.getByRole("link", { name: "WhatsApp de Ana" })).toHaveAttribute("href", "https://wa.me/528112345678");
    expect(screen.getByText("kairos: Aprueba diseño")).toBeInTheDocument();
  });

  it("marks a contact as primary", async () => {
    render(<ClientContacts clientId="c1" contacts={contacts} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar a Luis como principal" }));
    await waitFor(() => expect(setPrimaryContact).toHaveBeenCalledWith("k2", "c1"));
  });

  it("encodes a stored email with query-string characters into a safe mailto href", () => {
    render(<ClientContacts clientId="c1" contacts={maliciousContacts} />);
    const href = screen.getByRole("link", { name: "a@b.mx?bcc=x@evil.com" }).getAttribute("href");
    expect(href).not.toBeNull();
    expect(href!.slice("mailto:".length)).not.toContain("?");
  });
});
