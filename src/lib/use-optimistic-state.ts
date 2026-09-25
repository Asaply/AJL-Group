"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ActionResult = { error: string } | undefined | void;

const NETWORK_ERROR = "No se pudo guardar. Revisa tu conexión.";

/**
 * Local copy of a server value that changes the instant the user acts.
 *
 * `apply(update, action)` shows `update(current)` right away, then runs the
 * server action. On an error the change is rolled back to the latest server
 * value and a toast explains why. Server values that arrive while changes are
 * still in flight are held back, so a slow refresh never flickers the UI back
 * to the old state; they are adopted once everything settles.
 */
export function useOptimisticState<T>(serverValue: T) {
  const [value, setValue] = useState(serverValue);
  const serverRef = useRef(serverValue);
  const pendingRef = useRef(0);
  const failedRef = useRef(false);

  useEffect(() => {
    serverRef.current = serverValue;
    if (pendingRef.current === 0) setValue(serverValue);
  }, [serverValue]);

  const apply = useCallback(async (update: (current: T) => T, action: () => Promise<ActionResult>) => {
    pendingRef.current += 1;
    setValue(update);
    let error: string | null = null;
    try {
      const result = await action();
      if (result && "error" in result) error = result.error;
    } catch {
      error = NETWORK_ERROR;
    }
    pendingRef.current -= 1;
    if (error) {
      toast.error(error);
      failedRef.current = true;
    }
    // A success keeps the optimistic value until the refreshed server value
    // lands. After a failure, once nothing else is in flight, fall back to the
    // latest server value, which holds none of the failed change.
    if (pendingRef.current === 0 && failedRef.current) {
      failedRef.current = false;
      setValue(serverRef.current);
    }
    return error === null;
  }, []);

  return [value, apply] as const;
}
