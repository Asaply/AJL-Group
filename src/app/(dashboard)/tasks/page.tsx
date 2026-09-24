import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskFilters } from "@/components/tasks/task-filters";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { priority?: string; status?: string; assigned?: string; project?: string };
}) {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("*, assignee:users!assigned_to(*), project:projects(*)")
    .order("created_at", { ascending: false });

  if (searchParams.priority && searchParams.priority !== "all") {
    query = query.eq("priority", searchParams.priority);
  }
  if (searchParams.status && searchParams.status !== "all") {
    query = query.eq("status", searchParams.status);
  }
  if (searchParams.assigned && searchParams.assigned !== "all") {
    query = query.eq("assigned_to", searchParams.assigned);
  }
  if (searchParams.project === "none") {
    query = query.is("project_id", null);
  } else if (searchParams.project && searchParams.project !== "all") {
    query = query.eq("project_id", searchParams.project);
  }

  const [{ data: tasks }, { data: users }, { data: allProjects }, { data: activeProjects }] = await Promise.all([
    query,
    supabase.from("users").select("*").order("name"),
    supabase.from("projects").select("*").order("name"),
    supabase.from("projects").select("*").eq("status", "active").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pendientes</h1>
        <TaskForm users={users || []} projects={activeProjects || []} />
      </div>
      <Suspense fallback={null}>
        <TaskFilters users={users || []} projects={allProjects || []} />
      </Suspense>
      <div className="space-y-3">
        {tasks?.map((task) => <TaskCard key={task.id} task={task} />)}
        {(!tasks || tasks.length === 0) && (
          <p className="text-muted-foreground text-center py-12">Sin pendientes</p>
        )}
      </div>
    </div>
  );
}
