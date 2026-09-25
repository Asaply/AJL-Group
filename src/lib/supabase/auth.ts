import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user for this request, or null.
 *
 * Uses getClaims(), which verifies the session JWT locally against the
 * project's signing keys (asymmetric keys; it falls back to asking the Auth
 * server for legacy symmetric ones) instead of a network round trip per call
 * like getUser(). React's cache() makes the layout and page of one render
 * share a single check.
 */
export const getAuthUser = cache(async (): Promise<{ id: string } | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return null;
  return { id: sub };
});
