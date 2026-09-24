import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
      <Card className="hover:border-primary transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <Badge variant={statusVariant[project.status]}>
              {STATUS_LABELS[project.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{project.client}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progreso</span>
              <span>{project.progress}%</span>
            </div>
            <Progress value={project.progress} />
            <div className="flex justify-between text-sm pt-2">
              <span className="text-muted-foreground">Margen: {formatCurrency(margin)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
