import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { DashboardRow, DEAL_STATUSES } from "@/lib/types";
import { money, pct, timeago } from "@/lib/format";
import { addAttachment, addNote, updateDeal } from "./actions";
import AddInterestCollapse from "./AddInterestCollapse";
import AssignDispoRep from "./AssignDispoRep";
import InterestTable from "./InterestTable";
import WholesalerContact from "./WholesalerContact";

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  app_user?: { name: string | null; google_email: string } | null;
}

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

interface AttachmentRow {
  id: string;
  kind: string;
  url: string;
  label: string | null;
  created_at: string;
}

export default async function DealDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const [{ data: deal }, { data: notes }, { data: interest }, { data: attachments }] =
    await Promise.all([
      sb.from("v_deal_dashboard").select("*").eq("deal_id", id).maybeSingle(),
      sb
        .from("note")
        .select("id, body, created_at, author_id, app_user(name, google_email)")
        .eq("deal_id", id)
        .order("created_at", { ascending: false }),
      sb
        .from("v_deal_interest")
        .select("*")
        .eq("deal_id", id)
        .order("created_at", { ascending: false }),
      sb
        .from("attachment")
        .select("id, kind, url, label, created_at")
        .eq("deal_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!deal) notFound();
  const d = deal as DashboardRow;
  const noteRows = (notes ?? []) as unknown as NoteRow[];
  const interestRows = (interest ?? []) as InterestRow[];
  const attachmentRows = (attachments ?? []) as AttachmentRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{d.full_address ?? "Unknown address"}</h1>
        <div className="text-sm text-neutral-500">
          {d.us_state} · {d.county} · listing state: {d.listing_state ?? "—"}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Valuation & PIPP
          </h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Cell label="Ask" value={money(d.ask_price)} />
            <Cell label="Wholesaler ARV" value={money(d.wholesaler_arv)} />
            <Cell label="Calc ARV (Savvy)" value={money(d.calc_arv)} />
            <Cell label="Wholesaler rehab" value={money(d.wholesaler_rehab)} />
            <Cell label="Calc rehab (Picket)" value={money(d.calc_rehab)} />
            <Cell label="Condition" value={d.condition_score ?? "—"} />
          </div>

          <div className="my-4 border-t" />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Cell
              label="ARV used"
              value={
                <span className={d.arv_source === "wholesaler" ? "text-red-700" : ""}>
                  {money(d.arv_used)}
                </span>
              }
            />
            <Cell
              label="Rehab used"
              value={
                <span className={d.rehab_source === "wholesaler" ? "text-red-700" : ""}>
                  {money(d.rehab_used)}
                </span>
              }
            />
            <Cell label="County tier" value={d.county_tier ?? "—"} />
            <Cell label="County weight" value={d.county_weight == null ? "—" : pct(d.county_weight, 0)} />
            <Cell label="Reno ratio" value={d.reno_ratio == null ? "—" : pct(d.reno_ratio, 1)} />
            <Cell label="Pred inv pct" value={pct(d.pred_inv_pct, 0)} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-neutral-50 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">PIPP</div>
              <div className="mt-1 text-2xl font-semibold">{money(d.pipp)}</div>
            </div>
            <div
              className={
                "rounded-md p-4 " +
                (d.predicted_spread == null
                  ? "bg-neutral-50"
                  : d.predicted_spread >= 0
                    ? "bg-green-50"
                    : "bg-red-50")
              }
            >
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Predicted spread (vs ask)
              </div>
              <div
                className={
                  "mt-1 text-2xl font-semibold " +
                  (d.predicted_spread == null
                    ? ""
                    : d.predicted_spread >= 0
                      ? "text-green-700"
                      : "text-red-700")
                }
              >
                {money(d.predicted_spread)}
              </div>
            </div>
          </div>

          <form action={updateDeal} className="mt-5 grid grid-cols-2 gap-3">
            <input type="hidden" name="deal_id" value={d.deal_id} />
            <LabeledInput
              label="Override ARV"
              name="override_arv"
              defaultValue={d.override_arv ?? ""}
              placeholder="leave blank to use calc"
            />
            <LabeledInput
              label="Override rehab"
              name="override_rehab"
              defaultValue={d.override_rehab ?? ""}
              placeholder="leave blank to use calc"
            />
            <button
              type="submit"
              className="col-span-2 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Save overrides
            </button>
          </form>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Status & Wholesaler
          </h2>

          <form action={updateDeal} className="flex flex-col gap-3">
            <input type="hidden" name="deal_id" value={d.deal_id} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">Status</span>
              <select
                name="status"
                defaultValue={d.status}
                className="rounded-md border px-2 py-1"
              >
                {DEAL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <LabeledInput
              label="Marketplace URL"
              name="marketplace_url"
              defaultValue={d.marketplace_url ?? ""}
              placeholder="https://m.rebuilt.com/houses/…"
            />
            <LabeledInput
              label="Dropbox / photos URL"
              name="dropbox_url"
              defaultValue={d.dropbox_url ?? ""}
              placeholder="https://dropbox.com/…"
            />
            <LabeledInput
              label="Walk-through date"
              name="walk_through_date"
              type="date"
              defaultValue={d.walk_through_date ?? ""}
            />
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Save
            </button>
          </form>

          <WholesalerContact
            dealId={d.deal_id}
            wholesalerKey={d.wholesaler_key}
            company={d.seller_company}
            firstName={d.seller_first_name}
            lastName={d.seller_last_name}
            email={d.seller_email}
            phone={d.seller_phone}
          />

          <div className="mt-5 border-t pt-4">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              Dispo rep
            </div>
            <AssignDispoRep
              dealId={d.deal_id}
              currentId={d.dispo_rep_id}
              currentName={d.dispo_rep_name}
              currentEmail={d.dispo_rep_email}
            />
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Investor interest ({interestRows.length})
        </h2>

        <InterestTable dealId={d.deal_id} rows={interestRows} />

        <AddInterestCollapse dealId={d.deal_id} />
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Notes ({d.note_count})
        </h2>

        <form action={addNote} className="mb-4 flex flex-col gap-2">
          <input type="hidden" name="deal_id" value={d.deal_id} />
          <textarea
            name="body"
            required
            placeholder="Add a note…"
            rows={2}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="self-start rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Post note
          </button>
        </form>

        {noteRows.length === 0 ? (
          <div className="text-sm text-neutral-500">No notes yet.</div>
        ) : (
          <ul className="divide-y text-sm">
            {noteRows.map((n) => (
              <li key={n.id} className="py-3">
                <div className="text-xs text-neutral-500">
                  {n.app_user?.name || n.app_user?.google_email || "Someone"} · {timeago(n.created_at)}
                </div>
                <div className="mt-1 whitespace-pre-wrap">{n.body}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Attachments
        </h2>

        {attachmentRows.length === 0 ? (
          <div className="text-sm text-neutral-500">
            Add a photo URL or Dropbox link below.
          </div>
        ) : (
          <ul className="mb-4 divide-y text-sm">
            {attachmentRows.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline"
                  >
                    {a.label || a.url}
                  </a>
                  <div className="text-xs text-neutral-500">{a.kind}</div>
                </div>
                <div className="text-xs text-neutral-400">{timeago(a.created_at)}</div>
              </li>
            ))}
          </ul>
        )}

        <form action={addAttachment} className="grid grid-cols-2 gap-3 border-t pt-4">
          <input type="hidden" name="deal_id" value={d.deal_id} />
          <LabeledInput label="URL" name="url" required />
          <LabeledInput label="Label (optional)" name="label" />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">Kind</span>
            <select name="kind" defaultValue="dropbox" className="rounded-md border px-2 py-1">
              <option value="photo">photo</option>
              <option value="dropbox">dropbox</option>
              <option value="other">other</option>
            </select>
          </label>
          <button
            type="submit"
            className="col-span-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add attachment
          </button>
        </form>
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function LabeledInput({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="rounded-md border px-2 py-1"
      />
    </label>
  );
}
