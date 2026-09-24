import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { projectMargin, marginPercent, memberShare } from "@/lib/finance";
import type { Project, ProjectMember, User } from "@/types";

export function ProjectFinance({
  project, members,
}: {
  project: Project;
  members: (ProjectMember & { user: User })[];
}) {
  const margin = projectMargin(project);
  const percent = marginPercent(project);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Finanzas</h3>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Presupuesto</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(project.budget)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Costo</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(project.production_cost)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Margen ({percent}%)</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${margin >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(margin)}
            </p>
          </CardContent>
        </Card>
      </div>
      <h4 className="font-medium text-sm mt-4">Reparto</h4>
      {members.map((m) => (
        <div key={m.id} className="flex justify-between text-sm border rounded-lg p-2">
          <span>{m.user.name} ({m.profit_percentage}%)</span>
          <span className="font-medium">{formatCurrency(memberShare(margin, m.profit_percentage))}</span>
        </div>
      ))}
      {members.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin miembros asignados</p>
      )}
    </div>
  );
}
