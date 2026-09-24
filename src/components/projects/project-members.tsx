"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addProjectMember, updateMemberPercentage, removeProjectMember } from "@/app/(dashboard)/projects/actions";
import { percentageTotal, PERCENTAGE_TOLERANCE } from "@/lib/finance";
import type { ProjectMember, User } from "@/types";

function MemberRow({
  member, projectId,
}: {
  member: ProjectMember & { user: User };
  projectId: string;
}) {
  const [value, setValue] = useState(String(member.profit_percentage));

  async function handleBlur() {
    const percentage = parseFloat(value);
    const result = await updateMemberPercentage(member.id, projectId, percentage);
    if (result?.error) {
      toast.error(result.error);
      setValue(String(member.profit_percentage));
    }
  }

  async function handleRemove() {
    const result = await removeProjectMember(member.id, projectId);
    if (result?.error) toast.error(result.error);
  }

  return (
    <div className="flex items-center justify-between text-sm border rounded-lg p-3">
      <div>
        <p className="font-medium">{member.user.name}</p>
        <p className="text-muted-foreground">{member.role_description || "Sin rol asignado"}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          className="w-20 text-right"
        />
        <span className="text-muted-foreground">%</span>
        <Button variant="ghost" size="icon" type="button" className="h-6 w-6" onClick={handleRemove}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function ProjectMembers({
  members, projectId, allUsers,
}: {
  members: (ProjectMember & { user: User })[];
  projectId: string;
  allUsers: User[];
}) {
  const [adding, setAdding] = useState(false);
  const availableUsers = allUsers.filter((u) => !members.some((m) => m.user_id === u.id));
  const total = percentageTotal(members);
  const showWarning = Math.abs(total - 100) > PERCENTAGE_TOLERANCE;

  async function handleAdd(formData: FormData) {
    const result = await addProjectMember(projectId, formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setAdding(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Miembros</h3>
        {availableUsers.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      {adding && (
        <form action={handleAdd} className="space-y-2">
          <Select name="user_id" required>
            <SelectTrigger><SelectValue placeholder="Socio" /></SelectTrigger>
            <SelectContent>
              {availableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input name="role_description" placeholder="Rol en proyecto" />
          <Input name="profit_percentage" type="number" step="0.01" defaultValue="33.33" placeholder="%" />
          <Button type="submit" size="sm">Agregar</Button>
        </form>
      )}
      {members.map((member) => (
        <MemberRow key={member.id} member={member} projectId={projectId} />
      ))}
      {members.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Sin miembros asignados</p>
      )}
      {members.length > 0 && (
        <p className={showWarning ? "text-sm font-medium text-red-500" : "text-sm text-muted-foreground"}>
          Los porcentajes suman {total}%{showWarning ? ", deben sumar 100%" : ""}
        </p>
      )}
    </div>
  );
}
