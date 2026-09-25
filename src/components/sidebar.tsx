"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, ListTodo, DollarSign,
  Calendar, StickyNote, Settings, LogOut, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { ThemeToggle } from "./theme-toggle";
import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { parseHttpUrl } from "@/lib/url";
import type { User } from "@/types";

const icons = {
  LayoutDashboard, FolderKanban, ListTodo, DollarSign,
  Calendar, StickyNote, Settings, Building2,
};

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  // Highlight the clicked item right away instead of waiting for the new page
  // to arrive; the real pathname takes over once navigation lands.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => setPendingHref(null), [pathname]);
  const currentPath = pendingHref ?? pathname;
  const avatarUrl = parseHttpUrl(user.avatar_url);

  return (
    <aside className="flex flex-col h-screen w-64 border-r bg-card">
      <div className="p-6">
        <h1 className="text-xl font-bold">AJL Group</h1>
        <div className="mt-3 flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={user.name} />}
            <AvatarFallback className="text-xs">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <p className="text-sm text-muted-foreground">{user.name}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = icons[item.icon as keyof typeof icons];
          const isActive = item.href === "/"
            ? currentPath === "/"
            : currentPath.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              // Prefetch the whole page, data included, so a click shows it at
              // once instead of a skeleton. Realtime refreshes keep it current.
              prefetch
              onClick={(e) => {
                // Modified clicks open a new tab and leave this page as is.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                if (item.href !== pathname) setPendingHref(item.href);
              }}
              aria-current={isActive ? "page" : undefined}
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
          <Button variant="ghost" size="icon" type="submit" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
