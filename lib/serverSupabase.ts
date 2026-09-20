import { createClient } from "@supabase/supabase-js";

// Server-side client that acts AS the calling user, so RLS still applies.
export async function supabaseForRequest(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { sb, user: null };
  return { sb, user: data.user };
}
