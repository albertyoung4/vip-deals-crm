"use client";

import { useEffect, useRef, useState } from "react";
import { assignDispoRep } from "./actions";

interface UserMatch {
  id: string;
  name: string | null;
  google_email: string;
  role: string;
}

interface Props {
  dealId: string;
  currentId: string | null;
  currentName: string | null;
  currentEmail: string | null;
  compact?: boolean;
}

export default function AssignDispoRep({
  dealId,
  currentId,
  currentName,
  currentEmail,
  compact,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim().length >= 2) params.set("q", query.trim());
        // no role filter — managers and admins can be assigned as dispo reps too
        const res = await fetch(`/api/users/search?${params.toString()}`);
        const json = await res.json();
        setResults(json.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open]);

  async function pick(u: UserMatch | null) {
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("deal_id", dealId);
      if (u) fd.append("user_id", u.id);
      await assignDispoRep(fd);
      setOpen(false);
      setQuery("");
    } finally {
      setPending(false);
    }
  }

  const label = currentName || currentEmail || "Assign rep";

  if (compact) {
    return (
      <div className="relative inline-block">
        {currentId ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-neutral-700 hover:underline"
            title="Change dispo rep"
          >
            {label}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 hover:border-neutral-500 hover:text-neutral-800"
          >
            + Assign
          </button>
        )}
        {open && (
          <Dropdown
            query={query}
            setQuery={setQuery}
            results={results}
            loading={loading}
            pending={pending}
            currentId={currentId}
            pick={pick}
            close={() => setOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {currentId ? (
          <div>
            <div className="text-sm font-medium">{currentName || currentEmail}</div>
            {currentName && currentEmail && (
              <div className="text-xs text-neutral-500">{currentEmail}</div>
            )}
          </div>
        ) : (
          <span className="text-sm text-neutral-500">No dispo rep assigned</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
        >
          {currentId ? "Change" : "Assign"}
        </button>
      </div>
      {open && (
        <Dropdown
          query={query}
          setQuery={setQuery}
          results={results}
          loading={loading}
          pending={pending}
          currentId={currentId}
          pick={pick}
          close={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function Dropdown(props: {
  query: string;
  setQuery: (s: string) => void;
  results: UserMatch[];
  loading: boolean;
  pending: boolean;
  currentId: string | null;
  pick: (u: UserMatch | null) => void;
  close: () => void;
}) {
  const { query, setQuery, results, loading, pending, currentId, pick, close } = props;
  return (
    <div className="absolute z-20 mt-1 w-64 rounded-md border bg-white p-2 shadow-lg">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or email…"
        className="mb-2 w-full rounded-md border px-2 py-1 text-sm"
      />
      <div className="max-h-60 overflow-auto">
        {loading && <div className="px-2 py-1 text-xs text-neutral-500">loading…</div>}
        {!loading && results.length === 0 && (
          <div className="px-2 py-1 text-xs text-neutral-500">No matches.</div>
        )}
        {results.map((u) => (
          <button
            key={u.id}
            type="button"
            disabled={pending}
            onClick={() => pick(u)}
            className={
              "flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 " +
              (u.id === currentId ? "bg-blue-50" : "")
            }
          >
            <span className="font-medium">{u.name ?? "(no name)"}</span>
            <span className="text-xs text-neutral-500">
              {u.google_email} · {u.role}
            </span>
          </button>
        ))}
      </div>
      {currentId && (
        <button
          type="button"
          disabled={pending}
          onClick={() => pick(null)}
          className="mt-2 w-full rounded-md border px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        >
          Unassign
        </button>
      )}
      <button
        type="button"
        onClick={close}
        className="mt-1 w-full rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
      >
        Cancel
      </button>
    </div>
  );
}
