"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/app/(dashboard)/settings/actions";
import type { User } from "@/types";

export function ProfileForm({ profile }: { profile: User }) {
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    try {
      const result = await updateProfile(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Perfil actualizado");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const nameInitial = profile.name.charAt(0).toUpperCase();

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex gap-6">
        {/* Avatar Preview */}
        <div className="flex flex-col items-center gap-2">
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarUrl} alt={profile.name} />
            <AvatarFallback>{nameInitial}</AvatarFallback>
          </Avatar>
          <p className="text-xs text-muted-foreground">Vista previa</p>
        </div>

        {/* Form Fields */}
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              name="name"
              defaultValue={profile.name}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              name="email"
              value={profile.email}
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar_url">URL del avatar</Label>
            <Input
              id="avatar_url"
              name="avatar_url"
              type="url"
              placeholder="https://..."
              defaultValue={profile.avatar_url || ""}
              disabled={isLoading}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
