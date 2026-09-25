"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { TASK_DETAIL_TABLES, createDebouncedRefresh } from "@/lib/realtime";
import { useCloseTask } from "@/components/tasks/use-open-task";
import { getTaskDetail } from "@/app/(dashboard)/tasks/detail-actions";
import { TaskFields } from "./task-fields";
import { TaskDescription } from "./task-description";
import { TaskChecklist } from "./task-checklist";
import { TaskLinks } from "./task-links";
import { TaskAttachments } from "./task-attachments";
import { TaskActivity } from "./task-activity";
import type { TaskDetail } from "@/types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; detail: TaskDetail };

export function TaskDetailSheet() {
  const taskId = useSearchParams().get("task");
  const closeTask = useCloseTask();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const latestId = useRef(taskId);
  latestId.current = taskId;

  const load = useCallback(async (id: string) => {
    const result = await getTaskDetail(id);
    if (latestId.current !== id) return; // user switched tasks while loading
    if ("error" in result) setState({ status: "error", message: result.error });
    else setState({ status: "ready", detail: result.detail });
  }, []);

  const reload = useCallback(() => {
    if (latestId.current) load(latestId.current);
  }, [load]);

  useEffect(() => {
    if (!taskId) return;
    setState({ status: "loading" });
    load(taskId);

    const supabase = createClient();
    const debounced = createDebouncedRefresh(() => load(taskId), 300);
    const channel = supabase.channel(`task-detail-${taskId}`);
    TASK_DETAIL_TABLES.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `task_id=eq.${taskId}` }, () =>
        debounced.trigger()
      );
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `id=eq.${taskId}` }, () =>
      debounced.trigger()
    );
    channel.subscribe();

    return () => {
      debounced.cancel();
      supabase.removeChannel(channel);
    };
  }, [taskId, load]);

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && closeTask()}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Detalle del pendiente</SheetTitle>
        </SheetHeader>
        {state.status === "loading" && (
          <div className="space-y-3 pt-4" aria-busy="true">
            <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-24 rounded bg-muted animate-pulse" />
            <div className="h-40 rounded bg-muted animate-pulse" />
          </div>
        )}
        {state.status === "error" && <p className="pt-6 text-sm text-muted-foreground">{state.message}</p>}
        {state.status === "ready" && (
          <div className="space-y-6 pt-2" key={state.detail.task.id}>
            <TaskFields detail={state.detail} reload={reload} />
            <Separator />
            <TaskDescription detail={state.detail} reload={reload} />
            <Separator />
            <TaskChecklist detail={state.detail} reload={reload} />
            <Separator />
            <TaskLinks detail={state.detail} reload={reload} />
            <Separator />
            <TaskAttachments detail={state.detail} reload={reload} />
            <Separator />
            <TaskActivity detail={state.detail} reload={reload} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
