"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { REALTIME_TABLES, createDebouncedRefresh } from "@/lib/realtime";

export function RealtimeRefresh() {
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const debouncedRefreshRef = useRef(createDebouncedRefresh(() => router.refresh(), 300));
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const debouncedRefresh = debouncedRefreshRef.current;

    // Create and subscribe to the realtime channel
    const channel = supabase.channel("dashboard-realtime");

    // Subscribe to changes in all realtime tables
    REALTIME_TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        () => {
          debouncedRefresh.trigger();
        }
      );
    });

    channel.subscribe();
    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      debouncedRefresh.cancel();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return null;
}
