"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskForm } from "@/components/tasks/task-form";
import { PRIORITY_COLORS } from "@/lib/constants";
import { buildMonthCells, groupTasksByDate, parseDateKey, toDateKey } from "@/lib/calendar";
import type { Task, TaskPriority, User, Project, Deliverable } from "@/types";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const CHIP_TEXT_CLASS: Record<TaskPriority, string> = {
  urgent: "text-white",
  high: "text-white",
  medium: "text-black",
  low: "text-black",
};

function formatDialogTitle(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function CalendarGrid({
  tasks,
  users,
  projects,
  deliverables,
  today,
}: {
  tasks: Task[];
  users: User[];
  projects: Project[];
  deliverables: Deliverable[];
  /** "YYYY-MM-DD" in the app time zone, computed on the server via todayKey(). */
  today: string;
}) {
  // Derived from a server-computed key (APP_TIME_ZONE), never `new Date()`
  // here: during SSR that would read the host's zone (UTC on Vercel).
  const initial = parseDateKey(today);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.monthIndex);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const tasksByDate = useMemo(() => groupTasksByDate(tasks), [tasks]);
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  const selectedTasks = selectedDate ? tasksByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Mes anterior">
          <ChevronLeft />
        </Button>
        <h2 className="text-xl font-bold">
          {MONTHS[month]} {year}
        </h2>
        <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Mes siguiente">
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {DAYS.map((d) => (
          <div key={d} className="bg-muted p-2 text-center text-xs font-medium">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} className="bg-muted/50 min-h-[80px] p-1" />;
          }

          const dateKey = toDateKey(year, month, day);
          const dayTasks = tasksByDate.get(dateKey) ?? [];
          const isToday = dateKey === today;

          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDate(dateKey)}
              className={`bg-card min-h-[80px] p-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
            >
              <span className="text-xs font-medium">{day}</span>
              <div className="space-y-0.5 mt-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className={`text-[10px] truncate rounded px-1 py-0.5 ${CHIP_TEXT_CLASS[t.priority]} ${t.status === "completed" ? "opacity-50 line-through" : ""}`}
                    style={{
                      backgroundColor: PRIORITY_COLORS[t.priority],
                      ...(t.project ? { borderLeft: `3px solid ${t.project.color}` } : {}),
                    }}
                    title={t.title}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} más</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDate ? formatDialogTitle(selectedDate) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin pendientes este día</p>
            ) : (
              selectedTasks.map((t) => <TaskCard key={t.id} task={t} />)
            )}
            {selectedDate && (
              <TaskForm users={users} projects={projects} deliverables={deliverables} defaultDueDate={selectedDate} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
