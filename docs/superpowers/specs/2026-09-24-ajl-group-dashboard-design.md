# AJL Group Dashboard - Design Spec

**Date:** 2026-09-24
**Status:** Approved
**Authors:** Alan, Jaziel, Leo

---

## 1. Overview

Dashboard administrativo para AJL Group. 3 socios (Alan, Jaziel, Leo) con roles iguales y transparencia total. Gestiona proyectos, tareas, finanzas, notas y calendario.

## 2. Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email + password)
- **Realtime:** Supabase Realtime
- **Deploy:** Vercel

## 3. Architecture

Monolito Next.js con App Router. Server Components + Server Actions para data fetching y mutations. Supabase como backend-as-a-service.

```
/app
  /(auth)/login
  /(dashboard)/
    /projects
    /projects/[id]
    /tasks
    /finance
    /calendar
    /notes
    /settings
    layout.tsx  (sidebar navigation)
/components
  /ui          (shadcn components)
  /dashboard   (dashboard-specific components)
  /projects
  /tasks
  /finance
  /calendar
  /notes
/lib
  supabase.ts       (client + server clients)
  utils.ts
  constants.ts
/types
  index.ts          (all TypeScript types)
```

### Auth
- Supabase Auth con email/password
- Solo 3 cuentas invitadas, no registro publico
- Middleware protege rutas del dashboard
- Sesion persistente con cookies

### Row Level Security
- Todos los socios ven toda la data (transparencia)
- Notas personales: solo el autor lee/edita
- Notas compartidas: todos leen, solo autor edita

### Realtime
- Supabase Realtime para actualizaciones en vivo
- Cambios en proyectos, tareas y finanzas se reflejan instantaneamente

## 4. Data Model

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Supabase auth.users ref |
| name | text | Alan, Jaziel, Leo |
| email | text | unique |
| avatar_url | text | nullable |
| created_at | timestamptz | default now() |

### projects
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | |
| client | text | |
| status | enum | active, paused, completed |
| progress | int | 0-100 |
| start_date | date | |
| end_date | date | nullable |
| budget | decimal | monto cobrado al cliente |
| production_cost | decimal | costo de produccion |
| created_at | timestamptz | default now() |

**Margen de utilidad** = budget - production_cost

### project_links
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| project_id | uuid (FK) | -> projects |
| label | text | "Repo", "Deploy", "Figma" |
| url | text | |

### project_members
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| project_id | uuid (FK) | -> projects |
| user_id | uuid (FK) | -> users |
| role_description | text | nullable, que le toca |
| profit_percentage | decimal | default 33.33 |

**Constraint:** profit_percentage de todos los miembros de un proyecto debe sumar 100.

### tasks
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| title | text | |
| description | text | nullable |
| priority | enum | urgent, high, medium, low |
| status | enum | pending, in_progress, completed |
| due_date | date | nullable, alimenta calendario |
| project_id | uuid (FK) | nullable, null = pendiente general |
| assigned_to | uuid (FK) | -> users |
| created_by | uuid (FK) | -> users |
| created_at | timestamptz | default now() |

### notes
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| title | text | |
| content | text | markdown |
| is_shared | boolean | false = personal, true = compartida |
| author_id | uuid (FK) | -> users |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### transactions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| project_id | uuid (FK) | -> projects |
| type | enum | income, expense |
| amount | decimal | |
| description | text | |
| date | date | |
| created_by | uuid (FK) | -> users |
| created_at | timestamptz | default now() |

## 5. Pages & Features

### 5.1 Dashboard (Home) `/`
- Cards por socio: en que proyecto trabaja, pendientes asignados
- Proyectos activos con barra de progreso
- Pendientes urgentes / proximos a vencer
- Resumen financiero rapido: ingresos totales, costos, margen global

### 5.2 Proyectos `/projects`
- Lista con filtros: status, socio asignado
- Card view con status badge + barra progreso
- Click -> vista detalle `/projects/[id]`:
  - Info general editable (nombre, cliente, status, progreso slider 0-100%)
  - Links del proyecto (CRUD)
  - Miembros asignados + que le toca + porcentaje de reparto
  - Pendientes ligados al proyecto
  - Finanzas: budget, costo produccion, margen, reparto por socio

### 5.3 Pendientes `/tasks`
- Lista con filtros: prioridad, status, asignado a, proyecto
- Crear: titulo, descripcion, prioridad, fecha limite, asignar socio, proyecto (opcional)
- Badge color por prioridad: rojo(urgent), naranja(high), amarillo(medium), verde(low)
- Cambiar status: pending -> in_progress -> completed
- Due dates alimentan calendario automaticamente

### 5.4 Finanzas `/finance`
- **Vista global:**
  - Total ingresos, total costos, margen total
  - Resumen por socio: cuanto le toca de todos los proyectos
- **Por proyecto:**
  - Budget vs costo produccion = margen
  - Reparto segun porcentaje de cada miembro
- **Transacciones:**
  - Tabla con filtros (tipo, proyecto, fecha)
  - Agregar ingresos/gastos por proyecto

### 5.5 Calendario `/calendar`
- Vista mensual
- Auto-poblado con due_date de tasks
- Color-coded por prioridad
- Click en dia: ver pendientes de ese dia, crear nuevo

### 5.6 Notas `/notes`
- Tabs: "Mis Notas" / "Compartidas"
- Editor markdown basico
- CRUD completo
- Personales: solo autor ve
- Compartidas: todos ven, solo autor edita

### 5.7 Settings `/settings`
- Editar perfil (nombre, avatar)
- Toggle dark/light mode
- Preferencias futuras

## 6. UI/UX

- **Theme:** Dark/light mode con toggle, paleta neutral profesional
- **Components:** shadcn/ui (buttons, cards, tables, dialogs, etc.)
- **Layout:** Sidebar fijo izquierda + contenido principal
- **Responsive:** Desktop-first, funcional en tablet
- **Colors prioridad:** Urgent=#EF4444, High=#F97316, Medium=#EAB308, Low=#22C55E

## 7. Auth Flow

1. Usuario va a cualquier ruta
2. Middleware checa sesion Supabase
3. Sin sesion -> redirect a /login
4. Login con email + password
5. Sesion valida -> dashboard
6. No hay registro publico, cuentas se crean via Supabase dashboard o seed script

## 8. Deploy

- Vercel connected al repo GitHub (Asaply/AJL-Group)
- Variables de entorno: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- Auto-deploy on push to main
