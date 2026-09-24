import { createClient } from "@/lib/supabase/server";
import { PartnerCards } from "@/components/dashboard/partner-cards";
import { ActiveProjects } from "@/components/dashboard/active-projects";
import { UrgentTasks } from "@/components/dashboard/urgent-tasks";
import { QuickFinance } from "@/components/dashboard/quick-finance";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: users }, { data: projects }, { data: tasks }, { data: members }] = await Promise.all([
    supabase.from("users").select("*"),
    supabase.from("projects").select("*"),
    supabase.from("tasks").select("*, assignee:users!assigned_to(*), project:projects(*)"),
    supabase.from("project_members").select("*"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <PartnerCards
        users={users || []}
        tasks={tasks || []}
        members={members || []}
        projects={projects || []}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <ActiveProjects projects={projects || []} />
        <UrgentTasks tasks={tasks || []} />
      </div>

      <QuickFinance projects={projects || []} />
    </div>
  );
}
