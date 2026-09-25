import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceOverview } from "@/components/finance/finance-overview";
import { ProjectBreakdown } from "@/components/finance/project-breakdown";
import { TransactionTable } from "@/components/finance/transaction-table";
import { TransactionForm } from "@/components/finance/transaction-form";
import { TransactionFilters } from "@/components/finance/transaction-filters";
import type { TransactionType } from "@/types";

const TRANSACTION_TYPES: TransactionType[] = ["income", "expense"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: { type?: string; project?: string; from?: string; to?: string };
}) {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select("*, project:projects(*)")
    .order("date", { ascending: false });

  if (searchParams.type && TRANSACTION_TYPES.includes(searchParams.type as TransactionType)) {
    query = query.eq("type", searchParams.type);
  }
  if (searchParams.project && searchParams.project !== "all") {
    query = query.eq("project_id", searchParams.project);
  }
  if (searchParams.from && DATE_RE.test(searchParams.from)) {
    query = query.gte("date", searchParams.from);
  }
  if (searchParams.to && DATE_RE.test(searchParams.to)) {
    query = query.lte("date", searchParams.to);
  }

  const [{ data: projects }, { data: members }, { data: users }, { data: transactions }] = await Promise.all([
    supabase.from("projects").select("*, client:clients(id, name, logo_path)").order("name"),
    supabase.from("project_members").select("*, user:users(*)"),
    supabase.from("users").select("*").order("name"),
    query,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Finanzas</h1>
        <TransactionForm projects={projects || []} />
      </div>

      <FinanceOverview projects={projects || []} members={members || []} users={users || []} />

      <ProjectBreakdown projects={projects || []} members={members || []} />

      <Card>
        <CardHeader><CardTitle>Transacciones</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={null}>
            <TransactionFilters projects={projects || []} />
          </Suspense>
          <TransactionTable transactions={transactions || []} />
        </CardContent>
      </Card>
    </div>
  );
}
