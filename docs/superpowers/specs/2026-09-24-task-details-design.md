# Detalle de Pendiente — Design Spec

**Date:** 2026-09-24
**Status:** Approved (pending written-spec review)
**Extends:** `2026-09-24-ajl-group-dashboard-design.md`, `2026-09-24-project-color-deliverables-design.md`

---

## 1. Objetivo

Al dar click en un pendiente se abre un panel de detalle donde los socios pueden editar todos sus campos, escribir una descripción en markdown, llevar una checklist, adjuntar links y archivos, comentar, y ver el historial automático de cambios.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Notas/observaciones | Descripción editable (markdown) + hilo de comentarios |
| Archivos | Cualquier tipo, máx. 25 MB c/u, Supabase Storage privado |
| Vista | Panel lateral (Sheet) con `?task=<id>` en la URL |
| Extras | Editar todos los campos, checklist, historial de cambios, links |
| Historial | Trigger Postgres (no se puede saltar) |
| Comentarios vs historial | Tablas separadas, mezcladas en un timeline en UI |
| Subida | Navegador → Storage directo (RLS en bucket); descarga por signed URL (60 s) |

## 3. Modelo de datos — `supabase/migrations/003_task_details.sql`

### tasks (cambios)
| Column | Type | Notes |
|--------|------|-------|
| updated_at | timestamptz NOT NULL DEFAULT now() | trigger `update_updated_at()` (ya existe en 001) |
| description | text | sin cambio de tipo; ahora se trata como markdown |

### task_checklist_items
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK NOT NULL | → tasks ON DELETE CASCADE |
| text | text NOT NULL | |
| done | boolean NOT NULL DEFAULT false | |
| position | int NOT NULL DEFAULT 0 | |
| created_at | timestamptz DEFAULT now() | |

### task_links
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK NOT NULL | → tasks ON DELETE CASCADE |
| label | text NOT NULL | |
| url | text NOT NULL | solo http/https (app, `parseHttpUrl`) |
| created_at | timestamptz DEFAULT now() | |

### task_comments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK NOT NULL | → tasks ON DELETE CASCADE |
| author_id | uuid FK NOT NULL | → users |
| body | text NOT NULL | markdown |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | trigger `update_updated_at()` |

### task_events
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK NOT NULL | → tasks ON DELETE CASCADE |
| actor_id | uuid FK | → users, nullable (cambios hechos con service role) |
| field | text NOT NULL | `created`, `title`, `status`, `priority`, `due_date`, `assigned_to`, `project_id`, `deliverable_id`, `description` |
| old_value | text | nullable |
| new_value | text | nullable (para `description` ambos nulos) |
| created_at | timestamptz DEFAULT now() | |

### task_attachments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK NOT NULL | → tasks ON DELETE CASCADE |
| uploaded_by | uuid FK NOT NULL | → users |
| storage_path | text NOT NULL UNIQUE | `<task_id>/<uuid>-<nombre-saneado>` |
| file_name | text NOT NULL | nombre original para mostrar |
| size_bytes | bigint NOT NULL | CHECK 0 < size ≤ 26214400 |
| mime_type | text | nullable |
| created_at | timestamptz DEFAULT now() | |

### Trigger `tasks_log_changes`
- `AFTER INSERT ON tasks` → evento `created` (actor `auth.uid()`).
- `AFTER UPDATE ON tasks FOR EACH ROW` → por cada campo en {title, status, priority, due_date, assigned_to, project_id, deliverable_id} con `OLD IS DISTINCT FROM NEW`, inserta `(task_id, auth.uid(), field, OLD::text, NEW::text)`; si cambió `description`, inserta `(…, 'description', NULL, NULL)`.
- Función `SECURITY DEFINER SET search_path = ''` (escribe en `task_events` aunque el usuario no tenga INSERT).

### RLS
- `task_checklist_items`, `task_links`: `FOR ALL TO authenticated USING (public.is_partner()) WITH CHECK (public.is_partner())`.
- `task_comments`: SELECT partner; INSERT partner AND `author_id = auth.uid()`; UPDATE/DELETE partner AND `author_id = auth.uid()` (UPDATE con WITH CHECK igual).
- `task_events`: SELECT partner; sin políticas de INSERT/UPDATE/DELETE (solo el trigger escribe).
- `task_attachments`: SELECT partner; INSERT partner AND `uploaded_by = auth.uid()`; DELETE partner AND `uploaded_by = auth.uid()`; sin UPDATE.

