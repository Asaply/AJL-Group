import type { User } from "@/types";

/**
 * Shared finance math for projects/finance/dashboard pages.
 *
 * Inputs are `Number()`-coerced because Postgres `numeric` columns arrive
 * over the wire as strings (e.g. "1234.50") rather than JS numbers.
 */

type MoneyLike = number | string;

interface ProjectMoney {
  budget: MoneyLike;
  production_cost: MoneyLike;
}

interface ProjectWithId extends ProjectMoney {
  id: string;
}

interface MemberLike {
  user_id: string;
  project_id: string;
  profit_percentage: MoneyLike;
}

function toNumber(value: MoneyLike): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function projectMargin(p: ProjectMoney): number {
  return round2(toNumber(p.budget) - toNumber(p.production_cost));
}

export function marginPercent(p: ProjectMoney): number {
  const budget = toNumber(p.budget);
  if (budget <= 0) return 0;
  const margin = projectMargin(p);
  return Math.round((margin / budget) * 1000) / 10;
}

export function memberShare(margin: number, percentage: MoneyLike): number {
  return round2((margin * toNumber(percentage)) / 100);
}

export function percentageTotal(members: { profit_percentage: MoneyLike }[]): number {
  return round2(members.reduce((sum, m) => sum + toNumber(m.profit_percentage), 0));
}

export const PERCENTAGE_TOLERANCE = 0.01;

/** True when `total` is more than 100 by strictly more than the tolerance (100.01 ok, 100.02 not). */
export function exceedsHundred(total: number): boolean {
  return round2(total - 100) > PERCENTAGE_TOLERANCE;
}

/**
 * True when `total` is 100 within the tolerance. 99.99 (the default
 * 3 x 33.33 split) and 100.01 both count as 100; 99.98 / 100.02 do not.
 * `round2` absorbs float noise such as |99.99 - 100| = 0.010000000000005.
 */
export function isHundred(total: number): boolean {
  return round2(Math.abs(total - 100)) <= PERCENTAGE_TOLERANCE;
}

export function financeTotals(projects: ProjectMoney[]): { income: number; cost: number; margin: number } {
  const income = round2(projects.reduce((sum, p) => sum + toNumber(p.budget), 0));
  const cost = round2(projects.reduce((sum, p) => sum + toNumber(p.production_cost), 0));
  return { income, cost, margin: round2(income - cost) };
}

export function transactionTotals(
  transactions: { type: "income" | "expense"; amount: MoneyLike }[]
): { income: number; expense: number; net: number } {
  const income = round2(
    transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + toNumber(t.amount), 0)
  );
  const expense = round2(
    transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + toNumber(t.amount), 0)
  );
  return { income, expense, net: round2(income - expense) };
}

export function partnerTotals(
  users: User[],
  members: MemberLike[],
  projects: ProjectWithId[]
): { user: User; total: number }[] {
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  return users.map((user) => {
    const total = members
      .filter((m) => m.user_id === user.id)
      .reduce((sum, m) => {
        const project = projectsById.get(m.project_id);
        if (!project) return sum;
        return sum + memberShare(projectMargin(project), m.profit_percentage);
      }, 0);
    return { user, total: round2(total) };
  });
}
