import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectProgressBar } from "@/components/projects/project-progress";
import { STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { projectMargin } from "@/lib/finance";
import type { Project } from "@/types";

const statusVariant = {
  active: "default",
  paused: "secondary",
  completed: "outline",
} as const;

export function ProjectCard({ project }: { project: Project }) {
  const margin = projectMargin(project);

  return (
    <Link href={`/projects/${project.id}`}>
      <Card
        className="hover:border-primary transition-colors cursor-pointer border-l-4"
        style={{ borderLeftColor: project.color }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <Badge variant={statusVariant[project.status]}>
              {STATUS_LABELS[project.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{project.client?.name ?? "Sin cliente"}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <ProjectProgressBar deliverables={project.deliverables ?? []} color={project.color} />
            <div className="flex justify-between text-sm pt-2">
              <span className="text-muted-foreground">Margen: {formatCurrency(margin)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
