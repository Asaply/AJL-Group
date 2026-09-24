# AJL Group Dashboard - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin dashboard for 3 partners (Alan, Jaziel, Leo) to manage projects, tasks, finances, notes, and calendar.

**Architecture:** Next.js 14 App Router monolith with Supabase (auth, PostgreSQL, realtime). Server Components + Server Actions. Deploy on Vercel.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Vitest

**Spec:** `docs/superpowers/specs/2026-09-24-ajl-group-dashboard-design.md`

## Global Constraints

- Node >= 18, Next.js 14, TypeScript strict mode
- All DB access via Supabase client (no raw pg connections)
- No public registration — only 3 invited accounts
- All monetary values use `decimal` / `number` with 2 decimal precision
- Priority colors: urgent=#EF4444, high=#F97316, medium=#EAB308, low=#22C55E
- Spanish UI labels throughout

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout, theme provider, fonts
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # Login form
│   └── (dashboard)/
│       ├── layout.tsx                # Sidebar + main content wrapper
│       ├── page.tsx                  # Dashboard home
│       ├── projects/
│       │   ├── page.tsx              # Project list
│       │   ├── [id]/page.tsx         # Project detail
│       │   └── actions.ts            # Server actions for projects
│       ├── tasks/
│       │   ├── page.tsx              # Task list
│       │   └── actions.ts            # Server actions for tasks
│       ├── finance/
│       │   ├── page.tsx              # Finance overview
│       │   └── actions.ts            # Server actions for transactions
│       ├── calendar/
│       │   └── page.tsx              # Calendar view
│       ├── notes/
│       │   ├── page.tsx              # Notes list + editor
│       │   └── actions.ts            # Server actions for notes
│       └── settings/
│           ├── page.tsx              # Settings page
│           └── actions.ts            # Server actions for profile
├── components/
│   ├── ui/                           # shadcn/ui components (auto-generated)
│   ├── sidebar.tsx                   # Dashboard sidebar navigation
│   ├── theme-provider.tsx            # next-themes provider
│   ├── theme-toggle.tsx              # Dark/light toggle button
│   ├── projects/
│   │   ├── project-card.tsx          # Project card for list view
│   │   ├── project-form.tsx          # Create/edit project dialog
│   │   ├── project-links.tsx         # Links CRUD for project detail
│   │   ├── project-members.tsx       # Members + percentage management
│   │   └── project-finance.tsx       # Finance section in project detail
│   ├── tasks/
│   │   ├── task-card.tsx             # Task item with priority badge
│   │   ├── task-form.tsx             # Create/edit task dialog
│   │   └── task-filters.tsx          # Filter bar for tasks
│   ├── finance/
│   │   ├── finance-overview.tsx      # Global totals + per-partner summary
│   │   ├── transaction-table.tsx     # Transaction list with filters
│   │   └── transaction-form.tsx      # Add income/expense dialog
│   ├── calendar/
│   │   └── calendar-grid.tsx         # Monthly calendar grid
│   ├── notes/
│   │   ├── note-list.tsx             # Note list sidebar
│   │   └── note-editor.tsx           # Markdown note editor
│   └── dashboard/
│       ├── partner-cards.tsx         # What each partner is working on
│       ├── active-projects.tsx       # Active projects with progress bars
│       ├── urgent-tasks.tsx          # Upcoming/urgent tasks
│       └── quick-finance.tsx         # Finance summary widget
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   ├── server.ts                 # Server-side Supabase client
│   │   └── admin.ts                  # Service role client (seed only)
│   ├── utils.ts                      # cn() helper, formatCurrency, etc.
│   └── constants.ts                  # Priority colors, status labels
├── types/
│   └── index.ts                      # All TypeScript types/interfaces
├── middleware.ts                      # Auth middleware (protect dashboard)
supabase/
└── migrations/
    └── 001_initial_schema.sql        # Full DB schema
scripts/
└── seed.ts                           # Seed 3 partner accounts
```

---

### Task 1: Project Scaffolding + Supabase Config

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `.env.local.example`, `src/app/layout.tsx`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/utils.ts`, `src/types/index.ts`

**Interfaces:**
- Produces: Supabase clients (`createClient()`, `createServerClient()`), all TypeScript types, `cn()` utility

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/leonardo/AJL-Group
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbo
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr next-themes lucide-react date-fns
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn-ui@latest init
```
Select: TypeScript, Default style, Neutral base color, CSS variables, `src/components/ui`, `@/components`, `@/lib/utils`

- [ ] **Step 4: Add shadcn components**

```bash
npx shadcn-ui@latest add button card input label dialog select badge progress table tabs textarea dropdown-menu avatar separator sheet toast
```

- [ ] **Step 5: Create environment file**

Create `.env.local.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Copy to `.env.local` and fill with real Supabase credentials.

- [ ] **Step 6: Create TypeScript types**

Create `src/types/index.ts`:
```typescript
export type ProjectStatus = "active" | "paused" | "completed";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "in_progress" | "completed";
export type TransactionType = "income" | "expense";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  start_date: string;
  end_date: string | null;
  budget: number;
  production_cost: number;
  created_at: string;
}

export interface ProjectLink {
  id: string;
  project_id: string;
  label: string;
  url: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_description: string | null;
  profit_percentage: number;
  user?: User;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  project_id: string | null;
  assigned_to: string;
  created_by: string;
  created_at: string;
  project?: Project;
  assignee?: User;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  is_shared: boolean;
  author_id: string;
  created_at: string;
  updated_at: string;
  author?: User;
}

export interface Transaction {
  id: string;
  project_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  created_by: string;
  created_at: string;
  project?: Project;
}
```