### Storage
- Bucket `task-files`: `public = false`, `file_size_limit = 26214400` (25 MB).
- Políticas en `storage.objects` para `bucket_id = 'task-files'`: SELECT, INSERT y DELETE si `public.is_partner()`. La regla "solo quien subió borra" se aplica en la fila de `task_attachments` (RLS), no en el objeto: así `deleteTask` puede limpiar archivos subidos por otro socio. `deleteAttachment` solo borra el objeto si su fila se borró (1 fila afectada).

### Índices y realtime
- Índices: `task_id` en las 5 tablas nuevas; `task_events(task_id, created_at)`.
- `ALTER PUBLICATION supabase_realtime ADD TABLE task_checklist_items, task_links, task_comments, task_events, task_attachments;`

## 4. Reglas de negocio

- **Edición de campos:** `title` trim no vacío; `status` ∈ {pending, in_progress, completed}; `priority` ∈ {urgent, high, medium, low}; `due_date` `YYYY-MM-DD` válido o vacío (→ null); `assigned_to` requerido; `project_id` id o vacío (→ null); `deliverable_id` id o vacío. Campos fuera de esta lista → `"Campo no editable"`.
- Cambiar `project_id`: si el `deliverable_id` actual no pertenece al nuevo proyecto → se pone `null` en el mismo UPDATE.
- Cambiar `deliverable_id` (no nulo): debe pertenecer al `project_id` del pendiente → si no `"El entregable no pertenece a este proyecto"`.
- **Checklist:** texto trim no vacío (`"El paso no puede estar vacío"`); orden por `position`; mover reutiliza `moveItem`.
- **Links:** etiqueta trim no vacía (`"La etiqueta es obligatoria"`); URL vía `parseHttpUrl` (`"La URL no es válida"`).
- **Comentarios:** cuerpo trim no vacío (`"El comentario no puede estar vacío"`); editar/borrar solo el autor; 0 filas afectadas → `"No puedes editar este comentario"` / `"No puedes eliminar este comentario"`; muestra "(editado)" si `updated_at > created_at` por más de 1 s.
- **Archivos:** tamaño > 25 MB → rechazado en cliente antes de subir (`"El archivo supera 25 MB"`); el bucket también lo rechaza. Orden: subir a Storage → `registerAttachment` → si el registro falla, el cliente borra el objeto subido. Borrar: `deleteAttachment` borra la fila (RLS: solo quien subió) y luego el objeto; 0 filas → `"No puedes eliminar este archivo"`. Descarga: `getAttachmentUrl` → signed URL 60 s.
- **Borrar pendiente:** `deleteTask` lista los `storage_path` de sus adjuntos, los borra del bucket y luego borra la fila (cascade limpia metadatos). Si el borrado en Storage falla, se loguea y se continúa con la fila.
- **Timeline:** comentarios + eventos en orden cronológico ascendente (lo más nuevo abajo); empate por `created_at` → eventos antes que comentarios.

## 5. Lógica pura

`src/lib/task-events.ts`
- `describeEvent(event: TaskEvent, lookups: { users: User[]; projects: Project[]; deliverables: Deliverable[] }): string` — texto en español: `"<Actor> creó el pendiente"`, `"<Actor> cambió el título"`, `"<Actor> cambió el estado Pendiente → En progreso"`, prioridad con `PRIORITY_LABELS`, fechas con `formatDate` (vacío → "sin fecha"), asignado/proyecto/entregable por nombre (null → "ninguno"; id desconocido → "(eliminado)"), `"<Actor> editó la descripción"`. Actor nulo → "Alguien".
- `mergeTimeline(comments: TaskComment[], events: TaskEvent[]): TimelineItem[]` con `TimelineItem = { kind: "comment"; item: TaskComment } | { kind: "event"; item: TaskEvent }`.

