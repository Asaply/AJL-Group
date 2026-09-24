import { createClient } from "@/lib/supabase/server";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { todayKey } from "@/lib/tasks";

export default async function CalendarPage() {
  const supabase = await createClient();

  const [{ data: tasks }, { data: users }, { data: projects }, { data: deliverables }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:users!assigned_to(*), project:projects(*)")
      .not("due_date", "is", null),
    supabase.from("users").select("*").order("name"),
    supabase.from("projects").select("*").eq("status", "active").order("name"),
    supabase.from("deliverables").select("*").order("position"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Calendario</h1>
      <CalendarGrid
        tasks={tasks || []}
        users={users || []}
        projects={projects || []}
        deliverables={deliverables || []}
        today={todayKey()}
      />
    </div>
  );
}
