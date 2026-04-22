"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/current-user";
import { DealStatus } from "@/lib/types";

export async function updateDeal(formData: FormData): Promise<void> {
  const dealId = String(formData.get("deal_id"));
  const patch: Record<string, unknown> = {};

  const status = formData.get("status");
  if (status) patch.status = status as DealStatus;

  const override_arv = formData.get("override_arv");
  if (override_arv !== null) {
    const s = String(override_arv).trim();
    patch.override_arv = s === "" ? null : Number(s);
  }
  const override_rehab = formData.get("override_rehab");
  if (override_rehab !== null) {
    const s = String(override_rehab).trim();
    patch.override_rehab = s === "" ? null : Number(s);
  }

  const marketplace_url = formData.get("marketplace_url");
  if (marketplace_url !== null) {
    const s = String(marketplace_url).trim();
    patch.marketplace_url = s === "" ? null : s;
  }
  const dropbox_url = formData.get("dropbox_url");
  if (dropbox_url !== null) {
    const s = String(dropbox_url).trim();
    patch.dropbox_url = s === "" ? null : s;
  }

  const walk_through_date = formData.get("walk_through_date");
  if (walk_through_date !== null) {
    const s = String(walk_through_date).trim();
    patch.walk_through_date = s === "" ? null : s;
  }

  if (Object.keys(patch).length === 0) return;

  const sb = supabaseAdmin();
  const { error } = await sb.from("deal").update(patch).eq("id", dealId);
  if (error) throw new Error(`update deal: ${error.message}`);

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/");
}

export async function addNote(formData: FormData): Promise<void> {
  const dealId = String(formData.get("deal_id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const user = await getCurrentUser();
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("note")
    .insert({ deal_id: dealId, author_id: user.id, body });
  if (error) throw new Error(`add note: ${error.message}`);

  revalidatePath(`/deals/${dealId}`);
}

export async function addInterest(formData: FormData): Promise<void> {
  const dealId = String(formData.get("deal_id"));
  const source = String(formData.get("source") ?? "other");
  const name = String(formData.get("investor_name") ?? "").trim() || null;
  const email = String(formData.get("investor_email") ?? "").trim() || null;
  const phone = String(formData.get("investor_phone") ?? "").trim() || null;
  const priceRaw = String(formData.get("bid_price") ?? "").trim();
  const bid_price = priceRaw === "" ? null : Number(priceRaw);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const investor_user_idRaw = String(formData.get("investor_user_id") ?? "").trim();
  const investor_user_id = investor_user_idRaw === "" ? null : investor_user_idRaw;

  if (!name && !email && !phone && !investor_user_id) return;

  const user = await getCurrentUser();
  const sb = supabaseAdmin();
  const { error } = await sb.from("interest").insert({
    deal_id: dealId,
    source,
    investor_user_id,
    investor_name: name,
    investor_email: email,
    investor_phone: phone,
    bid_price,
    notes,
    created_by: user.id,
  });
  if (error) throw new Error(`add interest: ${error.message}`);

  revalidatePath(`/deals/${dealId}`);
}

export async function addAttachment(formData: FormData): Promise<void> {
  const dealId = String(formData.get("deal_id"));
  const kind = String(formData.get("kind") ?? "other");
  const url = String(formData.get("url") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || null;
  if (!url) return;

  const user = await getCurrentUser();
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("attachment")
    .insert({ deal_id: dealId, kind, url, label, uploaded_by: user.id });
  if (error) throw new Error(`add attachment: ${error.message}`);

  revalidatePath(`/deals/${dealId}`);
}

export async function updateInterest(formData: FormData): Promise<void> {
  const id = String(formData.get("interest_id"));
  const dealId = String(formData.get("deal_id"));
  const priceRaw = String(formData.get("bid_price") ?? "").trim();
  const bid_price = priceRaw === "" ? null : Number(priceRaw);
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const notes = notesRaw === "" ? null : notesRaw;

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("interest")
    .update({ bid_price, notes })
    .eq("id", id);
  if (error) throw new Error(`update interest: ${error.message}`);

  revalidatePath(`/deals/${dealId}`);
}

export async function assignDispoRep(formData: FormData): Promise<void> {
  const dealId = String(formData.get("deal_id"));
  const userIdRaw = String(formData.get("user_id") ?? "").trim();
  const userId = userIdRaw === "" ? null : userIdRaw;

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("deal")
    .update({ dispo_rep_id: userId })
    .eq("id", dealId);
  if (error) throw new Error(`assign dispo rep: ${error.message}`);

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/");
}

export async function saveWholesalerProfile(formData: FormData): Promise<void> {
  const wholesalerKey = String(formData.get("wholesaler_key") ?? "").trim();
  if (!wholesalerKey) throw new Error("wholesaler_key required");

  const company = String(formData.get("seller_company") ?? "").trim() || null;
  const first = String(formData.get("seller_first_name") ?? "").trim() || null;
  const last = String(formData.get("seller_last_name") ?? "").trim() || null;

  const emailRaw = String(formData.get("email_override") ?? "").trim();
  const phoneRaw = String(formData.get("phone_override") ?? "").trim();
  const email_override = emailRaw === "" ? null : emailRaw;
  const phone_override = phoneRaw === "" ? null : phoneRaw;

  const user = await getCurrentUser();
  const sb = supabaseAdmin();

  const { error } = await sb
    .from("wholesaler_profile")
    .upsert(
      {
        wholesaler_key: wholesalerKey,
        seller_company: company,
        seller_first_name: first,
        seller_last_name: last,
        email_override,
        phone_override,
        created_by: user.id,
      },
      { onConflict: "wholesaler_key" },
    );
  if (error) throw new Error(`save wholesaler profile: ${error.message}`);

  const dealId = String(formData.get("deal_id") ?? "").trim();
  if (dealId) revalidatePath(`/deals/${dealId}`);
  revalidatePath("/");
  revalidatePath(`/wholesalers/${encodeURIComponent(wholesalerKey)}`);
}

export async function createDeal(formData: FormData): Promise<string> {
  const listingId = String(formData.get("listing_id"));
  if (!listingId) throw new Error("listing_id required");

  const user = await getCurrentUser();
  const sb = supabaseAdmin();

  const { data: existing } = await sb
    .from("deal")
    .select("id")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await sb
    .from("deal")
    .insert({ listing_id: listingId, created_by: user.id, status: "contacted_no_response" })
    .select("id")
    .single();
  if (error) throw new Error(`create deal: ${error.message}`);

  revalidatePath("/");
  return data!.id as string;
}
