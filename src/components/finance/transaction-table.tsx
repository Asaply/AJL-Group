"use client";

import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteTransaction } from "@/app/(dashboard)/finance/actions";
import { transactionTotals } from "@/lib/finance";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import type { Transaction } from "@/types";

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  const totals = transactionTotals(transactions);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta transacción?")) return;
    const result = await deleteTransaction(id);
    if (result?.error) toast.error(result.error);
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Proyecto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{formatDate(t.date)}</TableCell>
              <TableCell>{t.project?.name}</TableCell>
              <TableCell>
                <Badge variant={t.type === "income" ? "default" : "destructive"}>
                  {TRANSACTION_TYPE_LABELS[t.type]}
                </Badge>
              </TableCell>
              <TableCell>{t.description}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" type="button" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {transactions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Sin transacciones</p>
      )}
      <p className="text-sm text-muted-foreground">
        Ingresos: {formatCurrency(totals.income)} · Gastos: {formatCurrency(totals.expense)} · Neto:{" "}
        <span className={totals.net >= 0 ? "text-green-500" : "text-red-500"}>{formatCurrency(totals.net)}</span>
      </p>
    </div>
  );
}
