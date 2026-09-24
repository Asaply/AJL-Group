import { Progress } from "@/components/ui/progress";
import { projectProgress } from "@/lib/deliverables";

export function ProjectProgressBar({
  deliverables,
  color,
  showCount = true,
}: {
  deliverables: { weight: number | string; approved_at: string | null }[];
  color: string;
  showCount?: boolean;
}) {
  const progress = projectProgress(deliverables);

  if (progress === null) {
    return <p className="text-sm text-muted-foreground">Sin entregables</p>;
  }

  const approved = deliverables.filter((d) => d.approved_at).length;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>Progreso</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} indicatorColor={color} />
      {showCount && (
        <p className="text-xs text-muted-foreground">
          {approved} de {deliverables.length} entregables aprobados
        </p>
      )}
    </div>
  );
}
