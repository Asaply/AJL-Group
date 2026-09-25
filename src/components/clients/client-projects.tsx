import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProjectDot } from "@/components/projects/project-dot";
import { ProjectProgressBar } from "@/components/projects/project-progress";
import { STATUS_LABELS } from "@/lib/constants";
import type { Project } from "@/types";

export function ClientProjects({ projects }: { projects: Project[] }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Proyectos</h3>
      {projects.length === 0 && <p className="text-sm text-muted-foreground">Sin proyectos</p>}
      <ul className="space-y-3">
        {projects.map((p) => (
          <li key={p.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/projects/${p.id}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                <ProjectDot color={p.color} />{p.name}
              </Link>
              <Badge variant="outline">{STATUS_LABELS[p.status]}</Badge>
            </div>
            <ProjectProgressBar deliverables={p.deliverables ?? []} color={p.color} showCount={false} />
          </li>
        ))}
      </ul>
    </div>
  );
}
