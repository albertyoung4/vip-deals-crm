"use client";

import { useState } from "react";
import { money, timeago } from "@/lib/format";
import { updateInterest } from "./actions";

interface InterestRow {
  id: string;
  source: string;
  investor_name: string | null;
  investor_email: string | null;
  investor_phone: string | null;
  bid_price: number | null;
  notes: string | null;
  created_at: string;
}

export default function InterestTable({
  dealId,
  rows,
}: {
  dealId: string;
  rows: InterestRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-neutral-500">No bids or manual interest yet.</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-2">Investor</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2 text-right">Bid</th>
            <th className="px-3 py-2">Notes</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} dealId={dealId} r={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ dealId, r }: { dealId: string; r: InterestRow }) {
  const editable = r.source !== "bid";
  const [bid, setBid] = useState<string>(r.bid_price == null ? "" : String(r.bid_price));
  const [notes, setNotes] = useState<string>(r.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    (bid === "" ? null : Number(bid)) !== r.bid_price ||
    (notes.trim() === "" ? null : notes.trim()) !== r.notes;

  async function save() {
    if (!editable || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const fd = new FormData();
      fd.append("interest_id", r.id);
      fd.append("deal_id", dealId);
      fd.append("bid_price", bid);
      fd.append("notes", notes);
      await updateInterest(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-3 py-2">
        <div className="font-medium">{r.investor_name ?? "—"}</div>
        <div className="text-xs text-neutral-400">
          {r.source} · {timeago(r.created_at)}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-neutral-600">
        {r.investor_email ? (
          <a className="hover:underline" href={`mailto:${r.investor_email}`}>
            {r.investor_email}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-xs text-neutral-600">
        {r.investor_phone ? (
          <a className="hover:underline" href={`tel:${r.investor_phone}`}>
            {r.investor_phone}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {editable ? (
          <input
            type="number"
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            onBlur={save}
            className="w-28 rounded-md border px-2 py-1 text-right text-sm"
            placeholder="—"
          />
        ) : (
          <span className="font-medium">{money(r.bid_price)}</span>
        )}
      </td>
      <td className="px-3 py-2">
        {editable ? (
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={save}
            className="w-full rounded-md border px-2 py-1 text-sm"
            placeholder="—"
          />
        ) : (
          <span className="text-xs text-neutral-500">{r.notes ?? "—"}</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {editable && (saving ? (
          <span className="text-neutral-400">saving…</span>
        ) : saved ? (
          <span className="text-green-600">saved</span>
        ) : dirty ? (
          <button
            type="button"
            onClick={save}
            className="rounded-md border px-2 py-0.5 text-xs hover:bg-neutral-50"
          >
            save
          </button>
        ) : null)}
      </td>
    </tr>
  );
}
