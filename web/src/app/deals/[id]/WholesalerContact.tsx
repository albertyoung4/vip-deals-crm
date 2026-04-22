"use client";

import Link from "next/link";
import { useState } from "react";
import { saveWholesalerProfile } from "./actions";

interface Props {
  dealId: string;
  wholesalerKey: string | null;
  company: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export default function WholesalerContact({
  dealId,
  wholesalerKey,
  company,
  firstName,
  lastName,
  email,
  phone,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const displayName =
    company || [firstName, lastName].filter(Boolean).join(" ") || "No wholesaler on file";

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      await saveWholesalerProfile(formData);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 border-t pt-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          {wholesalerKey ? (
            <Link
              href={`/wholesalers/${encodeURIComponent(wholesalerKey)}`}
              className="font-medium text-blue-700 hover:underline"
            >
              {displayName}
            </Link>
          ) : (
            <div className="font-medium">{displayName}</div>
          )}
        </div>
        {wholesalerKey && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border px-2 py-0.5 text-xs hover:bg-neutral-50"
          >
            Edit contact
          </button>
        )}
      </div>

      {!editing ? (
        <>
          {email && (
            <div className="text-neutral-600">
              <a className="hover:underline" href={`mailto:${email}`}>
                {email}
              </a>
            </div>
          )}
          {phone && (
            <div className="text-neutral-600">
              <a className="hover:underline" href={`tel:${phone}`}>
                {phone}
              </a>
            </div>
          )}
          {!email && !phone && wholesalerKey && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 text-xs text-blue-600 hover:underline"
            >
              + Add email / phone
            </button>
          )}
        </>
      ) : (
        <form action={handleSubmit} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="deal_id" value={dealId} />
          <input type="hidden" name="wholesaler_key" value={wholesalerKey ?? ""} />
          <input type="hidden" name="seller_company" value={company ?? ""} />
          <input type="hidden" name="seller_first_name" value={firstName ?? ""} />
          <input type="hidden" name="seller_last_name" value={lastName ?? ""} />

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-500">Email</span>
            <input
              type="email"
              name="email_override"
              defaultValue={email ?? ""}
              className="rounded-md border px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-500">Phone</span>
            <input
              type="text"
              name="phone_override"
              defaultValue={phone ?? ""}
              className="rounded-md border px-2 py-1 text-sm"
            />
          </label>
          <div className="mt-1 text-xs text-neutral-500">
            Saved to the wholesaler&rsquo;s profile — used across all their listings.
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
