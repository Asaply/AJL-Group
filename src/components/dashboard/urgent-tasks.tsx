import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectDot } from "@/components/projects/project-dot";
import { formatDate } from "@/lib/utils";
import { selectUrgentTasks, isOverdue, todayKey } from "@/lib/tasks";
import type { Task } from "@/types";

export function UrgentTasks({ tasks }: { tasks: Task[] }) {
  const urgent = selectUrgentTasks(tasks);
  const today = todayKey();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendientes Urgentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {urgent.map((t) => {
          const overdue = isOverdue(t.due_date, today);
          return (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <div className="flex flex-col items-start gap-1">
                <Link href="/tasks" className="hover:underline">
                  {t.title}
                </Link>
                {t.project && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ProjectDot color={t.project.color} />{t.project.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {overdue && (
                  <Badge variant="outline" className="text-xs text-red-500 border-red-500">
                    Vencido
                  </Badge>
                )}
                {t.due_date && (
                  <span className={`text-xs ${overdue ? "text-red-500" : "text-muted-foreground"}`}>
                    {formatDate(t.due_date)}
                  </span>
                )}
                {t.assignee && (
                  <Badge variant="outline" className="text-xs">
                    {t.assignee.name}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
        {urgent.length === 0 && <p className="text-sm text-muted-foreground">Sin pendientes urgentes</p>}
      </CardContent>
    </Card>
  );
}
