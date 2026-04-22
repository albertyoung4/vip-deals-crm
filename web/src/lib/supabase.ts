import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client: uses service_role key (bypasses RLS).
// Access only from server components / actions / route handlers.
export function supabaseAdmin() {
  return createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false },
    db: { schema: "crm" },
  });
}
