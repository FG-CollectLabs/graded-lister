// API helpers for graded-lister-backend tracker + resolver endpoints,
// and market-tracker-backend signals endpoint.

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "";
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string;
const MT_BASE = "https://market.futuregadgetlabs.com";

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResolveCandidate {
  card_id: string;
  display_key: string;
  name: string;
  number: string;
  finish?: string;
  set_code: string;
  set_name: string;
  confidence: number;
}

export interface ResolveResult {
  cached: boolean;
  candidates: ResolveCandidate[];
  top_card_id?: string;
}

export interface GemRateInfo {
  pop_count?: number;
  pop_total?: number;
  gem_rate_pct?: number;
  week?: string;
}

export interface CardSignals {
  card_id: string;
  display_key: string;
  name: string;
  set_code: string;
  game: string;
  image_url?: string;
  on_watchlist: boolean;
  last_signal?: string;
  raw_cents?: number;
  psa_9_cents?: number;
  psa_10_cents?: number;
  cgc_10_cents?: number;
  price_week?: string;
  psa_gem_rate: GemRateInfo;
  cgc_gem_rate: GemRateInfo;
}

export interface ReviewAggregate {
  total_reviews: number;
  legit_count: number;
  looks_higher_count: number;
  looks_lower_count: number;
  unsure_count: number;
  misgrade_rate_pct?: number;
  avg_centering?: number;
  avg_surface?: number;
  avg_edges?: number;
  avg_corners?: number;
}

export type ReviewClassification = "legit" | "looks_higher" | "looks_lower" | "unsure";

export interface SubmitReviewParams {
  market_tracker_card_id?: string;
  game: string;
  set_code: string;
  card_number?: string;
  card_name: string;
  company?: string;
  grade?: string;
  cert_number?: string;
  front_image_url?: string;
  back_image_url?: string;
  centering?: number;
  surface?: number;
  edges?: number;
  corners?: number;
  predicted_grade?: string;
  classification: ReviewClassification;
  confidence?: number;
  notes?: string;
  seen_price_cents?: number;
  reviewer?: string;
}

// ── Resolver ──────────────────────────────────────────────────────────────────

export async function resolveCard(
  certNumber: string,
  subject: string,
  setName: string,
  number?: string,
): Promise<ResolveResult> {
  const params = new URLSearchParams({ subject, set: setName });
  if (certNumber) params.set("cert", certNumber);
  if (number) params.set("number", number);

  const res = await fetch(`${API_BASE}/v1/cards/resolve?${params}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Resolve failed (${res.status})`);
  return res.json() as Promise<ResolveResult>;
}

// ── Signals (from market-tracker, public) ─────────────────────────────────────

export async function fetchSignals(displayKey: string): Promise<CardSignals> {
  const res = await fetch(`${MT_BASE}/v1/cards/${encodeURIComponent(displayKey)}/signals`);
  if (!res.ok) throw new Error(`Signals fetch failed (${res.status})`);
  return res.json() as Promise<CardSignals>;
}

// ── Review aggregate ─────────────────────────────────────────────────────────

export async function fetchAggregate(
  cardId: string,
  company: string,
  grade: string,
): Promise<ReviewAggregate> {
  const params = new URLSearchParams({ card_id: cardId, company, grade });
  const res = await fetch(`${API_BASE}/v1/reviews/aggregate?${params}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Aggregate fetch failed (${res.status})`);
  return res.json() as Promise<ReviewAggregate>;
}

// ── Submit review ─────────────────────────────────────────────────────────────

export async function submitReview(params: SubmitReviewParams): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/v1/reviews`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? `Submit failed (${res.status})`);
  }
  return res.json() as Promise<{ id: string }>;
}

// ── Prior review for a cert ───────────────────────────────────────────────────

export interface PriorReview {
  id: string;
  classification: ReviewClassification;
  centering?: number;
  surface?: number;
  edges?: number;
  corners?: number;
  notes?: string;
  review_date: string;
  reviewer: string;
}

export async function fetchPriorReview(certNumber: string): Promise<PriorReview | null> {
  const res = await fetch(`${API_BASE}/v1/reviews/cert/${encodeURIComponent(certNumber)}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Prior review fetch failed (${res.status})`);
  return res.json() as Promise<PriorReview>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatCents(cents: number | undefined | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function regradeEV(psa9Cents?: number, psa10Cents?: number, feeCents = 15000): number | null {
  if (psa9Cents == null || psa10Cents == null) return null;
  return psa10Cents - psa9Cents - feeCents;
}
