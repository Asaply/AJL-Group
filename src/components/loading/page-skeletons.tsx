import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Route-level loading states. They render the real page title right away so a
 * click in the sidebar answers instantly while the server fetches the data.
 */

function Loading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("space-y-6", className)}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({ title, action = false }: { title?: string; action?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      {title ? <h1 className="text-3xl font-bold">{title}</h1> : <Skeleton className="h-9 w-64" />}
      {action && <Skeleton className="h-9 w-36" />}
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-9 w-40" />
    </div>
  );
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-6 space-y-3", className)}>
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}

export function CardGridSkeleton({ title, count = 6 }: { title: string; count?: number }) {
  return (
    <Loading>
      <PageHeaderSkeleton title={title} action />
      <FiltersSkeleton />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)}
      </div>
    </Loading>
  );
}

export function ListSkeleton({ title, rows = 6 }: { title: string; rows?: number }) {
  return (
    <Loading>
      <PageHeaderSkeleton title={title} action />
      <FiltersSkeleton />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

export function DashboardSkeleton() {
  return (
    <Loading>
      <PageHeaderSkeleton title="Dashboard" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <CardSkeleton className="h-64" />
        <CardSkeleton className="h-64" />
      </div>
      <CardSkeleton className="h-40" />
    </Loading>
  );
}

export function FinanceSkeleton() {
  return (
    <Loading>
      <PageHeaderSkeleton title="Finanzas" action />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
      </div>
      <CardSkeleton className="h-48" />
      <CardSkeleton className="h-72" />
    </Loading>
  );
}

export function CalendarSkeleton() {
  return (
    <Loading>
      <PageHeaderSkeleton title="Calendario" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    </Loading>
  );
}

export function NotesSkeleton() {
  return (
    <Loading>
      <PageHeaderSkeleton title="Notas" />
      <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    </Loading>
  );
}

export function SettingsSkeleton() {
  return (
    <Loading className="max-w-2xl">
      <PageHeaderSkeleton title="Ajustes" />
      <CardSkeleton className="h-64" />
      <CardSkeleton className="h-24" />
    </Loading>
  );
}

export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <Loading className={className}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="h-4 w-48" />
      <CardSkeleton className="h-56" />
      <CardSkeleton className="h-72" />
      <div className="grid gap-6 md:grid-cols-2">
        <CardSkeleton className="h-48" />
        <CardSkeleton className="h-48" />
      </div>
    </Loading>
  );
}
