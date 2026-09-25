import type { ParseResult } from "@/lib/project-form";
import { parseHttpUrl } from "@/lib/url";
import { PROJECT_COLORS } from "@/lib/colors";
import { financeTotals, transactionTotals } from "@/lib/finance";
import type { ClientStatus, TransactionType } from "@/types";

export const CLIENT_STATUSES: ClientStatus[] = ["prospect", "active", "inactive"];

export const CLIENT_STATUS_LABELS = {
  prospect: "Prospecto",
  active: "Activo",
  inactive: "Inactivo",
} as const;

const RFC_RE = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_RE = /^[+\d\s().-]+$/;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function opt(formData: FormData, key: string): string | null {
  return str(formData, key) || null;
}

export function isValidRfc(value: string): boolean {
  return RFC_RE.test(value);
}

function isValidPhone(value: string): boolean {
  if (!PHONE_CHARS_RE.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 10 && digits <= 15;
}

export interface ClientFormValues {
  name: string;
  status: ClientStatus;
  industry: string | null;
  website: string | null;
  city: string | null;
}

export function parseClientForm(formData: FormData): ParseResult<ClientFormValues> {
  const name = str(formData, "name");
  if (!name) return { ok: false, error: "El nombre es obligatorio" };

  const rawStatus = str(formData, "status");
  let status: ClientStatus = "active";
  if (rawStatus) {
    if (!CLIENT_STATUSES.includes(rawStatus as ClientStatus)) return { ok: false, error: "Estado inválido" };
    status = rawStatus as ClientStatus;
  }

  const rawWebsite = str(formData, "website");
  let website: string | null = null;
  if (rawWebsite) {
    website = parseHttpUrl(rawWebsite);
    if (!website) return { ok: false, error: "El sitio web no es válido" };
  }

  return { ok: true, values: { name, status, industry: opt(formData, "industry"), website, city: opt(formData, "city") } };
}

export interface ClientFiscalValues {
  legal_name: string | null;
  rfc: string | null;
  tax_regime: string | null;
  tax_address: string | null;
  cfdi_use: string | null;
}

export function parseClientFiscalForm(formData: FormData): ParseResult<ClientFiscalValues> {
  const rawRfc = str(formData, "rfc").toUpperCase();
  if (rawRfc && !isValidRfc(rawRfc)) return { ok: false, error: "El RFC no es válido" };
  return {
    ok: true,
    values: {
      legal_name: opt(formData, "legal_name"),
      rfc: rawRfc || null,
      tax_regime: opt(formData, "tax_regime"),
      tax_address: opt(formData, "tax_address"),
      cfdi_use: opt(formData, "cfdi_use"),
    },
  };
}

export interface ContactFormValues {
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
}

export function parseContactForm(formData: FormData): ParseResult<ContactFormValues> {
  const name = str(formData, "name");
  if (!name) return { ok: false, error: "El nombre es obligatorio" };

  const email = opt(formData, "email");
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "El email no es válido" };

  const phone = opt(formData, "phone");
  if (phone && !isValidPhone(phone)) return { ok: false, error: "El teléfono no es válido" };

  const whatsapp = opt(formData, "whatsapp");
  if (whatsapp && !isValidPhone(whatsapp)) return { ok: false, error: "El WhatsApp no es válido" };

  return {
    ok: true,
    values: { name, position: opt(formData, "position"), email, phone, whatsapp, notes: opt(formData, "notes") },
  };
}

/** wa.me link; 10-digit numbers are assumed Mexican (country code 52). */
export function whatsappLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits.length === 10 ? `52${digits}` : digits}`;
}

const TITLES = new Set(["dr", "dra", "lic", "ing", "arq", "mtro", "mtra"]);

export function clientInitials(name: string): string {
  const words = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .filter((w) => !TITLES.has(w.toLowerCase()));
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function clientColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

/** Escapes ilike wildcards and replaces characters that break PostgREST `or()` filters. */
export function escapeIlike(q: string): string {
  return q.replace(/[\\%_]/g, (m) => `\\${m}`).replace(/[,()]/g, " ");
}

type Money = number | string;

export function clientSummary(
  projects: { budget: Money; production_cost: Money; status: string }[],
  transactions: { type: TransactionType; amount: Money }[]
) {
  const totals = financeTotals(projects);
  const tx = transactionTotals(transactions);
  return {
    income: totals.income,
    cost: totals.cost,
    margin: totals.margin,
    txIncome: tx.income,
    txExpense: tx.expense,
    txNet: tx.net,
    projectCount: projects.length,
    activeProjectCount: projects.filter((p) => p.status === "active").length,
  };
}
