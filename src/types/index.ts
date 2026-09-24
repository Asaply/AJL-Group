export type ProjectStatus = "active" | "paused" | "completed";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "in_progress" | "completed";
export type TransactionType = "income" | "expense";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  start_date: string;
  end_date: string | null;
  budget: number;
  production_cost: number;
  created_at: string;
}

export interface ProjectLink {
  id: string;
  project_id: string;
  label: string;
  url: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_description: string | null;
  profit_percentage: number;
  user?: User;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  project_id: string | null;
  assigned_to: string;
  created_by: string;
  created_at: string;
  project?: Project;
  assignee?: User;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  is_shared: boolean;
  author_id: string;
  created_at: string;
  updated_at: string;
  author?: User;
}

export interface Transaction {
  id: string;
  project_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  created_by: string;
  created_at: string;
  project?: Project;
}
