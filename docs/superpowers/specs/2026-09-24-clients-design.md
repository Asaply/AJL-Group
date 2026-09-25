# Portafolio de Clientes — Design Spec

**Date:** 2026-09-24
**Status:** Approved (pending written-spec review)
**Extends:** `2026-09-24-ajl-group-dashboard-design.md`, `2026-09-24-project-color-deliverables-design.md`, `2026-09-24-task-details-design.md`

---

## 1. Objetivo

Sección "Clientes" con el portafolio de clientes: datos básicos, estado, datos fiscales, logo, contactos (con rol por proyecto), proyectos ligados, resumen financiero y pendientes abiertos. Los proyectos pasan de un texto libre de cliente a una liga opcional a un cliente del portafolio.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Relación proyecto↔cliente | `projects.client_id` opcional (FK); el texto `projects.client` se migra a clientes y se elimina |
| Datos del cliente | Básicos + estado (prospecto/activo/inactivo) + fiscales + logo |
| Contactos | Estándar (nombre, puesto, email, teléfono, WhatsApp, notas, principal) + rol por proyecto |
| Ficha | Datos, contactos, proyectos, resumen financiero, pendientes abiertos, fiscales, notas |
| Lista | Búsqueda (cliente y contactos) + filtros estado e industria |
| Vista | Páginas `/clients` y `/clients/[id]` |
| Logos | Bucket público `client-logos` (png/jpeg/webp, ≤ 2 MB), rutas no adivinables; SVG excluido (puede contener scripts) |

## 3. Modelo de datos — `supabase/migrations/004_clients.sql`

### Enum
`CREATE TYPE client_status AS ENUM ('prospect', 'active', 'inactive');`

### clients
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | nombre comercial |
| status | client_status NOT NULL DEFAULT 'active' | |
| industry | text | nullable |
| website | text | nullable; solo http/https (app) |
| city | text | nullable |
| notes | text | nullable; markdown |
| legal_name | text | razón social |
| rfc | text | nullable; CHECK `rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'` |
| tax_regime | text | nullable |
| tax_address | text | nullable |
| cfdi_use | text | nullable |
| logo_path | text | nullable; ruta en `client-logos` |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | trigger `update_updated_at()` |

### client_contacts
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| client_id | uuid FK NOT NULL | → clients ON DELETE CASCADE |
| name | text NOT NULL | |
| position | text | nullable |
| email | text | nullable |
| phone | text | nullable |
| whatsapp | text | nullable |
| notes | text | nullable |
| is_primary | boolean NOT NULL DEFAULT false | UNIQUE INDEX parcial `(client_id) WHERE is_primary` |
| created_at | timestamptz DEFAULT now() | |

### project_contacts
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK NOT NULL | → projects ON DELETE CASCADE |
| contact_id | uuid FK NOT NULL | → client_contacts ON DELETE CASCADE |
| role | text | nullable (ej. "Aprueba diseño") |
| created_at | timestamptz DEFAULT now() | |
| | | UNIQUE (project_id, contact_id) |

Constraint app-level: el contacto debe pertenecer a `projects.client_id`.

### projects (cambios)
- `ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL`
- **Migración de datos:** por cada valor distinto de `lower(btrim(client))` no vacío, insertar un cliente (`name` = primer valor original `btrim`, `status = 'active'`) y actualizar `projects.client_id` de los proyectos cuyo `lower(btrim(client))` coincide.
- `DROP COLUMN client`.

### Índices, RLS, realtime, Storage
- Índices: `client_contacts(client_id)`, `project_contacts(project_id)`, `project_contacts(contact_id)`, `projects(client_id)`.
- RLS en las 3 tablas: `FOR ALL TO authenticated USING (public.is_partner()) WITH CHECK (public.is_partner())`.
- `ALTER PUBLICATION supabase_realtime ADD TABLE clients, client_contacts, project_contacts;` y agregarlas a `REALTIME_TABLES`.
- Bucket `client-logos`: `public = true`, `file_size_limit = 2097152`, `allowed_mime_types = {image/png, image/jpeg, image/webp}`. Políticas en `storage.objects` con `bucket_id = 'client-logos'`: INSERT y DELETE si `public.is_partner()` (la lectura es pública por ser bucket público; no se crea política SELECT adicional).

