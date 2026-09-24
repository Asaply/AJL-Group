import { cn } from "@/lib/utils";

/** Small colored circle identifying a project. `color` is a DB-validated #RRGGBB. */
export function ProjectDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
