import { supabaseAdmin } from "./supabase";

// Dev-mode shim: treats DEV_USER_EMAIL as the current user and upserts into
// crm.app_user on first hit. Replace with Supabase Auth + middleware for prod.

export async function getCurrentUser() {
  const email = process.env.DEV_USER_EMAIL;
  const name = process.env.DEV_USER_NAME ?? email;
  if (!email) throw new Error("DEV_USER_EMAIL not set");

  const sb = supabaseAdmin();
  const { data: existing } = await sb
    .from("app_user")
    .select("id, google_email, name, role")
    .eq("google_email", email)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await sb
    .from("app_user")
    .insert({ google_email: email, name, role: "admin" })
    .select("id, google_email, name, role")
    .single();
  if (error) throw new Error(`failed to create app_user: ${error.message}`);
  return data;
}
