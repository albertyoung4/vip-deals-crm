"use client";

import { useEffect, useRef, useState } from "react";
import { addInterest } from "./deals/[id]/actions";

interface DealMatch {
  deal_id: string;
  full_address: string | null;
  us_state: string | null;
  county: string | null;
  ask_price: number | null;
}

interface InvestorMatch {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export default function AddInterestModal() {
  const [open, setOpen] = useState(false);
  const [deal, setDeal] = useState<DealMatch | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setDeal(null);
        }}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Add Investor Interest
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 pt-20"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add investor interest</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xl leading-none text-neutral-500 hover:text-neutral-800"
              >
                ×
              </button>
            </div>

            {!deal ? (
              <DealPicker onPick={setDeal} />
            ) : (
              <InterestFields
                deal={deal}
                onBack={() => setDeal(null)}
                onDone={() => setOpen(false)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DealPicker({ onPick }: { onPick: (d: DealMatch) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DealMatch[]>([]);
  const [loading, setLoading] = useState(false);
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
        const res = await fetch(`/api/deals/search?q=${encodeURIComponent(q)}`);
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

  return (
    <div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-500">Find a deal by address</span>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="type at least 2 characters…"
          className="rounded-md border px-2 py-1.5"
        />
      </label>
      <div className="mt-3 max-h-80 overflow-auto rounded-md border">
        {loading && <div className="px-3 py-2 text-xs text-neutral-500">searching…</div>}
        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <div className="px-3 py-2 text-xs text-neutral-500">No matches.</div>
        )}
        {!loading && query.trim().length < 2 && (
          <div className="px-3 py-2 text-xs text-neutral-500">
            Start typing to find a tracked deal.
          </div>
        )}
        {results.map((d) => (
          <button
            key={d.deal_id}
            type="button"
            onClick={() => onPick(d)}
            className="flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-neutral-50"
          >
            <span className="font-medium">{d.full_address ?? "—"}</span>
            <span className="text-xs text-neutral-500">
              {[d.us_state, d.county].filter(Boolean).join(" · ") || "—"}
              {d.ask_price != null && ` · Ask $${Math.round(d.ask_price).toLocaleString()}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function InterestFields({
  deal,
  onBack,
  onDone,
}: {
  deal: DealMatch;
  onBack: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InvestorMatch[]>([]);
  const [openDrop, setOpenDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [investorUserId, setInvestorUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bidPrice, setBidPrice] = useState("");
  const [source, setSource] = useState("email");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  function pick(m: InvestorMatch) {
    setInvestorUserId(m.id);
    setName(m.name ?? "");
    setEmail(m.email ?? "");
    setPhone(m.phone ?? "");
    setQuery(m.name ?? m.email ?? m.phone ?? "");
    setOpenDrop(false);
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      await addInterest(formData);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="deal_id" value={deal.deal_id} />
      <input type="hidden" name="investor_user_id" value={investorUserId} />

      <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Deal</div>
        <div className="font-medium">{deal.full_address}</div>
        <button
          type="button"
          onClick={onBack}
          className="mt-1 text-xs text-blue-600 hover:underline"
        >
          Change deal
        </button>
      </div>

      <div className="relative">
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
              setOpenDrop(true);
              setInvestorUserId("");
            }}
            onFocus={() => setOpenDrop(true)}
            onBlur={() => setTimeout(() => setOpenDrop(false), 150)}
            placeholder="type at least 2 characters…"
            className="rounded-md border px-2 py-1.5"
            autoComplete="off"
          />
        </label>
        {investorUserId && (
          <div className="mt-1 text-xs text-green-700">✓ Linked to marketplace user</div>
        )}
        {openDrop && query.trim().length >= 2 && (
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input
            type="text"
            name="investor_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border px-2 py-1.5"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            name="investor_email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border px-2 py-1.5"
          />
        </Field>
        <Field label="Phone">
          <input
            type="text"
            name="investor_phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-md border px-2 py-1.5"
          />
        </Field>
        <Field label="Bid price ($)">
          <input
            type="number"
            name="bid_price"
            value={bidPrice}
            onChange={(e) => setBidPrice(e.target.value)}
            className="rounded-md border px-2 py-1.5"
          />
        </Field>
        <Field label="Source">
          <select
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border px-2 py-1.5"
          >
            <option value="email">email</option>
            <option value="phone">phone</option>
            <option value="sms">sms</option>
            <option value="other">other</option>
          </select>
        </Field>
        <Field label="Notes">
          <input
            type="text"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-md border px-2 py-1.5"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Add interest"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
