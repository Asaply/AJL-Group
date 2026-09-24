import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectDot } from "@/components/projects/project-dot";
import { formatCurrency } from "@/lib/utils";
import { projectMargin, marginPercent, memberShare } from "@/lib/finance";
import type { Project, ProjectMember, User } from "@/types";

interface ProjectBreakdownData {
  projects: Project[];
  members: (ProjectMember & { user: User })[];
}

export function ProjectBreakdown({ projects, members }: ProjectBreakdownData) {
  return (
    <Card>
      <CardHeader><CardTitle>Desglose por Proyecto</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {projects.map((project) => {
          const margin = projectMargin(project);
          const percent = marginPercent(project);
          const projectMembers = members.filter((m) => m.project_id === project.id);

          return (
            <div key={project.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
                  <ProjectDot color={project.color} />
                  {project.name}
                </Link>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-muted-foreground">Presupuesto: {formatCurrency(project.budget)}</span>
                  <span className="text-muted-foreground">Costo: {formatCurrency(project.production_cost)}</span>
                  <span className={`font-medium ${margin >= 0 ? "text-green-500" : "text-red-500"}`}>
                    Margen: {formatCurrency(margin)} ({percent}%)
                  </span>
                </div>
              </div>
              {projectMembers.length > 0 ? (
                <div className="space-y-1">
                  {projectMembers.map((m) => (
                    <div key={m.id} className="flex justify-between text-sm">
                      <span>{m.user.name} ({m.profit_percentage}%)</span>
                      <span className="font-medium">{formatCurrency(memberShare(margin, m.profit_percentage))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin miembros asignados</p>
              )}
            </div>
          );
        })}
        {projects.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin proyectos registrados</p>
        )}
      </CardContent>
    </Card>
  );
}
