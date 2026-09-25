import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectLinks } from "@/components/projects/project-links";
import { ProjectMembers } from "@/components/projects/project-members";
import { ProjectFinance } from "@/components/projects/project-finance";
import { ProjectEditForm } from "@/components/projects/project-edit-form";
import { ProjectContacts } from "@/components/projects/project-contacts";
import { DeliverablesPanel } from "@/components/projects/deliverables-panel";
import { ProjectDot } from "@/components/projects/project-dot";
import { OpenTaskButton } from "@/components/tasks/open-task-button";
import { FileManager } from "@/components/files/file-manager";
import { STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import {
  getProjectFileUrl, registerProjectFile, softDeleteProjectFile, updateProjectFileType,
} from "@/app/(dashboard)/projects/file-actions";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects").select("*, client:clients(id, name, logo_path)").eq("id", params.id).single();

  if (!project) notFound();

  const [
    { data: links },
    { data: members },
    { data: allUsers },
    { data: tasks },
    { data: deliverables },
    { data: activeProjects },
    { data: clients },
    { data: clientContacts },
    { data: projectContacts },
    { data: files },
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
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("client_contacts").select("*").eq("client_id", project.client_id ?? NIL_UUID).order("name"),
    supabase.from("project_contacts").select("*, contact:client_contacts(*)").eq("project_id", params.id),
    supabase
      .from("project_files")
      .select("*, uploader:users!uploaded_by(*), deleter:users!deleted_by(*)")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  // The active-projects list drives the "linked project" Select in TaskForm.
  // When this project itself is paused/completed it would otherwise be
  // missing from that list, leaving the controlled Select with no matching
  // option — always include it so creating a task from this page still works.
  const panelProjects = activeProjects?.some((p) => p.id === project.id)
    ? activeProjects
    : [project, ...(activeProjects || [])];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <ProjectDot color={project.color} className="h-4 w-4" />
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <Badge>{STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}</Badge>
      </div>
      <p className="text-muted-foreground">
        Cliente:{" "}
        {project.client ? (
          <Link href={`/clients/${project.client.id}`} className="text-primary hover:underline">{project.client.name}</Link>
        ) : (
          "Sin cliente"
        )}
      </p>

      <Card>
        <CardHeader><CardTitle>Información general</CardTitle></CardHeader>
        <CardContent>
          {/* Keyed by the row data so the uncontrolled form re-mounts with fresh
              defaultValues whenever the server data changes (realtime refresh). */}
          <ProjectEditForm key={JSON.stringify(project)} project={project} clients={clients || []} />
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
            projects={panelProjects}
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

      {project.client_id && (
        <Card>
          <CardContent className="pt-6">
            <ProjectContacts
              projectId={params.id}
              clientId={project.client_id}
              contacts={clientContacts || []}
              links={projectContacts || []}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <ProjectFinance project={project} members={members || []} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <FileManager
            entity="project"
            ownerId={params.id}
            files={files || []}
            actions={{
              register: registerProjectFile,
              softDelete: softDeleteProjectFile,
              updateType: updateProjectFileType,
              getUrl: getProjectFileUrl,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pendientes del Proyecto</CardTitle></CardHeader>
        <CardContent>
          {tasks && tasks.length > 0 ? (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between text-sm border rounded p-2">
                  <OpenTaskButton taskId={task.id}>{task.title}</OpenTaskButton>
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
