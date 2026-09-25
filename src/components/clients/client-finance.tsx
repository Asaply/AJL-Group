import { formatCurrency } from "@/lib/utils";
import type { clientSummary } from "@/lib/clients";

type Summary = ReturnType<typeof clientSummary>;

export function ClientFinance({ summary }: { summary: Summary }) {
  const items = [
    { label: "Facturado", value: summary.income },
    { label: "Costos", value: summary.cost },
    { label: "Margen", value: summary.margin, colored: true },
    { label: "Ingresos registrados", value: summary.txIncome },
    { label: "Gastos registrados", value: summary.txExpense },
    { label: "Neto de transacciones", value: summary.txNet, colored: true },
  ];
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Resumen financiero</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((i) => (
          <div key={i.label} className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className={`text-lg font-semibold ${i.colored ? (i.value >= 0 ? "text-green-500" : "text-red-500") : ""}`}>
              {formatCurrency(i.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
