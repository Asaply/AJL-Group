import { notFound } from "next/navigation";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ClientHeader } from "@/components/clients/client-header";
import { ClientFinance } from "@/components/clients/client-finance";
import { ClientContacts } from "@/components/clients/client-contacts";
import { ClientProjects } from "@/components/clients/client-projects";
import { ClientFiscal } from "@/components/clients/client-fiscal";
import { ClientNotes } from "@/components/clients/client-notes";
import { TaskCard } from "@/components/tasks/task-card";
import { clientSummary } from "@/lib/clients";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) notFound();
  const supabase = await createSupabase();

  const [{ data: client }, { data: contacts }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("client_contacts")
      .select("*, project_contacts(*, project:projects(id, name, color))")
      .eq("client_id", params.id)
      .order("is_primary", { ascending: false })
      .order("name"),
    supabase
      .from("projects")
      .select("*, deliverables(id, weight, approved_at)")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false }),
  ]);
  if (!client) notFound();

  const projectIds = (projects || []).map((p) => p.id);
  const ids = projectIds.length > 0 ? projectIds : [NIL_UUID];
  const [{ data: transactions }, { data: openTasks }] = await Promise.all([
    supabase.from("transactions").select("type, amount").in("project_id", ids),
    supabase
      .from("tasks")
      .select("*, assignee:users!assigned_to(*), project:projects(*), checklist:task_checklist_items(done), attachments:task_attachments(count)")
      .in("project_id", ids)
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const summary = clientSummary(projects || [], transactions || []);

  return (
    <div className="space-y-6 max-w-5xl">
      <ClientHeader client={client} projectCount={summary.projectCount} />
      <Card><CardContent className="pt-6"><ClientFinance summary={summary} /></CardContent></Card>
      <Card><CardContent className="pt-6"><ClientContacts clientId={client.id} contacts={contacts || []} /></CardContent></Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardContent className="pt-6"><ClientProjects projects={projects || []} /></CardContent></Card>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold">Pendientes abiertos</h3>
            {(openTasks || []).length === 0 && <p className="text-sm text-muted-foreground">Sin pendientes abiertos</p>}
            <div className="space-y-2">
              {(openTasks || []).map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card><CardContent className="pt-6"><ClientFiscal client={client} /></CardContent></Card>
      <Card><CardContent className="pt-6"><ClientNotes clientId={client.id} notes={client.notes} /></CardContent></Card>
    </div>
  );
}
