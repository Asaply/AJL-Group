"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/app/(dashboard)/settings/actions";

export function PasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [key, setKey] = useState(0);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    try {
      const result = await updatePassword(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Contraseña actualizada");
        // Uncontrolled inputs: remount to clear them after a successful change.
        setKey((k) => k + 1);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      key={key}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="current_password">Contraseña actual</Label>
        <Input id="current_password" name="current_password" type="password" autoComplete="current-password" required disabled={isLoading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new_password">Nueva contraseña</Label>
        <Input id="new_password" name="new_password" type="password" autoComplete="new-password" required disabled={isLoading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirmar nueva contraseña</Label>
        <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required disabled={isLoading} />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
