-- Client portfolio: clients, contacts, per-project contact roles, logos.
-- projects.client (free text) is migrated into clients and dropped.

CREATE TYPE client_status AS ENUM ('prospect', 'active', 'inactive');

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status client_status NOT NULL DEFAULT 'active',
  industry TEXT,
  website TEXT,
  city TEXT,
  notes TEXT,
  legal_name TEXT,
  rfc TEXT CHECK (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  tax_regime TEXT,
  tax_address TEXT,
  cfdi_use TEXT,
  logo_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX client_contacts_one_primary ON client_contacts(client_id) WHERE is_primary;

CREATE TABLE project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES client_contacts(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, contact_id)
);

ALTER TABLE projects ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Data migration: one client per distinct (case/space-insensitive) text value.
INSERT INTO clients (name, status)
SELECT DISTINCT ON (lower(btrim(client))) btrim(client), 'active'::client_status
FROM projects
WHERE btrim(coalesce(client, '')) <> ''
ORDER BY lower(btrim(client)), created_at;

UPDATE projects p
SET client_id = c.id
FROM clients c
WHERE lower(btrim(p.client)) = lower(c.name);

ALTER TABLE projects DROP COLUMN client;

CREATE INDEX client_contacts_client_id_idx ON client_contacts(client_id);
CREATE INDEX project_contacts_project_id_idx ON project_contacts(project_id);
CREATE INDEX project_contacts_contact_id_idx ON project_contacts(contact_id);
CREATE INDEX projects_client_id_idx ON projects(client_id);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients: full access" ON clients FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());
CREATE POLICY "Client contacts: full access" ON client_contacts FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());
CREATE POLICY "Project contacts: full access" ON project_contacts FOR ALL TO authenticated
  USING (public.is_partner()) WITH CHECK (public.is_partner());

-- Logos: public bucket (brand images, unguessable paths); only partners write.
-- The Storage API needs SELECT to delete objects, so partners also get SELECT.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-logos', 'client-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Client logos: read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-logos' AND public.is_partner());
CREATE POLICY "Client logos: upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-logos' AND public.is_partner());
CREATE POLICY "Client logos: delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-logos' AND public.is_partner());

ALTER PUBLICATION supabase_realtime ADD TABLE clients, client_contacts, project_contacts;
