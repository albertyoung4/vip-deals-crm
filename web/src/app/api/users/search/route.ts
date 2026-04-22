import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Search CRM app users. Optionally filter by role ("dispo" for dispo reps).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const role = req.nextUrl.searchParams.get("role");
  const sb = supabaseAdmin();

  let query = sb
    .from("app_user")
    .select("id, name, google_email, role")
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(20);

  if (role) query = query.eq("role", role);
  if (q.length >= 2) {
    const like = `%${q}%`;
    query = query.or(`name.ilike.${like},google_email.ilike.${like}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data ?? [] });
}
