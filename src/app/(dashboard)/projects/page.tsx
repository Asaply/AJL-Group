import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectForm } from "@/components/projects/project-form";
import { ProjectFilters } from "@/components/projects/project-filters";
import { nextPaletteColor } from "@/lib/colors";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { status?: string; member?: string; client?: string };
}) {
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select("*, client:clients(id, name, logo_path), deliverables(id, weight, approved_at)")
    .order("created_at", { ascending: false });

  if (searchParams.status && searchParams.status !== "all") {
    query = query.eq("status", searchParams.status);
  }

  if (searchParams.member && searchParams.member !== "all") {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", searchParams.member);
    const projectIds = (memberships || []).map((m) => m.project_id);
    query = query.in("id", projectIds.length > 0 ? projectIds : [NIL_UUID]);
  }

  if (searchParams.client === "none") {
    query = query.is("client_id", null);
  } else if (searchParams.client && UUID_RE.test(searchParams.client)) {
    query = query.eq("client_id", searchParams.client);
  }

  const [{ data: projects }, { data: users }, { data: colorRows }, { data: clients }] = await Promise.all([
    query,
    supabase.from("users").select("*").order("name"),
    supabase.from("projects").select("color"),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Proyectos</h1>
        <ProjectForm
          defaultColor={nextPaletteColor((colorRows || []).map((r) => r.color))}
          clients={clients || []}
        />
      </div>
      <Suspense fallback={null}>
        <ProjectFilters users={users || []} clients={clients || []} />
      </Suspense>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        {(!projects || projects.length === 0) && (
          <p className="text-muted-foreground col-span-full text-center py-12">
            No hay proyectos. Crea el primero.
          </p>
        )}
      </div>
    </div>
  );
}
