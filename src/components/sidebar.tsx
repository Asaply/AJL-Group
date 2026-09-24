"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, ListTodo, DollarSign,
  Calendar, StickyNote, Settings, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { ThemeToggle } from "./theme-toggle";
import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import type { User } from "@/types";

const icons = {
  LayoutDashboard, FolderKanban, ListTodo, DollarSign,
  Calendar, StickyNote, Settings,
};

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-screen w-64 border-r bg-card">
      <div className="p-6">
        <h1 className="text-xl font-bold">AJL Group</h1>
        <p className="text-sm text-muted-foreground">{user.name}</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
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
          <Button variant="ghost" size="icon" type="submit" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
