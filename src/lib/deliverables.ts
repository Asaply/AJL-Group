import { round2 } from "@/lib/finance";
import type { TaskStatus } from "@/types";

/**
 * Deliverable rules. Progress is never stored: it is derived from which
 * deliverables a partner has approved, so the % always has a paper trail.
 */

export type DeliverableStatus = "pending" | "ready" | "approved";

export interface DeliverableStatusInfo {
  status: DeliverableStatus;
  openTasks: number;
  totalTasks: number;
  /** Approved, but a linked task was reopened afterwards. Approval stands. */
  approvedWithOpenTasks: boolean;
}

function toNumber(value: number | string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function deliverableStatus(
  d: { approved_at: string | null },
  tasks: { status: TaskStatus }[]
): DeliverableStatusInfo {
  const totalTasks = tasks.length;
  const openTasks = tasks.filter((t) => t.status !== "completed").length;

  if (d.approved_at) {
    return { status: "approved", openTasks, totalTasks, approvedWithOpenTasks: openTasks > 0 };
  }
  const status: DeliverableStatus = totalTasks > 0 && openTasks === 0 ? "ready" : "pending";
  return { status, openTasks, totalTasks, approvedWithOpenTasks: false };
}

/** Σ weight of approved deliverables, clamped to 0..100 and rounded; null when there are none. */
export function projectProgress(
  deliverables: { weight: number | string; approved_at: string | null }[]
): number | null {
  if (deliverables.length === 0) return null;
  const approved = deliverables
    .filter((d) => d.approved_at)
    .reduce((sum, d) => sum + toNumber(d.weight), 0);
  return Math.min(100, Math.max(0, Math.round(round2(approved))));
}

export function weightTotal(deliverables: { weight: number | string }[]): number {
  return round2(deliverables.reduce((sum, d) => sum + toNumber(d.weight), 0));
}

/** New order with `id` swapped one step up/down; unchanged at the edges or if missing. */
export function moveItem(ids: string[], id: string, direction: "up" | "down"): string[] {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
