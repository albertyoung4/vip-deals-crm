"use client";

import { useState, useTransition } from "react";
import { DEAL_STATUSES, DealStatus } from "@/lib/types";
import { updateDeal } from "./actions";

export default function StatusSelect({
  dealId,
  current,
}: {
  dealId: string;
  current: DealStatus;
}) {
  const [value, setValue] = useState<DealStatus>(current);
  const [pending, startTransition] = useTransition();

  function save(next: DealStatus) {
    setValue(next);
    const fd = new FormData();
    fd.append("deal_id", dealId);
    fd.append("status", next);
    startTransition(() => {
      updateDeal(fd);
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => save(e.target.value as DealStatus)}
      className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-neutral-300 focus:border-blue-500 focus:outline-none disabled:opacity-50"
    >
      {DEAL_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
