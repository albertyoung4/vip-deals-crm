"use server";

import { redirect } from "next/navigation";
import { createDeal } from "../[id]/actions";

export async function addDealAndRedirect(formData: FormData): Promise<void> {
  const dealId = await createDeal(formData);
  redirect(`/deals/${dealId}`);
}
