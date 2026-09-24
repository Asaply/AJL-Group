import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { financeTotals } from "@/lib/finance";
import { formatCurrency } from "@/lib/utils";
import type { Project } from "@/types";

export function QuickFinance({ projects }: { projects: Project[] }) {
  const { income, cost, margin } = financeTotals(projects);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Financiero</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Ingresos</p>
            <p className="text-xl font-bold">{formatCurrency(income)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Costos</p>
            <p className="text-xl font-bold">{formatCurrency(cost)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Margen</p>
            <p className={`text-xl font-bold ${margin >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(margin)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
