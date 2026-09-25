import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { NotesView } from "@/components/notes/notes-view";

export default async function NotesPage() {
  const supabase = await createClient();
  const user = await getAuthUser();

  if (!user) redirect("/login");

  const [{ data: personalNotes }, { data: sharedNotes }] = await Promise.all([
    supabase
      .from("notes")
      .select("*, author:users(*)")
      .eq("is_shared", false)
      .eq("author_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("notes")
      .select("*, author:users(*)")
      .eq("is_shared", true)
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Notas</h1>
      <NotesView
        personalNotes={personalNotes || []}
        sharedNotes={sharedNotes || []}
        currentUserId={user.id}
      />
    </div>
  );
}
