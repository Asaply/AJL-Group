import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { User, Task, ProjectMember, Project } from "@/types";

export function PartnerCards({
  users,
  tasks,
  members,
  projects,
}: {
  users: User[];
  tasks: Task[];
  members: ProjectMember[];
  projects: Project[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {users.map((user) => {
        const userTasks = tasks.filter((t) => t.assigned_to === user.id && t.status !== "completed");
        const userProjects = members
          .filter((m) => m.user_id === user.id)
          .map((m) => projects.find((p) => p.id === m.project_id))
          .filter((p): p is Project => !!p && p.status === "active");

        return (
          <Card key={user.id}>
            <CardHeader className="pb-2">
              <CardTitle>{user.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {userTasks.length === 1 ? "1 pendiente" : `${userTasks.length} pendientes`}
              </p>
              {userProjects.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {userProjects.map((p) => (
                    <Badge key={p.id} variant="secondary" className="text-xs">
                      {p.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin proyectos activos</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
