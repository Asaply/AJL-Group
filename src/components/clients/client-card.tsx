import Link from "next/link";
import { Building2, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { CLIENT_STATUS_LABELS } from "@/lib/clients";
import type { Client } from "@/types";

const STATUS_VARIANT = { active: "default", prospect: "secondary", inactive: "outline" } as const;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function ClientCard({ client }: { client: Client }) {
  const contacts = client.contacts ?? [];
  const primary = contacts.find((c) => c.is_primary) ?? contacts[0];
  const projects = client.projects ?? [];
  const active = projects.filter((p) => p.status === "active").length;
  const meta = [client.industry, client.city].filter(Boolean).join(" · ");

  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-start gap-3">
            <ClientAvatar name={client.name} logoPath={client.logo_path} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{client.name}</p>
              {meta && <p className="text-sm text-muted-foreground truncate">{meta}</p>}
            </div>
            <Badge variant={STATUS_VARIANT[client.status]}>{CLIENT_STATUS_LABELS[client.status]}</Badge>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{primary ? `${primary.name}${primary.is_primary ? " (principal)" : ""}` : "Sin contactos"}</span>
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>
              {plural(projects.length, "proyecto", "proyectos")} ({plural(active, "activo", "activos")})
            </span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