- [ ] **Step 7: Create Supabase clients**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 8: Create constants**

Create `src/lib/constants.ts`:
```typescript
export const PRIORITY_COLORS = {
  urgent: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#22C55E",
} as const;

export const PRIORITY_LABELS = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
} as const;

export const STATUS_LABELS = {
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
} as const;

export const TASK_STATUS_LABELS = {
  pending: "Pendiente",
  in_progress: "En Progreso",
  completed: "Completado",
} as const;

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { label: "Proyectos", href: "/projects", icon: "FolderKanban" },
  { label: "Pendientes", href: "/tasks", icon: "ListTodo" },
  { label: "Finanzas", href: "/finance", icon: "DollarSign" },
  { label: "Calendario", href: "/calendar", icon: "Calendar" },
  { label: "Notas", href: "/notes", icon: "StickyNote" },
  { label: "Ajustes", href: "/settings", icon: "Settings" },
] as const;
```

- [ ] **Step 9: Verify app runs**

```bash
npm run dev
```
Open http://localhost:3000 — should show default Next.js page.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Supabase, shadcn/ui, types, and constants"
```

---

### Task 2: Database Schema + Seed Script

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`, `scripts/seed.ts`

**Interfaces:**
- Consumes: Supabase service role key from `.env.local`
- Produces: All database tables, enums, RLS policies, 3 user accounts

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
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
  profit_percentage DECIMAL(5,2) DEFAULT 33.33,
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
CREATE POLICY "Users: update own" ON users FOR UPDATE TO authenticated USING (id = auth.uid());

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
  USING (author_id = auth.uid());
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
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase Dashboard > SQL Editor > paste and run `001_initial_schema.sql`.

- [ ] **Step 3: Create seed script**

Install tsx: `npm install -D tsx`

Create `scripts/seed.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const partners = [
  { name: "Alan", email: "alan@ajlgroup.com", password: "AJL2026!alan" },
  { name: "Jaziel", email: "jaziel@ajlgroup.com", password: "AJL2026!jaziel" },
  { name: "Leo", email: "leo@ajlgroup.com", password: "AJL2026!leo" },
];

async function seed() {
  for (const partner of partners) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: partner.email,
      password: partner.password,
      email_confirm: true,
    });

    if (authError) {
      console.error(`Error creating ${partner.name}:`, authError.message);
      continue;
    }

    const { error: profileError } = await supabase.from("users").insert({
      id: authData.user.id,
      name: partner.name,
      email: partner.email,
    });

    if (profileError) {
      console.error(`Error creating profile for ${partner.name}:`, profileError.message);
      continue;
    }

    console.log(`Created ${partner.name} (${partner.email})`);
  }
  console.log("\nSeed complete. Change passwords after first login!");
}

seed();
```

- [ ] **Step 4: Run seed**

```bash
npx tsx scripts/seed.ts
```
Verify 3 users created in Supabase Dashboard > Authentication > Users.

- [ ] **Step 5: Commit**

```bash
git add supabase/ scripts/
git commit -m "feat: add database schema with RLS policies and seed script for 3 partners"
```

---

### Task 3: Auth (Login + Middleware)

**Files:**
- Create: `src/middleware.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/actions.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`, `createClient()` from `@/lib/supabase/client`
- Produces: Auth middleware protecting `/(dashboard)` routes, login page, `login()` and `logout()` server actions

- [ ] **Step 1: Create auth middleware**

Create `src/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 2: Create login server actions**

Create `src/app/(auth)/login/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
```

- [ ] **Step 3: Create login page**

Create `src/app/(auth)/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">AJL Group</CardTitle>
          <p className="text-muted-foreground text-sm">Panel Administrativo</p>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Test login flow**

```bash
npm run dev
```
1. Go to http://localhost:3000 — should redirect to /login
2. Login with one of the seed accounts
3. Should redirect to / (dashboard)

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/app/\(auth\)/
git commit -m "feat: add auth with login page, middleware, and server actions"
```

---

### Task 4: Dashboard Layout (Sidebar + Theme)

**Files:**
- Create: `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/components/sidebar.tsx`, `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `NAV_ITEMS` from `@/lib/constants`, `logout()` from login actions, `createClient()` from `@/lib/supabase/server`
- Produces: `<ThemeProvider>`, `<ThemeToggle>`, `<Sidebar>`, dashboard layout with sidebar

- [ ] **Step 1: Create theme provider**

Create `src/components/theme-provider.tsx`:
```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 2: Create theme toggle**

Create `src/components/theme-toggle.tsx`:
```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
```

- [ ] **Step 3: Create sidebar**

Create `src/components/sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, ListTodo, DollarSign,
  Calendar, StickyNote, Settings, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import type { User } from "@/types";

const icons = {
  LayoutDashboard, FolderKanban, ListTodo, DollarSign,
  Calendar, StickyNote, Settings,
};

const navItems = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { label: "Proyectos", href: "/projects", icon: "FolderKanban" },
  { label: "Pendientes", href: "/tasks", icon: "ListTodo" },
  { label: "Finanzas", href: "/finance", icon: "DollarSign" },
  { label: "Calendario", href: "/calendar", icon: "Calendar" },
  { label: "Notas", href: "/notes", icon: "StickyNote" },
  { label: "Ajustes", href: "/settings", icon: "Settings" },
] as const;

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-screen w-64 border-r bg-card">
      <div className="p-6">
        <h1 className="text-xl font-bold">AJL Group</h1>
        <p className="text-sm text-muted-foreground">{user.name}</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = icons[item.icon as keyof typeof icons];
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t flex items-center justify-between">
        <ThemeToggle />
        <form action={logout}>
          <Button variant="ghost" size="icon" type="submit">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Update root layout**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AJL Group",
  description: "Panel Administrativo AJL Group",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create dashboard layout**

