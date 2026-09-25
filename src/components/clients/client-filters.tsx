"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLIENT_STATUS_LABELS } from "@/lib/clients";

export function ClientFilters({ industries }: { industries: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Kept current every render so a pending debounce timer (or any other delayed
  // caller) always builds the next URL from the latest params, not a stale
  // closure captured when the timer was scheduled.
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParamsRef.current.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const current = searchParamsRef.current.get("q") ?? "";
    if (q.trim() === current) return;
    const timer = setTimeout(() => setParam("q", q.trim()), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam reads the latest searchParams via ref
  }, [q]);

  // Resync `q` from the URL on Back/Forward (or any external navigation), but
  // never while the user is actively typing in the field.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (document.activeElement === inputRef.current) return;
    setQ((prev) => (prev === current ? prev : current));
  }, [searchParams]);

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-56">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente o contacto…"
          aria-label="Buscar cliente o contacto"
          className="pl-9"
        />
      </div>
      <Select value={searchParams.get("status") || "all"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {Object.entries(CLIENT_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("industry") || "all"} onValueChange={(v) => setParam("industry", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Industria" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las industrias</SelectItem>
          {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
