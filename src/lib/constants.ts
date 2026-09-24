/** IANA time zone the app operates in, used for "today" date calculations. */
export const APP_TIME_ZONE = "America/Mexico_City";

export const PRIORITY_COLORS = {
  urgent: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#22C55E",
} as const;

export const PRIORITY_LABELS = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
} as const;

export const STATUS_LABELS = {
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
} as const;

export const TASK_STATUS_LABELS = {
  pending: "Pendiente",
  in_progress: "En Progreso",
  completed: "Completado",
} as const;

export const TRANSACTION_TYPE_LABELS = {
  income: "Ingreso",
  expense: "Gasto",
} as const;

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { label: "Proyectos", href: "/projects", icon: "FolderKanban" },
  { label: "Pendientes", href: "/tasks", icon: "ListTodo" },
  { label: "Finanzas", href: "/finance", icon: "DollarSign" },
  { label: "Calendario", href: "/calendar", icon: "Calendar" },
  { label: "Notas", href: "/notes", icon: "StickyNote" },
  { label: "Ajustes", href: "/settings", icon: "Settings" },
] as const;
