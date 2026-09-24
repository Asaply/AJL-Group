import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectProgressBar } from "@/components/projects/project-progress";
import type { Project } from "@/types";

export function ActiveProjects({ projects }: { projects: Project[] }) {
  const active = projects.filter((p) => p.status === "active");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proyectos Activos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {active.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="block space-y-1">
            <span className="font-medium text-sm">{p.name}</span>
            <ProjectProgressBar deliverables={p.deliverables ?? []} color={p.color} showCount={false} />
          </Link>
        ))}
        {active.length === 0 && <p className="text-sm text-muted-foreground">Sin proyectos activos</p>}
      </CardContent>
    </Card>
  );
}
