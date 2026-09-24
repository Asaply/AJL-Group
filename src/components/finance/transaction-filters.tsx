"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import type { Project } from "@/types";

export function TransactionFilters({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Select value={searchParams.get("type") || "all"} onValueChange={(v) => setParam("type", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("project") || "all"} onValueChange={(v) => setParam("project", v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Proyecto" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los proyectos</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="space-y-2">
        <Label htmlFor="from" className="text-xs text-muted-foreground">Desde</Label>
        <Input
          id="from"
          type="date"
          className="w-40"
          value={searchParams.get("from") || ""}
          onChange={(e) => setParam("from", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="to" className="text-xs text-muted-foreground">Hasta</Label>
        <Input
          id="to"
          type="date"
          className="w-40"
          value={searchParams.get("to") || ""}
          onChange={(e) => setParam("to", e.target.value)}
        />
      </div>
    </div>
  );
}
