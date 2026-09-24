# Color de proyecto + Progreso por Entregables — Design Spec

**Date:** 2026-09-24
**Status:** Approved (pending written-spec review)
**Extends:** `2026-09-24-ajl-group-dashboard-design.md`

---

## 1. Objetivo

1. Cada proyecto tiene un **color personalizable** para reconocerlo rápido en toda la app.
2. El **progreso del proyecto deja de ser manual** (slider 0-100) y se **calcula** a partir de entregables con peso, aprobados explícitamente por un socio. El % es justificable ante el cliente: refleja trabajo aceptado, no suposiciones.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Base del progreso | Entregables con peso + pendientes ligados |
| Completado | Automático → "Listo para revisión" cuando todos sus pendientes están completados; solo cuenta al % cuando un socio lo **aprueba** |
| Pesos | % manual por entregable, deben sumar 100 (validación a nivel app, igual que reparto de socios) |
| Liga pendiente↔entregable | Opcional; pendientes sin entregable no afectan el % |
| Color | Paleta de 12 + selector libre (hex) |
| Dónde se ve el color | Tarjetas de proyecto, pendientes (+ dashboard), calendario, finanzas |
| Cálculo | En la app, función pura (no columna almacenada, no vista SQL) |

## 3. Modelo de datos

Nueva migración `supabase/migrations/002_project_color_deliverables.sql` (la 001 no se edita).

### projects (cambios)
| Column | Type | Notes |
|--------|------|-------|
| color | text NOT NULL DEFAULT '#6366F1' | CHECK `color ~ '^#[0-9A-Fa-f]{6}$'` |
| ~~progress~~ | — | **DROP COLUMN** (el progreso ya no se captura) |

### deliverables (nueva)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| project_id | uuid FK NOT NULL | → projects ON DELETE CASCADE |
| title | text NOT NULL | |
| weight | decimal(5,2) NOT NULL DEFAULT 0 | CHECK 0..100; suma por proyecto = 100 (app-level) |
| approved_at | timestamptz | nullable; no nulo = aprobado |
| approved_by | uuid FK | → users, nullable |
| position | int NOT NULL DEFAULT 0 | orden de despliegue |
| created_at | timestamptz | default now() |

### tasks (cambios)
| Column | Type | Notes |
|--------|------|-------|
| deliverable_id | uuid FK nullable | → deliverables ON DELETE SET NULL |

**Constraint app-level:** si `deliverable_id` no es nulo, el entregable debe pertenecer al mismo `project_id` que el pendiente.

### Migración también:
- Índices: `deliverables(project_id)`, `tasks(deliverable_id)`.
- RLS: `ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;` política full access `TO authenticated USING (public.is_partner()) WITH CHECK (public.is_partner())`.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE deliverables;` y `deliverables` en `REALTIME_TABLES`.
- Proyectos existentes reciben el color default; tipo `Project` pierde `progress`, gana `color`; nuevo tipo `Deliverable`; `Task` gana `deliverable_id`.

## 4. Reglas de negocio

**Estado de un entregable** (derivado, no almacenado):
- `approved` — `approved_at` no nulo.
- `ready` — no aprobado, tiene ≥1 pendiente ligado y todos están `completed`.
- `pending` — cualquier otro caso (incluye sin pendientes).
- **Alerta:** entregable `approved` con pendientes ligados no completados → "⚠️ Aprobado con pendientes abiertos". La aprobación se mantiene (el cliente ya aceptó).

**Progreso del proyecto:**
- `projectProgress(deliverables)` = Σ `weight` de entregables aprobados, acotado a [0, 100], redondeado a entero para mostrar.
- Sin entregables → `null` → UI muestra "Sin entregables" (no un % inventado).
- Si los pesos no suman 100: el % se calcula igual y la UI muestra aviso ámbar "Los pesos suman X%, deben sumar 100%".

**Aprobar:** solo permitido en estado `ready` (verificado en servidor; si no → `"Aún hay pendientes abiertos"`). Guarda `approved_at = now()`, `approved_by = auth user`.
**Revocar:** limpia `approved_at` y `approved_by`.
**Pesos:** crear/editar rechaza si el total resultante del proyecto excede 100 (`exceedsHundred`) → `"La suma de pesos no puede exceder 100%"`; peso finito 0..100 → si no `"Peso inválido"`.
**Borrar entregable:** sus pendientes quedan sin entregable (SET NULL); la confirmación lo dice.

## 5. Lógica pura

`src/lib/deliverables.ts`:
- `deliverableStatus(d: { approved_at: string | null }, tasks: { status: TaskStatus }[]): { status: "pending" | "ready" | "approved"; openTasks: number; totalTasks: number; approvedWithOpenTasks: boolean }`
- `projectProgress(deliverables: { weight: number | string; approved_at: string | null }[]): number | null`
- Reusa `percentageTotal`, `isHundred`, `exceedsHundred`, `round2` de `src/lib/finance.ts`.

`src/lib/colors.ts`:
- `PROJECT_COLORS` — 12 hex con contraste aceptable en tema claro y oscuro.
- `DEFAULT_PROJECT_COLOR = "#6366F1"`.
- `parseHexColor(raw: unknown): string | null` — solo `#RRGGBB` (normaliza a mayúsculas).
- `nextPaletteColor(used: string[]): string` — primer color de la paleta no usado; si todos usados, cicla por cantidad.

