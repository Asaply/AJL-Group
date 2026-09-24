"use client";

import { cn } from "@/lib/utils";
import { useOpenTask } from "@/components/tasks/use-open-task";

export function OpenTaskButton({
  taskId,
  className,
  children,
}: {
  taskId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const openTask = useOpenTask();
  return (
    <button type="button" onClick={() => openTask(taskId)} className={cn("text-left hover:underline", className)}>
      {children}
    </button>
  );
}
