# Archivos de Proyectos y Clientes — Design Spec

**Date:** 2026-09-25
**Status:** Approved

---

## 1. Objetivo

Cada proyecto y cada cliente puede tener archivos adjuntos (contratos, acuerdos/NDA, cotizaciones, facturas, otros). Subir y borrar está abierto a cualquier socio. Un archivo borrado no desaparece: queda tachado en la misma lista con quién lo borró y cuándo, sin tabla de bitácora aparte.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Tipo de documento | Lista fija (`contrato`, `acuerdo_nda`, `cotizacion`, `factura`, `otro`) + etiqueta libre solo cuando es `otro` |
| Permisos | Cualquier socio sube y borra cualquier archivo (todos los usuarios son socios vía `is_partner()`) |
| Auditoría de borrado | Soft delete: `deleted_at` + `deleted_by` en la fila; el objeto en Storage se borra de inmediato, la fila se queda para siempre |
| Modelo de datos | Dos tablas espejo (`project_files`, `client_files`), cada una con FK real `ON DELETE CASCADE` — no una tabla polimórfica, para no perder la limpieza automática que ya usan `deliverables`, `client_contacts`, etc. |
| Storage | Un bucket privado `entity-files`, mismo límite de 25 MB que `task-files` |
| UI | Un componente compartido, reutilizado en el detalle de proyecto y de cliente |

## 3. Modelo de datos — `supabase/migrations/005_entity_files.sql`

### `project_files` / `client_files` (misma forma)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | `gen_random_uuid()` |
| project_id / client_id | uuid NOT NULL | FK `ON DELETE CASCADE` |
| storage_path | text NOT NULL UNIQUE | `{entity}/{owner_id}/{id}-{sanitized_name}` |
| file_name | text NOT NULL | nombre original |
| size_bytes | bigint NOT NULL | |
| mime_type | text | nullable |
| doc_type | text NOT NULL CHECK IN (`contrato`,`acuerdo_nda`,`cotizacion`,`factura`,`otro`) | |
| custom_label | text | solo relevante si `doc_type = 'otro'` |
| uploaded_by | uuid NOT NULL REFERENCES users(id) | |
| created_at | timestamptz DEFAULT now() | |
| deleted_at | timestamptz | null = activo |
| deleted_by | uuid REFERENCES users(id) | null hasta que se borra |

Índices: `(project_id)` / `(client_id)`.

RLS: `FOR ALL TO authenticated USING (is_partner()) WITH CHECK (is_partner())` — subir, listar, y el `UPDATE` que hace el soft-delete están abiertos a cualquier socio. No hay `DELETE` real sobre la fila (el borrado es un `UPDATE`), así que no se necesita policy de `DELETE`.

### Storage bucket `entity-files`

Privado, `file_size_limit = 26214400` (25 MB), igual que `task-files`. Policies de `storage.objects` para `SELECT`/`INSERT`/`DELETE` con `bucket_id = 'entity-files' AND is_partner()`.

### Realtime

`ALTER PUBLICATION supabase_realtime ADD TABLE project_files, client_files;`

## 4. Lógica pura (server-agnostic, testeada por separado)

`src/lib/entity-files.ts` — generaliza lo que ya existe en `src/lib/attachments.ts` para que ambos lo compartan:

- `validateUpload(file)` — igual que hoy (0 < size ≤ 25 MB)
- `sanitizeFileName(name)` — igual que hoy
- `storagePath(entity, ownerId, fileName, id)` — `{entity}/{ownerId}/{id}-{name}`, `entity` es `"project" | "client"`
- `formatFileSize`, `isImage` — reusadas tal cual
- `DOC_TYPE_LABELS` — mapa de tipo → etiqueta en español, usado por el badge y el selector
- `parseFileMeta(ownerId, entity, meta)` — valida lo que manda el cliente antes de registrar la fila (mismo propósito que `parseAttachmentMeta`)
- `describeFileLabel(file)` — texto a mostrar: la etiqueta del tipo, o `custom_label` si es `otro`

`src/lib/attachments.ts` no se toca: sigue siendo específico de `task_attachments` (mismo patrón de nombres, sin duplicar código real porque las funciones puras compartidas viven en el archivo nuevo; una futura limpieza podría unificarlos, fuera de alcance aquí).

## 5. Server actions

Dos módulos delgados (Supabase exige el nombre de tabla como literal):

- `src/app/(dashboard)/projects/file-actions.ts`: `listProjectFiles`, `registerProjectFile`, `softDeleteProjectFile`, `getProjectFileUrl`
- `src/app/(dashboard)/clients/file-actions.ts`: mismas cuatro, para `client_files`

Cada acción llama a las funciones puras de `entity-files.ts` para validar y arma la query. `softDelete*` hace `UPDATE ... SET deleted_at = now(), deleted_by = user.id WHERE id = ... AND deleted_at IS NULL`, borra el objeto de Storage, y revalida.

## 6. Componente UI

`src/components/files/file-manager.tsx` — recibe `files`, `ownerId`, `entity: "project" | "client"`, y las cuatro server actions como props (inyección de dependencias, como hace `TaskAttachments` con las suyas propias hoy, para poder testear con mocks). Responsabilidades:

- Selector de tipo de documento + campo de etiqueta libre (solo visible si el tipo es "otro"), aplica al lote que se está por subir
- Zona de arrastrar y soltar + selector de archivo, igual que `TaskAttachments`
- Lista de archivos activos: nombre, tipo (badge), tamaño, quién y cuándo subió, botón de tipo editable (clic para cambiar, como el texto del checklist), descargar, borrar
- Archivos borrados: mismos, tachados, con "Eliminado por {nombre} el {fecha}" en vez de los botones de acción
- Cambiar el tipo de un archivo ya subido es un `UPDATE` directo de `doc_type`/`custom_label` (no pasa por las cuatro acciones de arriba; se agrega una quinta acción `updateProjectFileType` / `updateClientFileType` por módulo)

Se usa así:
- `src/app/(dashboard)/projects/[id]/page.tsx`: nueva `Card` "Archivos" junto a Entregables
- `src/app/(dashboard)/clients/[id]/page.tsx`: nueva `Card` "Archivos" junto a Notas

## 7. Pruebas

- `entity-files.test.ts`: funciones puras (saneado, ruta, validación, parseo de meta, etiqueta a mostrar)
- `file-manager.test.tsx`: subir (éxito y error), cambiar tipo, borrar y ver el registro tachado con atribución, arrastrar y soltar
- Sin pruebas de Storage real (se mockea, como ya hace `task-attachments.test.tsx`)

## 8. Fuera de alcance

- Versionado de archivos (subir una v2 del mismo contrato)
- Previsualización de PDF/imagen inline
- Restaurar un archivo borrado
- Unificar `attachments.ts` y `entity-files.ts` en un solo módulo genérico
