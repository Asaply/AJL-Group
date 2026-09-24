import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { financeTotals, partnerTotals } from "@/lib/finance";
import type { Project, ProjectMember, User } from "@/types";

interface FinanceData {
  projects: Project[];
  members: (ProjectMember & { user: User })[];
  users: User[];
}

export function FinanceOverview({ projects, members, users }: FinanceData) {
  const { income, cost, margin } = financeTotals(projects);
  const partners = partnerTotals(users, members, projects);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ingresos Totales</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(income)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Costos Totales</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(cost)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Margen Total</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${margin >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(margin)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Reparto por Socio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {partners.map(({ user, total }) => (
            <div key={user.id} className="flex justify-between items-center border rounded-lg p-4">
              <span className="font-medium">{user.name}</span>
              <span className={`text-xl font-bold ${total >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatCurrency(total)}
              </span>
            </div>
          ))}
          {partners.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin socios registrados</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