## 4. Reglas de negocio

- **Cliente:** nombre trim no vacío (`"El nombre es obligatorio"`); estado ∈ enum (`"Estado inválido"`); sitio web vacío o `parseHttpUrl` (`"El sitio web no es válido"`); RFC vacío o, en mayúsculas, que cumpla el patrón (`"El RFC no es válido"`); demás campos trim, vacío → null.
- **Contacto:** nombre trim no vacío (`"El nombre es obligatorio"`); email vacío o `^[^\s@]+@[^\s@]+\.[^\s@]+$` (`"El email no es válido"`); teléfono y WhatsApp vacíos o solo `+`, dígitos, espacios, guiones y paréntesis con 10–15 dígitos (`"El teléfono no es válido"` / `"El WhatsApp no es válido"`).
- **Principal:** `setPrimaryContact(id, clientId)` desmarca los demás del cliente y marca el elegido; el índice único garantiza uno como máximo.
- **Rol en proyecto:** `linkProjectContact` requiere que el proyecto tenga cliente y que el contacto sea de ese cliente (`"El contacto no pertenece al cliente del proyecto"`); duplicado → `"Este contacto ya está ligado al proyecto"`.
- **Cliente de un proyecto:** `client_id` vacío/`"none"` → null; si no nulo debe existir (`"Cliente no encontrado"`). Al cambiar el cliente de un proyecto se eliminan sus `project_contacts`.
- **Borrar cliente:** confirma "Sus N proyectos quedarán sin cliente"; borra la fila (proyectos → `client_id` null, contactos y sus roles en cascada) y después el objeto del logo (fallo → log).
- **Logo:** cliente valida tipo/tamaño antes de subir (`"El logo debe ser PNG, JPG o WEBP de máximo 2 MB"`); ruta `<clientId>/<uuid>.<png|jpg|webp>`; `setClientLogo` verifica la ruta exacta con `parseLogoPath`, guarda y borra el logo anterior; si falla, el cliente borra el objeto recién subido.
- **Búsqueda:** `q` trim; se escapan `%`, `_`, `,`, `(`, `)`; clientes cuyo `name ilike %q%` ∪ clientes con algún contacto cuyo `name|email|phone ilike %q%`; filtro final `.in("id", ids)` (sin ids → centinela NIL UUID).

## 5. Lógica pura

`src/lib/clients.ts`
- `CLIENT_STATUSES`, `CLIENT_STATUS_LABELS = { prospect: "Prospecto", active: "Activo", inactive: "Inactivo" }`
- `parseClientForm(formData): ParseResult<ClientFormValues>`
- `parseContactForm(formData): ParseResult<ContactFormValues>`
- `isValidRfc(value: string): boolean`
- `whatsappLink(phone: string): string | null` — solo dígitos; 10 dígitos → prefijo `52`; < 10 o > 15 → null
- `clientInitials(name: string): string` — ignora títulos (`dr`, `dra`, `lic`, `ing`, `arq`, `mtro`, `mtra`, con o sin punto), primeras letras de las dos primeras palabras restantes, mayúsculas; vacío → `"?"`
- `clientColor(name: string): string` — hash estable del nombre → `PROJECT_COLORS[i]`
- `escapeIlike(q: string): string`
- `clientSummary(projects, transactions): { income; cost; margin; txIncome; txExpense; txNet; projectCount; activeProjectCount }`

`src/lib/client-logo.ts`
- `MAX_LOGO_BYTES = 2 * 1024 * 1024`, `LOGO_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }`
- `validateLogo(file: { size: number; type: string }): string | null`
- `logoPath(clientId, id, mime): string`
- `parseLogoPath(clientId, path: unknown): string | null` — exige `^<clientId>/<uuid>\.(png|jpg|webp)$`
- `logoUrl(path: string | null): string | null` — URL pública `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${path}`

