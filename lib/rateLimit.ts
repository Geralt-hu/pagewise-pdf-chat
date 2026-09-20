import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Rule = { bucket: string; limit: number; windowSeconds: number };

// Limits per user. Tune these to your Gemini quota.
export const CHAT_RULES: Rule[] = [
  { bucket: "chat:minute", limit: 8, windowSeconds: 60 },
  { bucket: "chat:day", limit: 100, windowSeconds: 86400 },
];
export const INGEST_RULES: Rule[] = [
  { bucket: "ingest:hour", limit: 5, windowSeconds: 3600 },
  { bucket: "ingest:day", limit: 15, windowSeconds: 86400 },
];

type Row = { allowed: boolean; remaining: number; retry_after: number };

// Returns a 429/503 response if the request should be blocked, otherwise null.
export async function enforceRateLimit(sb: SupabaseClient, rules: Rule[]): Promise<NextResponse | null> {
  for (const rule of rules) {
    const { data, error } = await sb.rpc("check_rate_limit", {
      p_bucket: rule.bucket,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    if (error || !data) {
      // Fail closed: if we can't verify the limit, don't spend API quota.
      console.error("rate limit check failed:", error?.message);
      return NextResponse.json({ error: "Rate limiter unavailable. Please try again shortly." }, { status: 503 });
    }

    const row: Row = Array.isArray(data) ? data[0] : data;
    if (!row.allowed) {
      const wait = row.retry_after;
      const human = wait >= 3600 ? `${Math.ceil(wait / 3600)} hour(s)` : wait >= 60 ? `${Math.ceil(wait / 60)} minute(s)` : `${wait} seconds`;
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${human}.` },
        { status: 429, headers: { "Retry-After": String(wait), "X-RateLimit-Limit": String(rule.limit), "X-RateLimit-Remaining": "0" } }
      );
    }
  }
  return null;
}
