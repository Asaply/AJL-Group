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
  color: string;
  start_date: string;
  end_date: string | null;
  budget: number;
  production_cost: number;
  created_at: string;
  deliverables?: Deliverable[];
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

export interface Deliverable {
  id: string;
  project_id: string;
  title: string;
  weight: number;
  approved_at: string | null;
  approved_by: string | null;
  position: number;
  created_at: string;
  approver?: User | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  project_id: string | null;
  deliverable_id: string | null;
  assigned_to: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  project?: Project;
  deliverable?: Deliverable | null;
  assignee?: User;
  checklist?: { done: boolean }[];
  attachments?: { count: number }[];
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

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface TaskLink {
  id: string;
  task_id: string;
  label: string;
  url: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author?: User | null;
}

export type TaskEventField =
  | "created"
  | "title"
  | "status"
  | "priority"
  | "due_date"
  | "assigned_to"
  | "project_id"
  | "deliverable_id"
  | "description";

export interface TaskEvent {
  id: string;
  task_id: string;
  actor_id: string | null;
  field: TaskEventField;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  actor?: User | null;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
  uploader?: User | null;
}

export interface TaskDetail {
  task: Task & { deliverable?: Deliverable | null };
  checklist: TaskChecklistItem[];
  links: TaskLink[];
  comments: TaskComment[];
  events: TaskEvent[];
  attachments: TaskAttachment[];
  users: User[];
  projects: Project[];
  deliverables: Deliverable[];
  currentUserId: string;
}