## 6. UI

- **Sidebar:** "Clientes" (`Building2`) entre Proyectos y Pendientes.
- **`/clients`:** encabezado + "Nuevo cliente" (diálogo: nombre, estado, industria, ciudad, sitio web); barra con búsqueda (debounce 300 ms, `?q=`), estado (`?status=`), industria (`?industry=`, opciones = industrias existentes); grid de tarjetas: logo o iniciales sobre `clientColor`, nombre, industria · ciudad, badge de estado, contacto principal, "N proyectos (M activos)"; vacío → "No hay clientes".
- **`/clients/[id]`:** encabezado (logo con clic para subir/cambiar y "Quitar logo", nombre, estado, industria, ciudad, sitio web; "Editar" y "Eliminar"); tarjetas: Resumen financiero (Facturado, Costos, Margen, Ingresos/Gastos de transacciones con `formatCurrency`), Contactos (CRUD, ⭐ principal, links `mailto:`/`tel:`/`wa.me`, roles "Proyecto: rol"), Proyectos (punto de color, estado, `ProjectProgressBar`), Pendientes abiertos (`TaskCard`, abren el panel), Datos fiscales (edición en el lugar), Notas (markdown, Editar/Vista previa, autosave 1 s con flush al desmontar).
- **Proyectos:** formularios con select "Cliente (opcional)" (Sin cliente / clientes / "+ Nuevo cliente" → mini diálogo nombre+estado, selecciona el creado); tarjeta y detalle muestran el cliente con link a `/clients/[id]` o "Sin cliente"; filtro `?client=` en `/projects`; detalle del proyecto: tarjeta "Contactos del cliente" (visible si hay cliente) para ligar contacto + rol, editar rol, quitar.
- **Finanzas:** `ProjectBreakdown` muestra el cliente del proyecto.

## 7. Server actions

`src/app/(dashboard)/clients/actions.ts`: `createClientRecord(formData)` (devuelve `{ id }`), `updateClient(id, formData)`, `updateClientFiscal(id, formData)`, `updateClientNotes(id, notes)`, `deleteClient(id)`, `setClientLogo(id, path | null)`, `addContact(clientId, formData)`, `updateContact(id, clientId, formData)`, `deleteContact(id, clientId)`, `setPrimaryContact(id, clientId)`, `linkProjectContact(projectId, contactId, role)`, `updateProjectContactRole(id, projectId, role)`, `unlinkProjectContact(id, projectId)`.
Cambios: `parseProjectForm` usa `client_id` opcional en vez de `client`; `createProject`/`updateProject` verifican el cliente y, al cambiarlo, borran `project_contacts` del proyecto.
Todas: mensajes de validación en español; errores de DB vía `actionError`; mutaciones filtran por `id` y el id del padre; 0 filas → mensaje "ya no existe"; revalidan `("/", "layout")`.

## 8. Testing

- Unit (TDD): `clients.test.ts` (RFC persona moral/física válidos e inválidos, minúsculas normalizadas; email; teléfono 10–15 dígitos; WhatsApp con/sin lada y basura; iniciales con títulos y un solo nombre; color estable; escape; resumen financiero), `client-logo.test.ts` (svg/gif rechazados, 2 MB exacto y +1, ruta válida, traversal, otro cliente, extensión que no corresponde), `project-form.test.ts` actualizado (client_id opcional).
- Componentes: marcar principal llama `setPrimaryContact`; "+ Nuevo cliente" selecciona el creado; link de WhatsApp correcto.
- Integración contra Supabase local: aplicar 004 (kairos ligado a "Dr.Alejandro Nevarez", columna `client` eliminada); segundo contacto principal rechazado por el índice; ligar contacto de otro cliente rechazado por la acción; logo de 3 MB y SVG rechazados por el bucket; borrar cliente → proyecto sin cliente y logo eliminado.
- `tsc --noEmit`, `lint`, `npm test` limpios; build al final.

## 9. Fuera de alcance

Facturación/CFDI real, importación de contactos (CSV/Google), historial de interacciones con el cliente, portal de clientes.
