"use client";

import { useEffect, useRef, useState } from "react";
import { addInterest } from "./actions";

interface InvestorMatch {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export default function AddInterestForm({ dealId }: { dealId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InvestorMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [investorUserId, setInvestorUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bidPrice, setBidPrice] = useState("");
  const [source, setSource] = useState("email");
  const [notes, setNotes] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/investors/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(json.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  function pick(m: InvestorMatch): void {
    setInvestorUserId(m.id);
    setName(m.name ?? "");
    setEmail(m.email ?? "");
    setPhone(m.phone ?? "");
    setQuery(m.name ?? m.email ?? m.phone ?? "");
    setOpen(false);
  }

  function clearPick(): void {
    setInvestorUserId("");
  }

  async function handleSubmit(formData: FormData): Promise<void> {
    await addInterest(formData);
    // Reset after successful submit
    setQuery("");
    setInvestorUserId("");
    setName("");
    setEmail("");
    setPhone("");
    setBidPrice("");
    setNotes("");
    setResults([]);
  }

  return (
    <form
      action={handleSubmit}
      className="mt-4 grid grid-cols-2 gap-3 border-t pt-4"
    >
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="investor_user_id" value={investorUserId} />

      <div className="relative col-span-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            Search investor{" "}
            <span className="text-xs text-neutral-400">(name, email, or phone)</span>
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              clearPick();
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="type at least 2 characters…"
            className="rounded-md border px-2 py-1"
            autoComplete="off"
          />
        </label>
        {investorUserId && (
          <div className="mt-1 text-xs text-green-700">
            ✓ Linked to marketplace user
          </div>
        )}
        {open && query.trim().length >= 2 && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-lg">
            {loading && <div className="px-3 py-2 text-xs text-neutral-500">searching…</div>}
            {!loading && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-neutral-500">no matches</div>
            )}
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pick(m)}
                className="flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-neutral-50"
              >
                <span className="font-medium">{m.name ?? "(no name)"}</span>
                <span className="text-xs text-neutral-500">
                  {[m.email, m.phone].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Labeled label="Name">
        <input
          type="text"
          name="investor_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border px-2 py-1"
        />
      </Labeled>
      <Labeled label="Email">
        <input
          type="email"
          name="investor_email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border px-2 py-1"
        />
      </Labeled>
      <Labeled label="Phone">
        <input
          type="text"
          name="investor_phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-md border px-2 py-1"
        />
      </Labeled>
      <Labeled label="Bid price ($)">
        <input
          type="number"
          name="bid_price"
          value={bidPrice}
          onChange={(e) => setBidPrice(e.target.value)}
          className="rounded-md border px-2 py-1"
        />
      </Labeled>
      <Labeled label="Source">
        <select
          name="source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-md border px-2 py-1"
        >
          <option value="email">email</option>
          <option value="phone">phone</option>
          <option value="sms">sms</option>
          <option value="other">other</option>
        </select>
      </Labeled>
      <Labeled label="Notes">
        <input
          type="text"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md border px-2 py-1"
        />
      </Labeled>
      <button
        type="submit"
        className="col-span-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Add interest
      </button>
    </form>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
