-- Task detail panel: checklist, links, comments, change history, attachments.

ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER task_comments_updated_at BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  field TEXT NOT NULL CHECK (field IN (
    'created', 'title', 'status', 'priority', 'due_date',
    'assigned_to', 'project_id', 'deliverable_id', 'description'
  )),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX task_checklist_items_task_id_idx ON task_checklist_items(task_id);
CREATE INDEX task_links_task_id_idx ON task_links(task_id);
CREATE INDEX task_comments_task_id_idx ON task_comments(task_id);
CREATE INDEX task_events_task_id_created_idx ON task_events(task_id, created_at);
CREATE INDEX task_attachments_task_id_idx ON task_attachments(task_id);

-- Change history. SECURITY DEFINER so it can write task_events, which has
-- no INSERT policy for users; auth.uid() still resolves to the caller.
CREATE OR REPLACE FUNCTION public.log_task_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_events (task_id, actor_id, field) VALUES (NEW.id, auth.uid(), 'created');
    RETURN NEW;
  END IF;

  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'title', OLD.title, NEW.title);
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'priority', OLD.priority::text, NEW.priority::text);
  END IF;
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'due_date', OLD.due_date::text, NEW.due_date::text);
  END IF;
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;
  IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'project_id', OLD.project_id::text, NEW.project_id::text);
  END IF;
  IF OLD.deliverable_id IS DISTINCT FROM NEW.deliverable_id THEN
    INSERT INTO public.task_events (task_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'deliverable_id', OLD.deliverable_id::text, NEW.deliverable_id::text);
  END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO public.task_events (task_id, actor_id, field) VALUES (NEW.id, auth.uid(), 'description');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_log_changes
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_changes();

-- RLS
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task checklist: full access" ON task_checklist_items FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());
CREATE POLICY "Task links: full access" ON task_links FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());

CREATE POLICY "Task comments: read" ON task_comments FOR SELECT TO authenticated
  USING (public.is_partner());
CREATE POLICY "Task comments: insert own" ON task_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_partner() AND author_id = auth.uid());
CREATE POLICY "Task comments: update own" ON task_comments FOR UPDATE TO authenticated
  USING (public.is_partner() AND author_id = auth.uid())
  WITH CHECK (public.is_partner() AND author_id = auth.uid());
CREATE POLICY "Task comments: delete own" ON task_comments FOR DELETE TO authenticated
  USING (public.is_partner() AND author_id = auth.uid());

CREATE POLICY "Task events: read" ON task_events FOR SELECT TO authenticated
  USING (public.is_partner());

CREATE POLICY "Task attachments: read" ON task_attachments FOR SELECT TO authenticated
  USING (public.is_partner());
CREATE POLICY "Task attachments: insert own" ON task_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_partner() AND uploaded_by = auth.uid());
CREATE POLICY "Task attachments: delete own" ON task_attachments FOR DELETE TO authenticated
  USING (public.is_partner() AND uploaded_by = auth.uid());

-- Storage: private bucket, 25 MB per object. Object deletion is open to
-- partners so deleteTask can clean up other partners' files; "only the
-- uploader deletes" is enforced on the task_attachments row.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-files', 'task-files', false, 26214400)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Task files: read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-files' AND public.is_partner());
CREATE POLICY "Task files: upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files' AND public.is_partner());
CREATE POLICY "Task files: delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-files' AND public.is_partner());

ALTER PUBLICATION supabase_realtime ADD TABLE
  task_checklist_items, task_links, task_comments, task_events, task_attachments;