`src/lib/attachments.ts`
- `MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024`
- `validateUpload(file: { size: number }): string | null`
- `sanitizeFileName(name: string): string` — quita rutas (`/`, `\`), `..`, caracteres de control; espacios → `-`; recorta a 100; vacío → `"archivo"`.
- `storagePath(taskId: string, fileName: string, id: string): string` → `${taskId}/${id}-${sanitizeFileName(fileName)}`
- `formatFileSize(bytes: number): string` → `"512 B"`, `"1.2 KB"`, `"3.4 MB"`
- `isImage(mime: string | null): boolean`

`src/lib/task-update.ts`
- `EDITABLE_TASK_FIELDS` y `parseTaskField(field: string, value: unknown): { ok: true; field; value: string | null } | { ok: false; error: string }`
- `checklistProgress(items: { done: boolean }[]): { done: number; total: number }`

## 6. UI

- **Abrir:** click en tarjeta de `/tasks`, chip del calendario, fila de "Pendientes urgentes" del dashboard, fila de pendientes del detalle de proyecto y pendientes dentro de un entregable → `openTask(id)` (helper cliente que hace `router.push` conservando los demás searchParams + `task=<id>`). Controles internos (select de estado, borrar, checkbox) hacen `stopPropagation`.
- **Montaje:** `<TaskDetailSheet />` en `src/app/(dashboard)/layout.tsx`, lee `useSearchParams().get("task")`; cerrar quita el param.
- **Panel (shadcn `Sheet`, lado derecho, `sm:max-w-[560px]`, pantalla completa en pantallas chicas):** encabezado con punto de color del proyecto + "proyecto › entregable"; título editable (guarda en blur/Enter); selects Estado, Prioridad, Asignado, Proyecto, Entregable (filtrado por proyecto) y fecha límite (guardan al cambiar); Descripción con Editar/Vista previa (`react-markdown`, sin rehype-raw) y auto-guardado debounce 1 s; Checklist con barra de progreso, toggle, edición inline, ↑↓, borrar, "+ Agregar paso"; Links con agregar/borrar; Archivos con botón "Subir" + arrastrar/soltar, indicador "Subiendo…" por archivo (supabase-js `upload` no expone porcentaje), miniatura para imágenes (signed URL), ícono para el resto, tamaño, quién y cuándo, descargar, borrar (solo quien subió); Actividad: timeline + textarea "Escribe un comentario… (markdown)" + Enviar; comentarios propios con editar/borrar.
- **Estados:** cargando (skeleton), "Pendiente no encontrado" si no existe/sin acceso.
- **Tarjeta de pendiente (`TaskCard`):** muestra "☑ n/m" si tiene checklist y "📎 n" si tiene archivos (la lista de `/tasks` selecciona conteos `task_checklist_items(done)` y `task_attachments(count)`).
- **Realtime del panel:** canal propio filtrado por `task_id` (5 tablas) + `tasks` por `id`, refetch con debounce 300 ms (`createDebouncedRefresh`).

## 7. Server actions

`src/app/(dashboard)/tasks/detail-actions.ts`: `getTaskDetail(id)`, `updateTaskField(id, field, value)`, `addChecklistItem(taskId, text)`, `updateChecklistItem(id, taskId, patch: { text?: string; done?: boolean })`, `moveChecklistItem(id, taskId, direction)`, `deleteChecklistItem(id, taskId)`, `addTaskLink(taskId, formData)`, `deleteTaskLink(id, taskId)`, `addComment(taskId, body)`, `updateComment(id, taskId, body)`, `deleteComment(id, taskId)`, `registerAttachment(taskId, meta: { storage_path; file_name; size_bytes; mime_type })` (verifica que `storage_path` empiece con `${taskId}/`), `deleteAttachment(id, taskId)`, `getAttachmentUrl(id, taskId)`.
Cambios: `deleteTask` limpia Storage antes de borrar.
Todas: validación con mensajes en español; errores de DB vía `actionError`; mutaciones filtran por `id` y `task_id`; revalidan `("/", "layout")`.

## 8. Testing

- Unit (TDD): `task-events.test.ts` (cada campo, null/eliminado/actor nulo, orden y empate del timeline), `attachments.test.ts` (límite exacto 25 MB y +1 byte, `../../etc/passwd` → sin rutas, nombre vacío, recorte 100, formatos de tamaño, isImage), `task-update.test.ts` (cada campo válido/inválido, campo no editable, progreso de checklist).
- Componentes: click en `TaskCard` llama `openTask` y el select de estado no; toggle de checklist llama la acción; comentario ajeno sin botones de editar/borrar.
- Integración contra Supabase local: aplicar 003; UPDATE de estado genera `task_events` con actor correcto; comentario de Alan no editable por Leo (RLS); subir 1 MB, signed URL descarga; 26 MB rechazado por el bucket; Alan no puede borrar archivo de Leo; borrar pendiente elimina su objeto del bucket.
- `tsc --noEmit`, `lint`, `npm test`, build con env dummy: limpios.

## 9. Fuera de alcance

Menciones @, notificaciones, versiones de archivos, preview de PDF embebido (se abre en pestaña nueva), editar checklist desde la tarjeta, historial de ediciones de comentarios.
