"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { AUTH_COOKIE, isAllowedEmail } from "@/lib/current-user";

export async function login(formData: FormData): Promise<void> {
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!isAllowedEmail(rawEmail)) {
    redirect("/login?error=domain");
  }

  const sb = supabaseAdmin();
  const { data: existing } = await sb
    .from("app_user")
    .select("id, active")
    .eq("google_email", rawEmail)
    .maybeSingle();

  if (!existing) {
    // Auto-provision the user as a dispo rep. Admins can bump role later.
    const { error } = await sb
      .from("app_user")
      .insert({
        google_email: rawEmail,
        name: rawEmail.split("@")[0].replace(/\./g, " "),
        role: "dispo",
        active: true,
      });
    if (error) redirect("/login?error=insert");
  } else if (!existing.active) {
    redirect("/login?error=inactive");
  }

  const jar = await cookies();
  jar.set(AUTH_COOKIE, rawEmail, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}
