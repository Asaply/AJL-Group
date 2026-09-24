-- Enums
CREATE TYPE project_status AS ENUM ('active', 'paused', 'completed');
CREATE TYPE task_priority AS ENUM ('urgent', 'high', 'medium', 'low');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

-- Users (profiles linked to auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  status project_status DEFAULT 'active',
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  budget DECIMAL(12,2) DEFAULT 0,
  production_cost DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project links
CREATE TABLE project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL
);

-- Project members
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_description TEXT,
  profit_percentage DECIMAL(5,2) DEFAULT 33.33 CHECK (profit_percentage >= 0 AND profit_percentage <= 100),
  UNIQUE(project_id, user_id)
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority DEFAULT 'medium',
  status task_status DEFAULT 'pending',
  due_date DATE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  is_shared BOOLEAN DEFAULT FALSE,
  author_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (full transparency - all authenticated users see everything)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users: all authenticated can read all, update own
CREATE POLICY "Users: read all" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users: update own" ON users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Projects: full CRUD for authenticated
CREATE POLICY "Projects: full access" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Project links: full CRUD for authenticated
CREATE POLICY "Project links: full access" ON project_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Project members: full CRUD for authenticated
CREATE POLICY "Project members: full access" ON project_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tasks: full CRUD for authenticated
CREATE POLICY "Tasks: full access" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notes: read own personal + all shared, CRUD own
CREATE POLICY "Notes: read own or shared" ON notes FOR SELECT TO authenticated
  USING (is_shared = true OR author_id = auth.uid());
CREATE POLICY "Notes: insert own" ON notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "Notes: update own" ON notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Notes: delete own" ON notes FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- Transactions: full CRUD for authenticated
CREATE POLICY "Transactions: full access" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-update updated_at on notes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Realtime: broadcast changes for live-updating dashboard views
ALTER PUBLICATION supabase_realtime ADD TABLE projects, project_members, tasks, transactions;
