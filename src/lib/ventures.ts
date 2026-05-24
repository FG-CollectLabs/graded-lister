const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "";
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string;

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" };
}

export type VentureStage = "purchased" | "submitted" | "graded" | "sold";

export interface Venture {
  purchase_id: string;
  tracked_card_id: string;
  card_name: string;
  set_code: string;
  card_number?: string;
  company?: string;
  grade?: string;
  cert_number?: string;
  market_tracker_card_id?: string;
  purchase_price_cents: number;
  shipping_cents: number;
  purchase_source: string;
  purchased_at: string;
  submission_id?: string;
  grading_service?: string;
  grading_fee_cents?: number;
  submitted_at?: string;
  result_id?: string;
  result_company?: string;
  result_grade?: string;
  result_cert_number?: string;
  returned_at?: string;
  sale_id?: string;
  sale_price_cents?: number;
  sale_fees_cents?: number;
  sale_platform?: string;
  sold_at?: string;
  net_pnl_cents: number;
  stage: VentureStage;
}

export interface CreateVentureParams {
  market_tracker_card_id?: string;
  game?: string;
  set_code: string;
  card_number?: string;
  card_name: string;
  cert_number?: string;
  company?: string;
  grade?: string;
  purchase_price_cents: number;
  shipping_cents: number;
  purchase_source: string;
  purchased_at?: string;
  listing_url?: string;
  note?: string;
}

export interface SubmitParams {
  service: string;
  fee_estimate_cents?: number;
  declared_value_cents?: number;
  submission_ref?: string;
  note?: string;
}

export interface ResultParams {
  company: string;
  grade: string;
  cert_number?: string;
  fee_actual_cents?: number;
  note?: string;
}

export interface SellParams {
  sale_price_cents: number;
  fees_cents: number;
  platform: string;
  listing_url?: string;
  note?: string;
}

export async function listVentures(): Promise<Venture[]> {
  const res = await fetch(`${API_BASE}/v1/ventures`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  return res.json() as Promise<Venture[]>;
}

export async function createVenture(params: CreateVentureParams): Promise<{ purchase_id: string }> {
  const res = await fetch(`${API_BASE}/v1/ventures`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? `Create failed (${res.status})`);
  }
  return res.json() as Promise<{ purchase_id: string }>;
}

export async function submitForGrading(purchaseId: string, params: SubmitParams): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/ventures/${purchaseId}/submit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? `Submit failed (${res.status})`);
  }
}

export async function recordResult(purchaseId: string, params: ResultParams): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/ventures/${purchaseId}/result`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? `Record result failed (${res.status})`);
  }
}

export async function recordSale(purchaseId: string, params: SellParams): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/ventures/${purchaseId}/sell`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? `Record sale failed (${res.status})`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatCents(cents: number | undefined | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function totalCost(v: Venture): number {
  return v.purchase_price_cents + v.shipping_cents + (v.grading_fee_cents ?? 0);
}

export const GRADING_SERVICES = [
  { value: "psa_economy", label: "PSA Economy" },
  { value: "psa_regular", label: "PSA Regular" },
  { value: "psa_express", label: "PSA Express" },
  { value: "psa_walkthrough", label: "PSA Walkthrough" },
  { value: "cgc_economy", label: "CGC Economy" },
  { value: "cgc_standard", label: "CGC Standard" },
  { value: "cgc_express", label: "CGC Express" },
];

export const PURCHASE_SOURCES = ["ebay", "tcgplayer", "local", "show", "other"];
export const SALE_PLATFORMS = ["ebay", "tcgplayer", "local", "show", "other"];
export const GRADING_COMPANIES = ["psa", "cgc", "bgs", "sgc"];
