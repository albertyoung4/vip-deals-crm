import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";

export const AUTH_COOKIE = "crm_user_email";
const ALLOWED_DOMAIN = "rebuilt.com";

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(e) && e.endsWith("@" + ALLOWED_DOMAIN);
}

// Get the current logged-in user from the auth cookie. Throws if not signed in
// or if the email isn't in the app_user table.
export async function getCurrentUser() {
  const jar = await cookies();
  const email = jar.get(AUTH_COOKIE)?.value;
  if (!email) throw new Error("Not signed in");
  if (!isAllowedEmail(email)) throw new Error("Not signed in");

  const sb = supabaseAdmin();
  const { data: existing } = await sb
    .from("app_user")
    .select("id, google_email, name, role, active")
    .eq("google_email", email.toLowerCase())
    .maybeSingle();

  if (!existing || !existing.active) throw new Error("User not authorized");
  return existing;
}

// Returns null instead of throwing — useful for rendering the header.
export async function getCurrentUserOrNull() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}
