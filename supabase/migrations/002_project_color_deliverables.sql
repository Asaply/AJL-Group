-- Project color (shown across the app) and deliverable-based progress.
-- Progress is derived from approved deliverables in the app, so the manual
-- projects.progress column is dropped.

ALTER TABLE projects
  ADD COLUMN color TEXT NOT NULL DEFAULT '#6366F1'
  CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE projects DROP COLUMN progress;

CREATE TABLE deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  weight DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks
  ADD COLUMN deliverable_id UUID REFERENCES deliverables(id) ON DELETE SET NULL;

CREATE INDEX deliverables_project_id_idx ON deliverables(project_id);
CREATE INDEX tasks_deliverable_id_idx ON tasks(deliverable_id);

ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deliverables: full access" ON deliverables FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());

ALTER PUBLICATION supabase_realtime ADD TABLE deliverables;
