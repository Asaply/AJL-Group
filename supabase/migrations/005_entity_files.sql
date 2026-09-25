-- Files (contracts, agreements, quotes, invoices) attached to a project or a
-- client. Deletion is a soft delete: the row stays (with deleted_at/by) so
-- the file list can show who deleted it and when; the storage object is
-- removed right away so it doesn't keep taking up space.

CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('contrato', 'acuerdo_nda', 'cotizacion', 'factura', 'otro')),
  custom_label TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id)
);
CREATE INDEX project_files_project_id_idx ON project_files(project_id);

CREATE TABLE client_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('contrato', 'acuerdo_nda', 'cotizacion', 'factura', 'otro')),
  custom_label TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id)
);
CREATE INDEX client_files_client_id_idx ON client_files(client_id);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_files ENABLE ROW LEVEL SECURITY;

-- Any partner reads, inserts and updates (the soft-delete is an UPDATE, not a
-- DELETE, so no DELETE policy is needed on either table).
CREATE POLICY "Project files: full access" ON project_files FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());
CREATE POLICY "Client files: full access" ON client_files FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());

-- Storage: private bucket, 25 MB per object, same limit as task-files.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('entity-files', 'entity-files', false, 26214400)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Entity files: read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'entity-files' AND public.is_partner());
CREATE POLICY "Entity files: upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'entity-files' AND public.is_partner());
CREATE POLICY "Entity files: delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'entity-files' AND public.is_partner());

ALTER PUBLICATION supabase_realtime ADD TABLE project_files, client_files;
