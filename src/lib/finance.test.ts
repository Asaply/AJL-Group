import { describe, expect, it } from "vitest";
import {
  round2,
  projectMargin,
  marginPercent,
  memberShare,
  percentageTotal,
  PERCENTAGE_TOLERANCE,
  exceedsHundred,
  isHundred,
  financeTotals,
  partnerTotals,
  transactionTotals,
} from "./finance";
import type { User } from "@/types";

describe("round2", () => {
  it("rounds to 2 decimals", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(333.3333)).toBe(333.33);
  });

  it("handles floating point artifacts", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("projectMargin", () => {
  it("computes budget - production_cost", () => {
    expect(projectMargin({ budget: 10000, production_cost: 4000 })).toBe(6000);
  });

  it("accepts string inputs (Postgres numeric columns arrive as strings)", () => {
    expect(projectMargin({ budget: "10000.50", production_cost: "4000.25" })).toBe(6000.25);
  });

  it("handles zero budget", () => {
    expect(projectMargin({ budget: 0, production_cost: 500 })).toBe(-500);
  });
});

describe("marginPercent", () => {
  it("computes margin/budget*100 rounded to 1 decimal", () => {
    expect(marginPercent({ budget: 10000, production_cost: 4000 })).toBe(60);
  });

  it("returns 0 when budget is 0", () => {
    expect(marginPercent({ budget: 0, production_cost: 0 })).toBe(0);
  });

  it("returns 0 when budget is negative", () => {
    expect(marginPercent({ budget: -100, production_cost: 0 })).toBe(0);
  });

  it("accepts string inputs", () => {
    expect(marginPercent({ budget: "1000", production_cost: "250" })).toBe(75);
  });

  it("rounds to 1 decimal", () => {
    expect(marginPercent({ budget: 3000, production_cost: 1000 })).toBe(66.7);
  });
});

describe("memberShare", () => {
  it("computes margin * percentage / 100, rounded to 2 decimals", () => {
    expect(memberShare(1000, 33.33)).toBe(333.3);
  });

  it("accepts a string percentage", () => {
    expect(memberShare(1000, "33.33")).toBe(333.3);
  });

  it("handles a negative margin", () => {
    expect(memberShare(-1000, 50)).toBe(-500);
  });
});

describe("percentageTotal", () => {
  it("sums profit_percentage across members", () => {
    expect(percentageTotal([{ profit_percentage: 33.33 }, { profit_percentage: 33.33 }, { profit_percentage: 33.34 }])).toBe(100);
  });

  it("accepts string percentages", () => {
    expect(percentageTotal([{ profit_percentage: "50" }, { profit_percentage: "50" }])).toBe(100);
  });

  it("returns 0 for an empty list", () => {
    expect(percentageTotal([])).toBe(0);
  });
});

describe("PERCENTAGE_TOLERANCE", () => {
  it("is 0.01", () => {
    expect(PERCENTAGE_TOLERANCE).toBe(0.01);
  });
});

describe("exceedsHundred", () => {
  it("is false exactly at 100", () => {
    expect(exceedsHundred(100)).toBe(false);
  });

  it("is false at 100.01 (within tolerance)", () => {
    expect(exceedsHundred(100.01)).toBe(false);
  });

  it("is true at 100.02 (beyond tolerance)", () => {
    expect(exceedsHundred(100.02)).toBe(true);
  });

  it("is false for a float-summed 100.01 (e.g. 33.34 + 33.34 + 33.33)", () => {
    expect(exceedsHundred(33.34 + 33.34 + 33.33)).toBe(false);
  });
});

describe("isHundred", () => {
  it("treats 99.99 (default 3 x 33.33 split) as 100", () => {
    expect(isHundred(99.99)).toBe(true);
    expect(isHundred(33.33 + 33.33 + 33.33)).toBe(true);
  });

  it("is true at exactly 100", () => {
    expect(isHundred(100)).toBe(true);
  });

  it("is true at 100.01", () => {
    expect(isHundred(100.01)).toBe(true);
  });

  it("is false at 100.02", () => {
    expect(isHundred(100.02)).toBe(false);
  });

  it("is false at 99.98", () => {
    expect(isHundred(99.98)).toBe(false);
  });
});

describe("financeTotals", () => {
  it("sums budget as income, production_cost as cost, and computes margin", () => {
    const projects = [
      { budget: 10000, production_cost: 4000 },
      { budget: 5000, production_cost: 3000 },
    ];
    expect(financeTotals(projects)).toEqual({ income: 15000, cost: 7000, margin: 8000 });
  });

  it("accepts string inputs", () => {
    const projects = [{ budget: "1000.50", production_cost: "250.25" }];
    expect(financeTotals(projects)).toEqual({ income: 1000.5, cost: 250.25, margin: 750.25 });
  });

  it("returns zeros for an empty list", () => {
    expect(financeTotals([])).toEqual({ income: 0, cost: 0, margin: 0 });
  });
});

describe("partnerTotals", () => {
  const alan: User = { id: "u1", name: "Alan", email: "alan@ajl.com", avatar_url: null, created_at: "2026-01-01" };
  const jaziel: User = { id: "u2", name: "Jaziel", email: "jaziel@ajl.com", avatar_url: null, created_at: "2026-01-01" };
  const users = [alan, jaziel];

  it("sums each partner's share across multiple projects", () => {
    const projects = [
      { id: "p1", budget: 10000, production_cost: 4000 }, // margin 6000
      { id: "p2", budget: 5000, production_cost: 1000 }, // margin 4000
    ];
    const members = [
      { user_id: "u1", project_id: "p1", profit_percentage: 50 }, // 3000
      { user_id: "u1", project_id: "p2", profit_percentage: 50 }, // 2000
      { user_id: "u2", project_id: "p1", profit_percentage: 50 }, // 3000
    ];
    const result = partnerTotals(users, members, projects);
    expect(result).toEqual([
      { user: alan, total: 5000 },
      { user: jaziel, total: 3000 },
    ]);
  });

  it("ignores a member whose project is not in the projects list", () => {
    const projects = [{ id: "p1", budget: 10000, production_cost: 4000 }]; // margin 6000
    const members = [
      { user_id: "u1", project_id: "p1", profit_percentage: 50 }, // 3000
      { user_id: "u1", project_id: "p-missing", profit_percentage: 100 }, // ignored
    ];
    const result = partnerTotals(users, members, projects);
    expect(result.find((r) => r.user.id === "u1")?.total).toBe(3000);
  });

  it("gives a partner with no memberships a total of 0", () => {
    const result = partnerTotals(users, [], []);
    expect(result).toEqual([
      { user: alan, total: 0 },
      { user: jaziel, total: 0 },
    ]);
  });
});

describe("transactionTotals", () => {
  it("sums income, expense, and computes net", () => {
    const transactions = [
      { type: "income" as const, amount: 1000 },
      { type: "income" as const, amount: 500 },
      { type: "expense" as const, amount: 300 },
    ];
    expect(transactionTotals(transactions)).toEqual({ income: 1500, expense: 300, net: 1200 });
  });

  it("accepts string amounts", () => {
    const transactions = [
      { type: "income" as const, amount: "1000.50" },
      { type: "expense" as const, amount: "250.25" },
    ];
    expect(transactionTotals(transactions)).toEqual({ income: 1000.5, expense: 250.25, net: 750.25 });
  });

  it("returns zeros for an empty list", () => {
    expect(transactionTotals([])).toEqual({ income: 0, expense: 0, net: 0 });
  });

  it("can produce a negative net when expenses exceed income", () => {
    const transactions = [
      { type: "income" as const, amount: 100 },
      { type: "expense" as const, amount: 400 },
    ];
    expect(transactionTotals(transactions)).toEqual({ income: 100, expense: 400, net: -300 });
  });
});