Create `src/app/(dashboard)/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div className="flex h-screen">
      <Sidebar user={profile} />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Create placeholder dashboard page**

Create `src/app/(dashboard)/page.tsx`:
```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground mt-2">Bienvenido a AJL Group</p>
    </div>
  );
}
```

- [ ] **Step 7: Test layout**

```bash
npm run dev
```
1. Login -> should see sidebar with navigation + dashboard content
2. Click nav items -> URLs change
3. Toggle theme -> dark/light switches
4. Logout button -> returns to login

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: add dashboard layout with sidebar navigation, theme toggle, and auth guard"
```

---

### Task 5: Projects (List + Detail + CRUD)

**Files:**
- Create: `src/app/(dashboard)/projects/page.tsx`, `src/app/(dashboard)/projects/[id]/page.tsx`, `src/app/(dashboard)/projects/actions.ts`, `src/components/projects/project-card.tsx`, `src/components/projects/project-form.tsx`, `src/components/projects/project-links.tsx`, `src/components/projects/project-members.tsx`, `src/components/projects/project-finance.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`, all project-related types from `@/types`
- Produces: Server actions: `createProject()`, `updateProject()`, `deleteProject()`, `addProjectLink()`, `deleteProjectLink()`, `addProjectMember()`, `updateMemberPercentage()`, `removeProjectMember()`

- [ ] **Step 1: Create project server actions**

Create `src/app/(dashboard)/projects/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    name: formData.get("name") as string,
    client: formData.get("client") as string,
    status: formData.get("status") as string || "active",
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) || null,
    budget: parseFloat(formData.get("budget") as string) || 0,
    production_cost: parseFloat(formData.get("production_cost") as string) || 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

export async function updateProject(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({
    name: formData.get("name") as string,
    client: formData.get("client") as string,
    status: formData.get("status") as string,
    progress: parseInt(formData.get("progress") as string) || 0,
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) || null,
    budget: parseFloat(formData.get("budget") as string) || 0,
    production_cost: parseFloat(formData.get("production_cost") as string) || 0,
  }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

export async function addProjectLink(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_links").insert({
    project_id: projectId,
    label: formData.get("label") as string,
    url: formData.get("url") as string,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectLink(linkId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_links").delete().eq("id", linkId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}

export async function addProjectMember(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: formData.get("user_id") as string,
    role_description: (formData.get("role_description") as string) || null,
    profit_percentage: parseFloat(formData.get("profit_percentage") as string) || 33.33,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}

export async function updateMemberPercentage(memberId: string, projectId: string, percentage: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_members")
    .update({ profit_percentage: percentage })
    .eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectMember(memberId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}
```

- [ ] **Step 2: Create project card component**

Create `src/components/projects/project-card.tsx`:
```tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { STATUS_LABELS } from "@/lib/constants";
import type { Project } from "@/types";

const statusVariant = {
  active: "default",
  paused: "secondary",
  completed: "outline",
} as const;

export function ProjectCard({ project }: { project: Project }) {
  const margin = project.budget - project.production_cost;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <Badge variant={statusVariant[project.status]}>
              {STATUS_LABELS[project.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{project.client}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progreso</span>
              <span>{project.progress}%</span>
            </div>
            <Progress value={project.progress} />
            <div className="flex justify-between text-sm pt-2">
              <span className="text-muted-foreground">Margen: ${margin.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Create project form dialog**

Create `src/components/projects/project-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createProject } from "@/app/(dashboard)/projects/actions";
import { Plus } from "lucide-react";

