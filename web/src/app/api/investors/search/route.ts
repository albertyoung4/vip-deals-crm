import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const sb = supabaseAdmin();
  const like = `%${q}%`;

  // Match on name, email, or phone. We OR them together and limit results.
  const { data, error } = await sb
    .from("ext_mktplace_user")
    .select("id, email, first_name, surname, phone_number, normalized_full_name")
    .or(
      `normalized_full_name.ilike.${like},email.ilike.${like},phone_number.ilike.${like}`,
    )
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = (data ?? []).map((u) => ({
    id: u.id,
    name:
      u.normalized_full_name ||
      [u.first_name, u.surname].filter(Boolean).join(" ") ||
      null,
    email: u.email ?? null,
    phone: u.phone_number ?? null,
  }));

  return NextResponse.json({ results });
}
