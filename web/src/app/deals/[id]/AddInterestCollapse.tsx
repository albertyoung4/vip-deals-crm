"use client";

import { useState } from "react";
import AddInterestForm from "./AddInterestForm";

export default function AddInterestCollapse({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md border border-dashed px-3 py-1.5 text-xs text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
      >
        + Add manual interest
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-md border bg-neutral-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Add manual interest
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 hover:text-neutral-900"
        >
          Cancel
        </button>
      </div>
      <AddInterestForm dealId={dealId} />
    </div>
  );
}