export function ProjectForm() {
  const [open, setOpen] = useState(false);

  async function handleSubmit(formData: FormData) {
    const result = await createProject(formData);
    if (!result?.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Nuevo Proyecto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Proyecto</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client">Cliente</Label>
            <Input id="client" name="client" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue="active">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Fecha Inicio</Label>
              <Input id="start_date" name="start_date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha Fin</Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Presupuesto ($)</Label>
              <Input id="budget" name="budget" type="number" step="0.01" defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="production_cost">Costo Produccion ($)</Label>
              <Input id="production_cost" name="production_cost" type="number" step="0.01" defaultValue="0" />
            </div>
          </div>
          <Button type="submit" className="w-full">Crear</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create project list page**

Create `src/app/(dashboard)/projects/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectForm } from "@/components/projects/project-form";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Proyectos</h1>
        <ProjectForm />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        {(!projects || projects.length === 0) && (
          <p className="text-muted-foreground col-span-full text-center py-12">
            No hay proyectos. Crea el primero.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create project detail components**

Create `src/components/projects/project-links.tsx`:
```tsx
"use client";

import { useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addProjectLink, deleteProjectLink } from "@/app/(dashboard)/projects/actions";
import type { ProjectLink } from "@/types";

export function ProjectLinks({ links, projectId }: { links: ProjectLink[]; projectId: string }) {
  const [adding, setAdding] = useState(false);

  async function handleAdd(formData: FormData) {
    await addProjectLink(projectId, formData);
    setAdding(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Links</h3>
        <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {adding && (
        <form action={handleAdd} className="flex gap-2">
          <Input name="label" placeholder="Etiqueta" required className="w-32" />
          <Input name="url" placeholder="https://..." required className="flex-1" />
          <Button type="submit" size="sm">Agregar</Button>
        </form>
      )}
      {links.map((link) => (
        <div key={link.id} className="flex items-center justify-between text-sm">
          <a href={link.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" />{link.label}
          </a>
          <form action={() => deleteProjectLink(link.id, projectId)}>
            <Button variant="ghost" size="icon" type="submit" className="h-6 w-6">
              <Trash2 className="h-3 w-3" />
            </Button>
          </form>
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/projects/project-members.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addProjectMember, updateMemberPercentage, removeProjectMember } from "@/app/(dashboard)/projects/actions";
import type { ProjectMember, User } from "@/types";

export function ProjectMembers({
  members, projectId, allUsers,
}: {
  members: (ProjectMember & { user: User })[];
  projectId: string;
  allUsers: User[];
}) {
  const [adding, setAdding] = useState(false);
  const availableUsers = allUsers.filter((u) => !members.some((m) => m.user_id === u.id));

  async function handleAdd(formData: FormData) {
    await addProjectMember(projectId, formData);
    setAdding(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Miembros</h3>
        {availableUsers.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      {adding && (
        <form action={handleAdd} className="space-y-2">
          <Select name="user_id" required>
            <SelectTrigger><SelectValue placeholder="Socio" /></SelectTrigger>
            <SelectContent>
              {availableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input name="role_description" placeholder="Rol en proyecto" />
          <Input name="profit_percentage" type="number" step="0.01" defaultValue="33.33" placeholder="%" />
          <Button type="submit" size="sm">Agregar</Button>
        </form>
      )}
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between text-sm border rounded-lg p-3">
          <div>
            <p className="font-medium">{member.user.name}</p>
            <p className="text-muted-foreground">{member.role_description || "Sin rol asignado"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              defaultValue={member.profit_percentage}
              className="w-20 text-right"
              onBlur={(e) => updateMemberPercentage(member.id, projectId, parseFloat(e.target.value))}
            />
            <span className="text-muted-foreground">%</span>
            <form action={() => removeProjectMember(member.id, projectId)}>
              <Button variant="ghost" size="icon" type="submit" className="h-6 w-6">
                <Trash2 className="h-3 w-3" />
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/projects/project-finance.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project, ProjectMember, User } from "@/types";

export function ProjectFinance({
  project, members,
}: {
  project: Project;
  members: (ProjectMember & { user: User })[];
}) {
  const margin = project.budget - project.production_cost;
  const marginPercent = project.budget > 0 ? ((margin / project.budget) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Finanzas</h3>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Presupuesto</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${project.budget.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Costo</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${project.production_cost.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Margen ({marginPercent}%)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-500">${margin.toLocaleString()}</p></CardContent>
        </Card>
      </div>
      <h4 className="font-medium text-sm mt-4">Reparto</h4>
      {members.map((m) => (
        <div key={m.id} className="flex justify-between text-sm border rounded-lg p-2">
          <span>{m.user.name} ({m.profit_percentage}%)</span>
          <span className="font-medium">${((margin * m.profit_percentage) / 100).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create project detail page**

Create `src/app/(dashboard)/projects/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ProjectLinks } from "@/components/projects/project-links";
import { ProjectMembers } from "@/components/projects/project-members";
import { ProjectFinance } from "@/components/projects/project-finance";
import { STATUS_LABELS } from "@/lib/constants";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", params.id).single();

  if (!project) notFound();

  const [
    { data: links },
    { data: members },
    { data: allUsers },
    { data: tasks },
  ] = await Promise.all([
    supabase.from("project_links").select("*").eq("project_id", params.id),
    supabase.from("project_members").select("*, user:users(*)").eq("project_id", params.id),
    supabase.from("users").select("*"),
    supabase.from("tasks").select("*").eq("project_id", params.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <Badge>{STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}</Badge>
      </div>
      <p className="text-muted-foreground">Cliente: {project.client}</p>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progreso</span><span>{project.progress}%</span>
        </div>
        <Progress value={project.progress} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <ProjectLinks links={links || []} projectId={params.id} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <ProjectMembers members={members || []} projectId={params.id} allUsers={allUsers || []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ProjectFinance project={project} members={members || []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pendientes del Proyecto</CardTitle></CardHeader>
        <CardContent>
          {tasks && tasks.length > 0 ? (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between text-sm border rounded p-2">
                  <span>{task.title}</span>
                  <Badge variant="outline">{task.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pendientes</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Test projects CRUD**

1. Go to /projects -> create new project
2. Click project card -> detail page
3. Add links, members, adjust percentages
4. Verify finance calculations

- [ ] **Step 8: Commit**

```bash
git add src/app/\(dashboard\)/projects/ src/components/projects/
git commit -m "feat: add projects module with list, detail, links, members, and finance"
```

---

### Task 6: Tasks / Pendientes

**Files:**
- Create: `src/app/(dashboard)/tasks/page.tsx`, `src/app/(dashboard)/tasks/actions.ts`, `src/components/tasks/task-card.tsx`, `src/components/tasks/task-form.tsx`, `src/components/tasks/task-filters.tsx`

**Interfaces:**
- Consumes: `createClient()`, task types, `PRIORITY_COLORS`, `PRIORITY_LABELS`
- Produces: Server actions: `createTask()`, `updateTaskStatus()`, `deleteTask()`

- [ ] **Step 1: Create task server actions**

Create `src/app/(dashboard)/tasks/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTask(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("tasks").insert({
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    priority: formData.get("priority") as string || "medium",
    due_date: (formData.get("due_date") as string) || null,
    project_id: (formData.get("project_id") as string) || null,
    assigned_to: formData.get("assigned_to") as string,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

export async function updateTaskStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}
```

- [ ] **Step 2: Create task card component**

Create `src/components/tasks/task-card.tsx`:
```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { PRIORITY_COLORS, PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { updateTaskStatus, deleteTask } from "@/app/(dashboard)/tasks/actions";
import type { Task } from "@/types";

export function TaskCard({ task }: { task: Task }) {
  return (
    <div className="flex items-center justify-between border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        />
        <div>
          <p className="font-medium">{task.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {task.assignee && <span>{task.assignee.name}</span>}
            {task.project && <span>· {task.project.name}</span>}
            {task.due_date && <span>· {new Date(task.due_date).toLocaleDateString("es-MX")}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          style={{ borderColor: PRIORITY_COLORS[task.priority], color: PRIORITY_COLORS[task.priority] }}
        >
          {PRIORITY_LABELS[task.priority]}
        </Badge>
        <Select defaultValue={task.status} onValueChange={(v) => updateTaskStatus(task.id, v)}>
          <SelectTrigger className="w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in_progress">En Progreso</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
          </SelectContent>
        </Select>
        <form action={() => deleteTask(task.id)}>
          <Button variant="ghost" size="icon" type="submit"><Trash2 className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create task form dialog**

Create `src/components/tasks/task-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createTask } from "@/app/(dashboard)/tasks/actions";
import type { User, Project } from "@/types";

export function TaskForm({ users, projects }: { users: User[]; projects: Project[] }) {
  const [open, setOpen] = useState(false);

  async function handleSubmit(formData: FormData) {
    const result = await createTask(formData);
    if (!result?.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Nuevo Pendiente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear Pendiente</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Titulo</Label>
            <Input name="title" required />
          </div>
          <div className="space-y-2">
            <Label>Descripcion</Label>
            <Textarea name="description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha Limite</Label>
              <Input name="due_date" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Asignar a</Label>
              <Select name="assigned_to" required>
                <SelectTrigger><SelectValue placeholder="Socio" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Proyecto (opcional)</Label>
              <Select name="project_id">
                <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full">Crear</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create task filters**

Create `src/components/tasks/task-filters.tsx`:
```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@/types";

export function TaskFilters({ users }: { users: User[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function updateFilter(key: string, value: string) {
    const newParams = new URLSearchParams(params.toString());
    if (value === "all") newParams.delete(key);
    else newParams.set(key, value);
    router.push(`/tasks?${newParams.toString()}`);
  }

  return (
    <div className="flex gap-3">
      <Select defaultValue={params.get("priority") || "all"} onValueChange={(v) => updateFilter("priority", v)}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Prioridad" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="urgent">Urgente</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="medium">Media</SelectItem>
          <SelectItem value="low">Baja</SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue={params.get("status") || "all"} onValueChange={(v) => updateFilter("status", v)}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="in_progress">En Progreso</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue={params.get("assigned") || "all"} onValueChange={(v) => updateFilter("assigned", v)}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Asignado a" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 5: Create tasks page**

Create `src/app/(dashboard)/tasks/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskFilters } from "@/components/tasks/task-filters";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { priority?: string; status?: string; assigned?: string };
}) {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("*, assignee:users!assigned_to(*), project:projects(*)")
    .order("created_at", { ascending: false });

  if (searchParams.priority) query = query.eq("priority", searchParams.priority);
  if (searchParams.status) query = query.eq("status", searchParams.status);
  if (searchParams.assigned) query = query.eq("assigned_to", searchParams.assigned);

  const [{ data: tasks }, { data: users }, { data: projects }] = await Promise.all([
    query,
    supabase.from("users").select("*"),
    supabase.from("projects").select("*").eq("status", "active"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pendientes</h1>
        <TaskForm users={users || []} projects={projects || []} />
      </div>
      <TaskFilters users={users || []} />
      <div className="space-y-3">
        {tasks?.map((task) => <TaskCard key={task.id} task={task} />)}
        {(!tasks || tasks.length === 0) && (
          <p className="text-muted-foreground text-center py-12">Sin pendientes</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Test tasks**

1. Go to /tasks -> create task with different priorities
2. Assign to different partners, link to project
3. Filter by priority, status, assigned
4. Change status via dropdown
5. Delete task

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/tasks/ src/components/tasks/
git commit -m "feat: add tasks module with create, filter, status change, and delete"
```

---

### Task 7: Finance Panel

**Files:**
- Create: `src/app/(dashboard)/finance/page.tsx`, `src/app/(dashboard)/finance/actions.ts`, `src/components/finance/finance-overview.tsx`, `src/components/finance/transaction-table.tsx`, `src/components/finance/transaction-form.tsx`

**Interfaces:**
- Consumes: `createClient()`, project/transaction/user types
- Produces: Server actions: `createTransaction()`, `deleteTransaction()`. Components: `<FinanceOverview>`, `<TransactionTable>`, `<TransactionForm>`

- [ ] **Step 1: Create finance server actions**

Create `src/app/(dashboard)/finance/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("transactions").insert({
    project_id: formData.get("project_id") as string,
    type: formData.get("type") as string,
    amount: parseFloat(formData.get("amount") as string),
    description: formData.get("description") as string,
    date: formData.get("date") as string,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/finance");
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
}
```

- [ ] **Step 2: Create finance overview component**

Create `src/components/finance/finance-overview.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project, ProjectMember, User } from "@/types";

interface FinanceData {
  projects: Project[];
  members: (ProjectMember & { user: User })[];
  users: User[];
}

export function FinanceOverview({ projects, members, users }: FinanceData) {
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget), 0);
  const totalCost = projects.reduce((sum, p) => sum + Number(p.production_cost), 0);
  const totalMargin = totalBudget - totalCost;

  const partnerTotals = users.map((user) => {
    const userMembers = members.filter((m) => m.user_id === user.id);
    const total = userMembers.reduce((sum, m) => {
      const project = projects.find((p) => p.id === m.project_id);
      if (!project) return sum;
      const margin = Number(project.budget) - Number(project.production_cost);
      return sum + (margin * Number(m.profit_percentage)) / 100;
    }, 0);
    return { user, total };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ingresos Totales</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${totalBudget.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Costos Totales</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${totalCost.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Margen Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-500">${totalMargin.toLocaleString()}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Reparto por Socio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {partnerTotals.map(({ user, total }) => (
            <div key={user.id} className="flex justify-between items-center border rounded-lg p-4">
              <span className="font-medium">{user.name}</span>
              <span className="text-xl font-bold">${total.toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create transaction form and table**

Create `src/components/finance/transaction-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createTransaction } from "@/app/(dashboard)/finance/actions";
import type { Project } from "@/types";

export function TransactionForm({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);

  async function handleSubmit(formData: FormData) {
    const result = await createTransaction(formData);
    if (!result?.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Nueva Transaccion</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar Transaccion</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Proyecto</Label>
            <Select name="project_id" required>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select name="type" defaultValue="income">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Gasto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto ($)</Label>
              <Input name="amount" type="number" step="0.01" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descripcion</Label>
            <Input name="description" required />
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input name="date" type="date" required />
          </div>
          <Button type="submit" className="w-full">Registrar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Create `src/components/finance/transaction-table.tsx`:
```tsx
"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteTransaction } from "@/app/(dashboard)/finance/actions";
import type { Transaction } from "@/types";

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Proyecto</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Descripcion</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t) => (
          <TableRow key={t.id}>
            <TableCell>{new Date(t.date).toLocaleDateString("es-MX")}</TableCell>
            <TableCell>{t.project?.name}</TableCell>
            <TableCell>
              <Badge variant={t.type === "income" ? "default" : "destructive"}>
                {t.type === "income" ? "Ingreso" : "Gasto"}
              </Badge>
            </TableCell>
            <TableCell>{t.description}</TableCell>
            <TableCell className="text-right font-medium">${Number(t.amount).toLocaleString()}</TableCell>
            <TableCell>
              <form action={() => deleteTransaction(t.id)}>
                <Button variant="ghost" size="icon" type="submit"><Trash2 className="h-4 w-4" /></Button>
              </form>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Create finance page**

Create `src/app/(dashboard)/finance/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceOverview } from "@/components/finance/finance-overview";
import { TransactionTable } from "@/components/finance/transaction-table";
import { TransactionForm } from "@/components/finance/transaction-form";

export default async function FinancePage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: members }, { data: users }, { data: transactions }] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("project_members").select("*, user:users(*)"),
    supabase.from("users").select("*"),
    supabase.from("transactions").select("*, project:projects(*)").order("date", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Finanzas</h1>
        <TransactionForm projects={projects || []} />
      </div>

      <FinanceOverview projects={projects || []} members={members || []} users={users || []} />

      <Card>
        <CardHeader><CardTitle>Transacciones</CardTitle></CardHeader>
        <CardContent>
          <TransactionTable transactions={transactions || []} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Test finance panel**

1. Create project with budget and cost
2. Add members with percentages
3. Go to /finance -> verify totals, margin, partner split
4. Add transactions (income/expense)
5. Delete transaction

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/finance/ src/components/finance/
git commit -m "feat: add finance module with overview, partner split, and transaction tracking"
```

---

### Task 8: Calendar

**Files:**
- Create: `src/app/(dashboard)/calendar/page.tsx`, `src/components/calendar/calendar-grid.tsx`

**Interfaces:**
- Consumes: `createClient()`, task types, `PRIORITY_COLORS`
- Produces: `<CalendarGrid>` component showing tasks by due_date

- [ ] **Step 1: Create calendar grid component**

Create `src/components/calendar/calendar-grid.tsx`:
```tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIORITY_COLORS } from "@/lib/constants";
import type { Task } from "@/types";

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAYS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export function CalendarGrid({ tasks }: { tasks: Task[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  function getTasksForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return tasks.filter((t) => t.due_date === dateStr);
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft /></Button>
        <h2 className="text-xl font-bold">{MONTHS[month]} {year}</h2>
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight /></Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {DAYS.map((d) => (
          <div key={d} className="bg-muted p-2 text-center text-xs font-medium">{d}</div>
        ))}
        {cells.map((day, i) => {
          const dayTasks = day ? getTasksForDay(day) : [];
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

          return (
            <div
              key={i}
              className={`bg-card min-h-[80px] p-1 ${!day ? "bg-muted/50" : ""} ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
            >
              {day && (
                <>
                  <span className="text-xs font-medium">{day}</span>
                  <div className="space-y-0.5 mt-1">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className="text-[10px] truncate rounded px-1 py-0.5 text-white"
                        style={{ backgroundColor: PRIORITY_COLORS[t.priority] }}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} mas</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create calendar page**

Create `src/app/(dashboard)/calendar/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { CalendarGrid } from "@/components/calendar/calendar-grid";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, assignee:users!assigned_to(*), project:projects(*)")
    .not("due_date", "is", null);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Calendario</h1>
      <CalendarGrid tasks={tasks || []} />
    </div>
  );
}
```

- [ ] **Step 3: Test calendar**

1. Create tasks with due dates
2. Go to /calendar -> tasks appear on correct days
3. Navigate months with arrows
4. Priority colors show correctly

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/calendar/ src/components/calendar/
git commit -m "feat: add calendar view auto-populated from task due dates"
```

---

### Task 9: Notes

**Files:**
- Create: `src/app/(dashboard)/notes/page.tsx`, `src/app/(dashboard)/notes/actions.ts`, `src/components/notes/note-list.tsx`, `src/components/notes/note-editor.tsx`

**Interfaces:**
- Consumes: `createClient()`, note types
- Produces: Server actions: `createNote()`, `updateNote()`, `deleteNote()`

- [ ] **Step 1: Create notes server actions**

Create `src/app/(dashboard)/notes/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createNote(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data, error } = await supabase.from("notes").insert({
    title: formData.get("title") as string,
    content: "",
    is_shared: formData.get("is_shared") === "true",
    author_id: user.id,
  }).select().single();
  if (error) return { error: error.message };
  revalidatePath("/notes");
  return { id: data.id };
}

export async function updateNote(id: string, content: string, title?: string) {
  const supabase = await createClient();
  const update: Record<string, string> = { content };
  if (title !== undefined) update.title = title;
  const { error } = await supabase.from("notes").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/notes");
}

export async function deleteNote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/notes");
}
```

- [ ] **Step 2: Create note list and editor components**

Create `src/components/notes/note-list.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createNote, deleteNote } from "@/app/(dashboard)/notes/actions";
import type { Note } from "@/types";

export function NoteList({
  notes, selectedId, onSelect, isShared,
}: {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isShared: boolean;
}) {
  const [creating, setCreating] = useState(false);

  async function handleCreate(formData: FormData) {
    formData.set("is_shared", String(isShared));
    const result = await createNote(formData);
    if (result?.id) {
      onSelect(result.id);
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{isShared ? "Compartidas" : "Mis Notas"}</h3>
        <Button variant="ghost" size="icon" onClick={() => setCreating(!creating)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {creating && (
        <form action={handleCreate}>
          <Input name="title" placeholder="Titulo de la nota" autoFocus
            onKeyDown={(e) => { if (e.key === "Escape") setCreating(false); }}
          />
        </form>
      )}
      {notes.map((note) => (
        <div
          key={note.id}
          className={cn(
            "flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer",
            selectedId === note.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          )}
          onClick={() => onSelect(note.id)}
        >
          <div className="truncate">
            <p className="font-medium truncate">{note.title}</p>
            {note.author && <p className="text-xs opacity-70">{note.author.name}</p>}
          </div>
          <form action={() => deleteNote(note.id)} onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6" type="submit">
              <Trash2 className="h-3 w-3" />
            </Button>
          </form>
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/notes/note-editor.tsx`:
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateNote } from "@/app/(dashboard)/notes/actions";
import type { Note } from "@/types";

export function NoteEditor({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note.id, note.title, note.content]);

  const save = useCallback(() => {
    updateNote(note.id, content, title);
  }, [note.id, content, title]);

  useEffect(() => {
    const timer = setTimeout(save, 1000);
    return () => clearTimeout(timer);
  }, [content, title, save]);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-xl font-bold border-none px-0 focus-visible:ring-0"
        placeholder="Titulo"
      />
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 resize-none border-none px-0 focus-visible:ring-0 min-h-[400px]"
        placeholder="Escribe aqui... (soporta markdown)"
      />
      <p className="text-xs text-muted-foreground">Auto-guardado</p>
    </div>
  );
}
```

- [ ] **Step 3: Create notes page**

Create `src/app/(dashboard)/notes/page.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { NoteList } from "@/components/notes/note-list";
import { NoteEditor } from "@/components/notes/note-editor";
import { createClient } from "@/lib/supabase/client";
import type { Note } from "@/types";

export default function NotesPage() {
  const [tab, setTab] = useState<"personal" | "shared">("personal");
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotes() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase.from("notes").select("*, author:users(*)").order("updated_at", { ascending: false });

      if (tab === "personal") {
        query = query.eq("is_shared", false).eq("author_id", user.id);
      } else {
        query = query.eq("is_shared", true);
      }

      const { data } = await query;
      setNotes(data || []);
      if (data && data.length > 0 && !selectedId) setSelectedId(data[0].id);
    }
    fetchNotes();
  }, [tab]);

  const selectedNote = notes.find((n) => n.id === selectedId);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Notas</h1>
      <Tabs value={tab} onValueChange={(v) => { setTab(v as "personal" | "shared"); setSelectedId(null); }}>
        <TabsList>
          <TabsTrigger value="personal">Mis Notas</TabsTrigger>
          <TabsTrigger value="shared">Compartidas</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid grid-cols-[280px_1fr] gap-6 h-[calc(100vh-220px)]">
        <Card className="overflow-y-auto">
          <CardContent className="pt-4">
            <NoteList
              notes={notes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              isShared={tab === "shared"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 h-full">
            {selectedNote ? (
              <NoteEditor note={selectedNote} />
            ) : (
              <p className="text-muted-foreground text-center py-12">
                Selecciona o crea una nota
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Test notes**

1. Go to /notes -> create personal note
2. Type content -> auto-saves after 1s
3. Switch to "Compartidas" tab -> create shared note
4. Verify personal notes not visible to others (test with different login)
5. Delete note

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/notes/ src/components/notes/
git commit -m "feat: add notes module with personal/shared tabs, auto-save editor"
```

---

### Task 10: Settings

**Files:**
- Create: `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/settings/actions.ts`

**Interfaces:**
- Consumes: `createClient()`, user types
- Produces: `updateProfile()` server action

- [ ] **Step 1: Create settings server action**

Create `src/app/(dashboard)/settings/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("users").update({
    name: formData.get("name") as string,
    avatar_url: (formData.get("avatar_url") as string) || null,
  }).eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { success: true };
}
```

- [ ] **Step 2: Create settings page**

Create `src/app/(dashboard)/settings/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { updateProfile } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Ajustes</h1>

      <Card>
        <CardHeader><CardTitle>Perfil</CardTitle></CardHeader>
        <CardContent>
          <form action={updateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input name="name" defaultValue={profile.name} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled />
            </div>
            <div className="space-y-2">
              <Label>Avatar URL</Label>
              <Input name="avatar_url" defaultValue={profile.avatar_url || ""} placeholder="https://..." />
            </div>
            <Button type="submit">Guardar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Apariencia</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span>Tema oscuro / claro</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Test settings**

1. Go to /settings -> edit name
2. Save -> sidebar updates name
3. Toggle theme

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/settings/
git commit -m "feat: add settings page with profile edit and theme toggle"
```

---

### Task 11: Dashboard Home (Widgets)

**Files:**
- Create: `src/components/dashboard/partner-cards.tsx`, `src/components/dashboard/active-projects.tsx`, `src/components/dashboard/urgent-tasks.tsx`, `src/components/dashboard/quick-finance.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `createClient()`, all types, constants
- Produces: Dashboard home with 4 widget sections

- [ ] **Step 1: Create dashboard widgets**

Create `src/components/dashboard/partner-cards.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { User, Task, ProjectMember, Project } from "@/types";

export function PartnerCards({
  users, tasks, members, projects,
}: {
  users: User[];
  tasks: Task[];
  members: ProjectMember[];
  projects: Project[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {users.map((user) => {
        const userTasks = tasks.filter((t) => t.assigned_to === user.id && t.status !== "completed");
        const userProjects = members
          .filter((m) => m.user_id === user.id)
          .map((m) => projects.find((p) => p.id === m.project_id))
          .filter((p): p is Project => !!p && p.status === "active");

        return (
          <Card key={user.id}>
            <CardHeader className="pb-2">
              <CardTitle>{user.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{userTasks.length} pendientes</p>
              <div className="flex flex-wrap gap-1">
                {userProjects.map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-xs">{p.name}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

Create `src/components/dashboard/active-projects.tsx`:
```tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Project } from "@/types";

export function ActiveProjects({ projects }: { projects: Project[] }) {
  const active = projects.filter((p) => p.status === "active");

  return (
    <Card>
      <CardHeader><CardTitle>Proyectos Activos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {active.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="block">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground">{p.progress}%</span>
            </div>
            <Progress value={p.progress} />
          </Link>
        ))}
        {active.length === 0 && <p className="text-sm text-muted-foreground">Sin proyectos activos</p>}
      </CardContent>
    </Card>
  );
}
```

Create `src/components/dashboard/urgent-tasks.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/constants";
import type { Task } from "@/types";

export function UrgentTasks({ tasks }: { tasks: Task[] }) {
  const urgent = tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader><CardTitle>Pendientes Urgentes</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {urgent.map((t) => (
          <div key={t.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[t.priority] }} />
              <span>{t.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {t.due_date && <span className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString("es-MX")}</span>}
              <Badge variant="outline" className="text-xs">{t.assignee?.name}</Badge>
            </div>
          </div>
        ))}
        {urgent.length === 0 && <p className="text-sm text-muted-foreground">Sin pendientes urgentes</p>}
      </CardContent>
    </Card>
  );
}
```

Create `src/components/dashboard/quick-finance.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/types";

export function QuickFinance({ projects }: { projects: Project[] }) {
  const totalBudget = projects.reduce((s, p) => s + Number(p.budget), 0);
  const totalCost = projects.reduce((s, p) => s + Number(p.production_cost), 0);
  const margin = totalBudget - totalCost;

  return (
    <Card>
      <CardHeader><CardTitle>Resumen Financiero</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Ingresos</p>
            <p className="text-xl font-bold">${totalBudget.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Costos</p>
            <p className="text-xl font-bold">${totalCost.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Margen</p>
            <p className="text-xl font-bold text-green-500">${margin.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Update dashboard page**

Replace `src/app/(dashboard)/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { PartnerCards } from "@/components/dashboard/partner-cards";
import { ActiveProjects } from "@/components/dashboard/active-projects";
import { UrgentTasks } from "@/components/dashboard/urgent-tasks";
import { QuickFinance } from "@/components/dashboard/quick-finance";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: users }, { data: projects }, { data: tasks }, { data: members }] = await Promise.all([
    supabase.from("users").select("*"),
    supabase.from("projects").select("*"),
    supabase.from("tasks").select("*, assignee:users!assigned_to(*), project:projects(*)"),
    supabase.from("project_members").select("*"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <PartnerCards
        users={users || []}
        tasks={tasks || []}
        members={members || []}
        projects={projects || []}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <ActiveProjects projects={projects || []} />
        <UrgentTasks tasks={tasks || []} />
      </div>

      <QuickFinance projects={projects || []} />
    </div>
  );
}
```

- [ ] **Step 3: Test dashboard**

1. Go to / -> see partner cards, active projects, urgent tasks, finance summary
2. Create projects/tasks -> dashboard updates
3. All widgets show correct data

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx src/components/dashboard/
git commit -m "feat: add dashboard home with partner cards, active projects, urgent tasks, and finance summary"
```

---

## Execution Checklist

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Project scaffolding + types + Supabase clients | — |
| 2 | Database schema + seed | 1 |
| 3 | Auth (login + middleware) | 1, 2 |
| 4 | Layout (sidebar + theme) | 3 |
| 5 | Projects (list + detail + CRUD) | 4 |
| 6 | Tasks / Pendientes | 4 |
| 7 | Finance panel | 5 |
| 8 | Calendar | 6 |
| 9 | Notes | 4 |
| 10 | Settings | 4 |
| 11 | Dashboard home widgets | 5, 6, 7 |
