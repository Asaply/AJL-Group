"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import type { Project, User } from "@/types";

export function TaskFilters({ users, projects }: { users: User[]; projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-4">
      <Select value={searchParams.get("priority") || "all"} onValueChange={(v) => setParam("priority", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Prioridad" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las prioridades</SelectItem>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("status") || "all"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los status</SelectItem>
          {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("assigned") || "all"} onValueChange={(v) => setParam("assigned", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Asignado a" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los asignados</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("project") || "all"} onValueChange={(v) => setParam("project", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Proyecto" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los proyectos</SelectItem>
          <SelectItem value="none">General (sin proyecto)</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
