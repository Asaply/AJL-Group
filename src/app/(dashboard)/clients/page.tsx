import { Suspense } from "react";
import { Plus } from "lucide-react";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ClientCard } from "@/components/clients/client-card";
import { ClientFilters } from "@/components/clients/client-filters";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { CLIENT_STATUSES, escapeIlike } from "@/lib/clients";
import type { ClientStatus } from "@/types";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; industry?: string };
}) {
  const supabase = await createSupabase();

  let query = supabase
    .from("clients")
    .select("*, contacts:client_contacts(id, name, is_primary), projects(id, status)")
    .order("name");

  if (searchParams.status && CLIENT_STATUSES.includes(searchParams.status as ClientStatus)) {
    query = query.eq("status", searchParams.status);
  }
  if (searchParams.industry) query = query.eq("industry", searchParams.industry);

  const q = (searchParams.q ?? "").trim();
  if (q) {
    const pattern = `%${escapeIlike(q)}%`;
    const [{ data: byName }, { data: byContact }] = await Promise.all([
      supabase.from("clients").select("id").ilike("name", pattern),
      supabase
        .from("client_contacts")
        .select("client_id")
        .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`),
    ]);
    const ids = Array.from(
      new Set([...(byName || []).map((r) => r.id), ...(byContact || []).map((r) => r.client_id)])
    );
    query = query.in("id", ids.length > 0 ? ids : [NIL_UUID]);
  }

  const [{ data: clients }, { data: industryRows }] = await Promise.all([
    query,
    supabase.from("clients").select("industry").not("industry", "is", null),
  ]);
  const industries = Array.from(new Set((industryRows || []).map((r) => r.industry as string))).sort((a, b) =>
    a.localeCompare(b, "es")
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <ClientFormDialog trigger={<Button><Plus className="h-4 w-4 mr-2" />Nuevo cliente</Button>} />
      </div>
      <Suspense fallback={null}>
        <ClientFilters industries={industries} />
      </Suspense>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients?.map((client) => <ClientCard key={client.id} client={client} />)}
        {(!clients || clients.length === 0) && (
          <p className="text-muted-foreground col-span-full text-center py-12">No hay clientes</p>
        )}
      </div>
    </div>
  );
}
