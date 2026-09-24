import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
          <Link key={p.id} href={`/projects/${p.id}`} className="block">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground">{p.progress}%</span>
            </div>
            <Progress value={p.progress} />
          </Link>
        ))}
        {active.length === 0 && <p className="text-sm text-muted-foreground">Sin proyectos activos</p>}
      </CardContent>
    </Card>
  );
}
