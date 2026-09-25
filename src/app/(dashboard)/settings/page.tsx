import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const authUser = await getAuthUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Ajustes</h1>

      <Card>
        <CardHeader><CardTitle>Perfil</CardTitle></CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contraseña</CardTitle></CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Apariencia</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span>Tema oscuro / claro</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