## 6. UI

**Detalle de proyecto** — nueva tarjeta "Entregables" (reemplaza el slider del formulario de edición):
- Encabezado: barra de progreso en color del proyecto + "Progreso X%" + estado de suma de pesos.
- Filas: estado (✅ aprobado / 🟡 listo para revisión / ⬜ pendiente), título, peso, "n/m pendientes", aprobado por/fecha, botón **Aprobar** (solo `ready`, con confirmación) o **Revocar** (solo `approved`), ↑↓ para reordenar, borrar.
- Edición inline de título y peso.
- Fila expandible: lista de pendientes ligados + crear pendiente ya ligado (TaskForm con `defaultProjectId` + `defaultDeliverableId`).
- "+ Agregar entregable".

**Formulario de proyecto (crear/editar):** selector de color: 12 swatches (botones accesibles con `aria-label` del color) + "Otro…" con `<input type="color">`. Nuevo proyecto preselecciona `nextPaletteColor`. Se elimina el slider de progreso.

**TaskForm:** tras elegir proyecto, select "Entregable (opcional)" con "Sin entregable" + entregables de ese proyecto.

**Color visible en:**
- Tarjeta `/projects`: franja izquierda 4px en color; barra de progreso en color; "k de n entregables aprobados" o "Sin entregables".
- Encabezado del detalle: punto de color.
- Pendientes (lista y dashboard "Pendientes urgentes"): nombre de proyecto precedido de punto de color.
- Calendario: chip mantiene fondo por prioridad; borde izquierdo 3px en color del proyecto (sin proyecto → sin borde).
- Finanzas: punto de color junto al nombre en desglose y tabla de transacciones.
- Dashboard "Proyectos activos": % calculado y barra en color del proyecto.

## 7. Server actions y errores

Nuevo `src/app/(dashboard)/projects/deliverable-actions.ts`: `createDeliverable`, `updateDeliverable` (título/peso), `moveDeliverable(id, direction)`, `approveDeliverable`, `revokeDeliverable`, `deleteDeliverable`.
Cambios: `createProject`/`updateProject` aceptan `color` (validado con `parseHexColor`; inválido → `"Color inválido"`), ya no `progress`. `createTask` acepta `deliverable_id` opcional con la validación de pertenencia (`"El entregable no pertenece a este proyecto"`).
Errores: patrón existente (`logActionError` + mensaje genérico en español; mensajes de validación específicos). Todas revalidan `("/", "layout")`.

## 8. Testing

- Unit (Vitest, TDD): `deliverables.test.ts` (estados: sin pendientes, parciales, todos completos, aprobado, aprobado con reabiertos; progreso: vacío→null, parcial, 100, tope >100, pesos string), `colors.test.ts` (hex válido/ inválido/ minúsculas/ sin #/ 3 dígitos; nextPaletteColor con 0, algunos y todos usados). Validación de formularios de entregable en `project-form.ts` o nuevo parser probado.
- Component: botón Aprobar habilitado solo en `ready`.
- Integración manual contra Supabase local: aplicar 002, crear proyecto con 3 entregables (20/30/50), ligar pendientes, completar, aprobar → % en tarjeta, detalle y dashboard; revocar; reabrir pendiente de aprobado → alerta.
- `tsc --noEmit`, `lint`, `npm test`, build con env dummy: todos limpios.

## 9. Fuera de alcance

Ligar entregables a pagos/transacciones, historial de aprobaciones, aprobación directa por el cliente (portal externo), drag-and-drop para ordenar.
