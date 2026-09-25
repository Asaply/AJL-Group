"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS } from "@/lib/constants";
import type { Client, User } from "@/types";

export function ProjectFilters({
  users,
  clients,
}: {
  users: User[];
  clients: Pick<Client, "id" | "name">[];
}) {
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
      <Select value={searchParams.get("status") || "all"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("member") || "all"} onValueChange={(v) => setParam("member", v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Socio asignado" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los socios</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("client") || "all"} onValueChange={(v) => setParam("client", v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Cliente" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los clientes</SelectItem>
          <SelectItem value="none">Sin cliente</SelectItem>
          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
