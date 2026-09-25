import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { Sidebar } from "@/components/sidebar";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { TaskDetailSheet } from "@/components/tasks/detail/task-detail-sheet";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const authUser = await getAuthUser();

  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">No se encontró tu perfil. Contacta a un socio.</p>
          <form action={logout}>
            <Button type="submit">Cerrar sesión</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar user={profile} />
      <RealtimeRefresh />
      <Suspense fallback={null}>
        <TaskDetailSheet />
      </Suspense>
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
