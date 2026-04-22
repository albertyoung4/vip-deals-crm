import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const sb = supabaseAdmin();
  const like = `%${q}%`;

  const { data, error } = await sb
    .from("v_deal_dashboard")
    .select("deal_id, full_address, us_state, county, ask_price, status")
    .ilike("full_address", like)
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data ?? [] });
}
