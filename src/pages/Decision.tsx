import { useEffect, useRef, useState } from "react";
import type { PSACert } from "../lib/psa";
import {
  resolveCard,
  fetchSignals,
  fetchAggregate,
  submitReview,
  formatCents,
  regradeEV,
  type ResolveResult,
  type CardSignals,
  type ReviewAggregate,
  type ReviewClassification,
} from "../lib/tracker";

interface Props {
  cert: PSACert;
  frontUrl: string | null;
  backUrl: string | null;
  onNext: () => void;
  onBack: () => void;
}

const SUBGRADE_MARKS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function SubgradeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ fontSize: 12, color: "var(--text-dim)" }}>{label}</label>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
        <span>5</span>
        <span>7.5</span>
        <span>10</span>
      </div>
    </div>
  );
}

export default function Decision({ cert, frontUrl, backUrl, onNext, onBack }: Props) {
  const [resolve, setResolve] = useState<ResolveResult | null>(null);
  const [signals, setSignals] = useState<CardSignals | null>(null);
  const [aggregate, setAggregate] = useState<ReviewAggregate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Review form
  const [classification, setClassification] = useState<ReviewClassification | null>(null);
  const [showSubgrades, setShowSubgrades] = useState(false);
  const [centering, setCentering] = useState(8.5);
  const [surface, setSurface] = useState(8.5);
  const [edges, setEdges] = useState(8.5);
  const [corners, setCorners] = useState(8.5);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    void (async () => {
      try {
        const res = await resolveCard(
          cert.CertNumber,
          cert.Subject,
          cert.VarietySet,
          cert.CardNumber || undefined,
        );
        setResolve(res);

        const top = res.candidates[0];
        if (top) {
          const [sig, agg] = await Promise.allSettled([
            fetchSignals(top.display_key),
            fetchAggregate(top.card_id, "psa", cert.CardGrade),
          ]);
          if (sig.status === "fulfilled") setSignals(sig.value);
          if (agg.status === "fulfilled") setAggregate(agg.value);
        }
      } catch (e) {
        setLoadError((e as Error).message);
      }
    })();
  }, [cert]);

  const handleSubmitReview = async () => {
    if (!classification) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReview({
        market_tracker_card_id: resolve?.candidates[0]?.card_id,
        game: "pokemon",
        set_code: resolve?.candidates[0]?.set_code ?? cert.VarietySet,
        card_number: cert.CardNumber || undefined,
        card_name: cert.Subject,
        company: "psa",
        grade: cert.CardGrade,
        cert_number: cert.CertNumber,
        front_image_url: frontUrl ?? undefined,
        back_image_url: backUrl ?? undefined,
        centering: showSubgrades ? centering : undefined,
        surface: showSubgrades ? surface : undefined,
        edges: showSubgrades ? edges : undefined,
        corners: showSubgrades ? corners : undefined,
        classification,
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const topCard = resolve?.candidates[0];
  const ev = signals ? regradeEV(signals.psa_9_cents, signals.psa_10_cents) : null;

  return (
    <div className="page" style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn btn-sm" onClick={onBack}>← Back</button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{cert.Subject}</h1>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {cert.VarietySet} {cert.CardNumber ? `· #${cert.CardNumber}` : ""} · PSA {cert.CardGrade}
            <span style={{ fontFamily: "monospace", marginLeft: 8 }}>#{cert.CertNumber}</span>
          </div>
        </div>
      </div>

      {loadError && <div className="error-banner" style={{ marginBottom: 16 }}>{loadError}</div>}

      {/* ── Resolve match ── */}
      {topCard && (
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>
          Matched:{" "}
          <a
            href={`https://market.futuregadgetlabs.com/cards/${topCard.display_key}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--accent)" }}
          >
            {topCard.name}
          </a>
          {topCard.finish ? ` (${topCard.finish})` : ""}
          {" "}· {(topCard.confidence * 100).toFixed(0)}% confidence
          {resolve?.cached ? " · cached" : ""}
        </div>
      )}

      {/* ── Market signals ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Market Signals</div>

        {!signals && !loadError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-dim)", fontSize: 13 }}>
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            Loading prices…
          </div>
        )}

        {signals && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
              <PriceCard label="PSA 9" cents={signals.psa_9_cents} />
              <PriceCard label="PSA 10" cents={signals.psa_10_cents} />
              <GemCard gemRate={signals.psa_gem_rate} />
            </div>

            {ev !== null && (
              <div style={{
                padding: "10px 14px",
                borderRadius: "var(--radius)",
                background: ev > 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.10)",
                border: `1px solid ${ev > 0 ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.25)"}`,
                fontSize: 13,
              }}>
                <span style={{ fontWeight: 600 }}>
                  Regrade EV: {ev > 0 ? "+" : ""}{formatCents(ev)}
                </span>
                <span style={{ color: "var(--text-dim)", marginLeft: 8, fontSize: 12 }}>
                  PSA10 ({formatCents(signals.psa_10_cents)}) − PSA9 ({formatCents(signals.psa_9_cents)}) − fee ($150)
                </span>
                {signals.last_signal && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--accent)" }}>
                    Signal: {signals.last_signal.replace(/_/g, " ")}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Review aggregate ── */}
      {aggregate && aggregate.total_reviews > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Community Reviews ({aggregate.total_reviews})</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <Stat label="Legit" value={aggregate.legit_count} color="var(--good)" />
            <Stat label="Looks Higher" value={aggregate.looks_higher_count} color="var(--warn)" />
            <Stat label="Looks Lower" value={aggregate.looks_lower_count} color="var(--bad)" />
            <Stat label="Unsure" value={aggregate.unsure_count} color="var(--text-dim)" />
            {aggregate.misgrade_rate_pct != null && (
              <Stat label="Misgrade Rate" value={`${aggregate.misgrade_rate_pct.toFixed(1)}%`} color="var(--warn)" />
            )}
          </div>
        </div>
      )}

      {/* ── Review form ── */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>Review This Card</div>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ color: "var(--good)", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>✓ Review saved</div>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={onNext}>
              Build eBay Listing →
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>Classification</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["legit", "looks_higher", "looks_lower", "unsure"] as ReviewClassification[]).map((cls) => (
                  <button
                    key={cls}
                    onClick={() => setClassification(cls)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "var(--radius)",
                      border: `1px solid ${classification === cls ? classColor(cls) : "var(--border)"}`,
                      background: classification === cls ? `${classColor(cls)}22` : "var(--bg-elev-2)",
                      color: classification === cls ? classColor(cls) : "var(--text)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: classification === cls ? 600 : 400,
                      textAlign: "left",
                    }}
                  >
                    {classLabel(cls)}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-sm"
              style={{ marginBottom: showSubgrades ? 12 : 16 }}
              onClick={() => setShowSubgrades((v) => !v)}
            >
              {showSubgrades ? "Hide" : "Add"} Subgrades
            </button>

            {showSubgrades && (
              <div style={{ marginBottom: 16 }}>
                <SubgradeSlider label="Centering" value={centering} onChange={setCentering} />
                <SubgradeSlider label="Surface" value={surface} onChange={setSurface} />
                <SubgradeSlider label="Edges" value={edges} onChange={setEdges} />
                <SubgradeSlider label="Corners" value={corners} onChange={setCorners} />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Notes (optional)</label>
              <textarea
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. heavy print line on back, centering looks off"
                style={{ resize: "vertical" }}
              />
            </div>

            {submitError && (
              <div className="error-banner" style={{ marginBottom: 12 }}>{submitError}</div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn" onClick={onNext}>
                Skip → List
              </button>
              <button
                className="btn btn-primary"
                disabled={!classification || submitting}
                onClick={() => void handleSubmitReview()}
              >
                {submitting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
                Save Review
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PriceCard({ label, cents }: { label: string; cents?: number }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg-elev-2)",
      borderRadius: "var(--radius)",
      border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{formatCents(cents)}</div>
    </div>
  );
}

function GemCard({ gemRate }: { gemRate: { gem_rate_pct?: number; pop_count?: number; pop_total?: number } }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg-elev-2)",
      borderRadius: "var(--radius)",
      border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Gem Rate</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>
        {gemRate.gem_rate_pct != null ? `${gemRate.gem_rate_pct.toFixed(1)}%` : "—"}
      </div>
      {gemRate.pop_count != null && gemRate.pop_total != null && (
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
          {gemRate.pop_count.toLocaleString()}/{gemRate.pop_total.toLocaleString()} pop
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

function classColor(cls: ReviewClassification): string {
  switch (cls) {
    case "legit": return "var(--good)";
    case "looks_higher": return "var(--warn)";
    case "looks_lower": return "var(--bad)";
    case "unsure": return "var(--text-dim)";
  }
}

function classLabel(cls: ReviewClassification): string {
  switch (cls) {
    case "legit": return "Legit grade";
    case "looks_higher": return "Looks higher";
    case "looks_lower": return "Looks lower";
    case "unsure": return "Unsure";
  }
}

// suppress unused warning — SUBGRADE_MARKS could be used for tick display
void SUBGRADE_MARKS;
