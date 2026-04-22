export type DealStatus =
  | "contacted_no_response"
  | "contacted_in_discussion"
  | "scheduling_walk_thru"
  | "walk_thru_complete"
  | "bid_accepted"
  | "assignment_sent"
  | "assignment_signed"
  | "closed"
  | "already_sold";

export const DEAL_STATUSES: { value: DealStatus; label: string }[] = [
  { value: "contacted_no_response", label: "Contacted – No Response" },
  { value: "contacted_in_discussion", label: "Contacted – In Discussion" },
  { value: "scheduling_walk_thru", label: "Scheduling Walk-Thru" },
  { value: "walk_thru_complete", label: "Walk-Thru Complete" },
  { value: "bid_accepted", label: "Bid Accepted" },
  { value: "assignment_sent", label: "Assignment Sent" },
  { value: "assignment_signed", label: "Assignment Signed" },
  { value: "closed", label: "Closed" },
  { value: "already_sold", label: "Already Sold" },
];

export type InterestSource = "bid" | "email" | "phone" | "sms" | "other";
export type AttachmentKind = "photo" | "dropbox" | "other";

// Shape of crm.v_deal_dashboard rows
export interface DashboardRow {
  deal_id: string;
  status: DealStatus;
  marketplace_url: string | null;
  dropbox_url: string | null;
  override_arv: number | null;
  override_rehab: number | null;
  deal_created_at: string;
  deal_updated_at: string;

  listing_id: string;
  full_address: string | null;
  us_state: string | null;
  county: string | null;
  ask_price: number | null;
  listing_state: string | null;
  listing_state_group: string | null;
  listing_created_at: string | null;

  calc_arv: number | null;
  calc_rehab: number | null;
  calc_rent: number | null;
  condition_score: string | null;

  wholesaler_arv: number | null;
  wholesaler_rehab: number | null;
  wholesaler_rent: number | null;

  attom_id: number | null;
  seller_company: string | null;
  seller_first_name: string | null;
  seller_last_name: string | null;
  seller_email: string | null;
  seller_phone: string | null;

  county_tier: number | null;
  county_weight: number | null;
  reno_ratio: number | null;
  reno_weight: number | null;
  pred_inv_pct: number | null;

  arv_used: number | null;
  arv_source: "override" | "calc" | "wholesaler" | null;
  rehab_used: number | null;
  rehab_source: "override" | "calc" | "wholesaler" | null;

  pipp: number | null;
  predicted_spread: number | null;

  wholesaler_key: string | null;
  dispo_rep_id: string | null;
  dispo_rep_name: string | null;
  dispo_rep_email: string | null;
  walk_through_date: string | null;

  bid_count: number;
  max_bid: number | null;
  latest_bid_at: string | null;
  interest_count: number;
  last_interest_at: string | null;
  note_count: number;
  last_note_at: string | null;
}

export interface Note {
  id: string;
  deal_id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_email?: string;
  author_name?: string | null;
}

export interface Interest {
  id: string;
  deal_id: string;
  investor_user_id: string | null;
  investor_name: string | null;
  investor_email: string | null;
  investor_phone: string | null;
  source: InterestSource;
  bid_price: number | null;
  bid_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  deal_id: string;
  kind: AttachmentKind;
  url: string;
  label: string | null;
  created_at: string;
}
