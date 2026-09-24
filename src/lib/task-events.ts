import { APP_TIME_ZONE, PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Deliverable, Project, TaskComment, TaskEvent, User } from "@/types";

export interface EventLookups {
  users: Pick<User, "id" | "name">[];
  projects: Pick<Project, "id" | "name">[];
  deliverables: Pick<Deliverable, "id" | "title">[];
}

const FIELD_LABELS = {
  status: "el estado",
  priority: "la prioridad",
  due_date: "la fecha límite",
  assigned_to: "el asignado",
  project_id: "el proyecto",
  deliverable_id: "el entregable",
} as const;

type ValueField = keyof typeof FIELD_LABELS;

function valueLabel(field: ValueField, value: string | null, lookups: EventLookups): string {
  switch (field) {
    case "status":
      return value ? (TASK_STATUS_LABELS as Record<string, string>)[value] ?? value : "ninguno";
    case "priority":
      return value ? (PRIORITY_LABELS as Record<string, string>)[value] ?? value : "ninguno";
    case "due_date":
      return value ? formatDate(value) : "sin fecha";
    case "assigned_to":
      if (!value) return "ninguno";
      return lookups.users.find((u) => u.id === value)?.name ?? "(eliminado)";
    case "project_id":
      if (!value) return "ninguno";
      return lookups.projects.find((p) => p.id === value)?.name ?? "(eliminado)";
    case "deliverable_id":
      if (!value) return "ninguno";
      return lookups.deliverables.find((d) => d.id === value)?.title ?? "(eliminado)";
  }
}

export function describeEvent(event: TaskEvent, lookups: EventLookups): string {
  const actor = lookups.users.find((u) => u.id === event.actor_id)?.name ?? "Alguien";
  switch (event.field) {
    case "created":
      return `${actor} creó el pendiente`;
    case "description":
      return `${actor} editó la descripción`;
    case "title":
      return `${actor} cambió el título`;
    default: {
      const field = event.field as ValueField;
      const from = valueLabel(field, event.old_value, lookups);
      const to = valueLabel(field, event.new_value, lookups);
      return `${actor} cambió ${FIELD_LABELS[field]} ${from} → ${to}`;
    }
  }
}

export type TimelineItem =
  | { kind: "comment"; item: TaskComment }
  | { kind: "event"; item: TaskEvent };

/** Oldest first; on identical timestamps events come before comments. */
export function mergeTimeline(comments: TaskComment[], events: TaskEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...events.map((item) => ({ kind: "event" as const, item })),
    ...comments.map((item) => ({ kind: "comment" as const, item })),
  ];
  return items.sort((a, b) => {
    const diff = Date.parse(a.item.created_at) - Date.parse(b.item.created_at);
    if (diff !== 0) return diff;
    if (a.kind === b.kind) return 0;
    return a.kind === "event" ? -1 : 1;
  });
}

const EVENT_TIME = new Intl.DateTimeFormat("es-MX", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatEventTime(iso: string): string {
  return EVENT_TIME.format(new Date(iso));
}
