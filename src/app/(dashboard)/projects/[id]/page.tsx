import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectLinks } from "@/components/projects/project-links";
import { ProjectMembers } from "@/components/projects/project-members";
import { ProjectFinance } from "@/components/projects/project-finance";
import { ProjectEditForm } from "@/components/projects/project-edit-form";
import { DeliverablesPanel } from "@/components/projects/deliverables-panel";
import { STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", params.id).single();

  if (!project) notFound();

  const [
    { data: links },
    { data: members },
    { data: allUsers },
    { data: tasks },
    { data: deliverables },
    { data: activeProjects },
  ] = await Promise.all([
    supabase.from("project_links").select("*").eq("project_id", params.id),
    supabase.from("project_members").select("*, user:users(*)").eq("project_id", params.id),
    supabase.from("users").select("*"),
    supabase.from("tasks").select("*").eq("project_id", params.id).order("created_at", { ascending: false }),
    supabase
      .from("deliverables")
      .select("*, approver:users!approved_by(*)")
      .eq("project_id", params.id)
      .order("position")
      .order("created_at"),
    supabase.from("projects").select("*").eq("status", "active").order("name"),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <Badge>{STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}</Badge>
      </div>
      <p className="text-muted-foreground">Cliente: {project.client}</p>

      <Card>
        <CardHeader><CardTitle>Información general</CardTitle></CardHeader>
        <CardContent>
          {/* Keyed by the row data so the uncontrolled form re-mounts with fresh
              defaultValues whenever the server data changes (realtime refresh). */}
          <ProjectEditForm key={JSON.stringify(project)} project={project} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DeliverablesPanel
            projectId={params.id}
            color={project.color}
            deliverables={deliverables || []}
            tasks={tasks || []}
            users={allUsers || []}
            projects={activeProjects || []}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <ProjectLinks links={links || []} projectId={params.id} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <ProjectMembers members={members || []} projectId={params.id} allUsers={allUsers || []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ProjectFinance project={project} members={members || []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pendientes del Proyecto</CardTitle></CardHeader>
        <CardContent>
          {tasks && tasks.length > 0 ? (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between text-sm border rounded p-2">
                  <span>{task.title}</span>
                  <Badge variant="outline">
                    {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pendientes</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
