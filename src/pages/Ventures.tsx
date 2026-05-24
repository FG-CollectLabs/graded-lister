import { useCallback, useEffect, useState } from "react";
import {
  listVentures,
  createVenture,
  submitForGrading,
  recordResult,
  recordSale,
  formatCents,
  totalCost,
  GRADING_SERVICES,
  PURCHASE_SOURCES,
  SALE_PLATFORMS,
  GRADING_COMPANIES,
  type Venture,
  type VentureStage,
  type CreateVentureParams,
} from "../lib/ventures";

// ── Stage config ─────────────────────────────────────────────────────────────

const STAGE_ORDER: VentureStage[] = ["purchased", "submitted", "graded", "sold"];
const STAGE_LABEL: Record<VentureStage, string> = {
  purchased: "Purchased",
  submitted: "At Grader",
  graded: "Graded",
  sold: "Sold",
};
const STAGE_COLOR: Record<VentureStage, string> = {
  purchased: "var(--text-dim)",
  submitted: "var(--warn)",
  graded: "var(--accent)",
  sold: "var(--good)",
};

// ── Main component ────────────────────────────────────────────────────────────

interface VenturesProps {
  prefill?: Partial<CreateVentureParams>;
  onRegradeAnalysis?: (cert: string) => void;
}

export default function Ventures({ prefill, onRegradeAnalysis }: VenturesProps) {
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(!!prefill);
  const [addPrefill, setAddPrefill] = useState<Partial<CreateVentureParams> | undefined>(prefill);
  const [actionVenture, setActionVenture] = useState<Venture | null>(null);
  const [actionType, setActionType] = useState<"submit" | "result" | "sell" | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVentures(await listVentures());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const active = ventures.filter((v) => v.stage !== "sold");
  const sold = ventures.filter((v) => v.stage === "sold");
  const totalInvested = active.reduce((s, v) => s + totalCost(v), 0);
  const realizedPnl = sold.reduce((s, v) => s + v.net_pnl_cents, 0);

  const grouped = STAGE_ORDER.reduce<Record<VentureStage, Venture[]>>(
    (acc, s) => { acc[s] = ventures.filter((v) => v.stage === s); return acc; },
    { purchased: [], submitted: [], graded: [], sold: [] },
  );

  const handleAction = (v: Venture, type: "submit" | "result" | "sell") => {
    setActionVenture(v);
    setActionType(type);
  };

  const handleActionDone = async () => {
    setActionVenture(null);
    setActionType(null);
    await reload();
  };

  return (
    <div className="page" style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Ventures</h1>
        <button className="btn btn-primary" onClick={() => { setAddPrefill(undefined); setShowAdd(true); }}>+ New</button>
      </div>

      {/* ── Summary ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <SummaryCard label="Active ventures" value={active.length.toString()} />
        <SummaryCard label="Capital at risk" value={formatCents(totalInvested)} />
        <SummaryCard
          label="Realized P&L"
          value={formatCents(realizedPnl)}
          color={realizedPnl >= 0 ? "var(--good)" : "var(--bad)"}
        />
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
          <span className="spinner" />
        </div>
      ) : ventures.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
          No ventures yet. Hit "+ New" to log your first purchase.
        </div>
      ) : (
        STAGE_ORDER.map((stage) =>
          grouped[stage].length === 0 ? null : (
            <div key={stage} style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: STAGE_COLOR[stage], marginBottom: 10,
              }}>
                {STAGE_LABEL[stage]} ({grouped[stage].length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {grouped[stage].map((v) => (
                  <VentureCard
                    key={v.purchase_id}
                    venture={v}
                    onAction={handleAction}
                    onRegradeAnalysis={onRegradeAnalysis}
                  />
                ))}
              </div>
            </div>
          ),
        )
      )}

      {/* ── Modals ── */}
      {showAdd && (
        <Modal title="Log Purchase" onClose={() => setShowAdd(false)}>
          <AddVentureForm
            prefill={addPrefill}
            onDone={async () => { setShowAdd(false); setAddPrefill(undefined); await reload(); }}
            onCancel={() => { setShowAdd(false); setAddPrefill(undefined); }}
          />
        </Modal>
      )}

      {actionVenture && actionType === "submit" && (
        <Modal title="Submit for Grading" onClose={() => { setActionVenture(null); setActionType(null); }}>
          <SubmitForm
            venture={actionVenture}
            onDone={handleActionDone}
            onCancel={() => { setActionVenture(null); setActionType(null); }}
          />
        </Modal>
      )}

      {actionVenture && actionType === "result" && (
        <Modal title="Record Grading Result" onClose={() => { setActionVenture(null); setActionType(null); }}>
          <ResultForm
            venture={actionVenture}
            onDone={handleActionDone}
            onCancel={() => { setActionVenture(null); setActionType(null); }}
          />
        </Modal>
      )}

      {actionVenture && actionType === "sell" && (
        <Modal title="Record Sale" onClose={() => { setActionVenture(null); setActionType(null); }}>
          <SellForm
            venture={actionVenture}
            onDone={handleActionDone}
            onCancel={() => { setActionVenture(null); setActionType(null); }}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Venture card ─────────────────────────────────────────────────────────────

function VentureCard({
  venture: v,
  onAction,
  onRegradeAnalysis,
}: {
  venture: Venture;
  onAction: (v: Venture, t: "submit" | "result" | "sell") => void;
  onRegradeAnalysis?: (cert: string) => void;
}) {
  const cost = totalCost(v);
  const gradeStr = (v.result_grade ?? v.grade) ? `${(v.result_company ?? v.company ?? "psa").toUpperCase()} ${v.result_grade ?? v.grade}` : null;
  const certStr = v.result_cert_number ?? v.cert_number;

  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{v.card_name}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            {v.set_code}{v.card_number ? ` · #${v.card_number}` : ""}
            {gradeStr ? <span style={{ marginLeft: 8, color: "var(--accent)" }}>{gradeStr}</span> : null}
            {certStr ? <span style={{ marginLeft: 8, fontFamily: "monospace" }}>#{certStr}</span> : null}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {v.stage === "sold" ? (
            <div style={{ color: v.net_pnl_cents >= 0 ? "var(--good)" : "var(--bad)", fontWeight: 700, fontSize: 15 }}>
              {v.net_pnl_cents >= 0 ? "+" : ""}{formatCents(v.net_pnl_cents)}
            </div>
          ) : (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{formatCents(cost)} in</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "var(--text-dim)", flexWrap: "wrap" }}>
        <span>Bought: {formatCents(v.purchase_price_cents)}{v.shipping_cents > 0 ? ` + ${formatCents(v.shipping_cents)} ship` : ""}</span>
        {v.grading_fee_cents ? <span>Grade fee: {formatCents(v.grading_fee_cents)}</span> : null}
        {v.sale_price_cents ? <span>Sold: {formatCents(v.sale_price_cents)}</span> : null}
        <span style={{ marginLeft: "auto", color: STAGE_COLOR[v.stage] }}>{STAGE_LABEL[v.stage]}</span>
      </div>

      {/* Action button based on stage */}
      {v.stage !== "sold" && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          {v.stage === "purchased" && (
            <button className="btn btn-sm btn-primary" onClick={() => onAction(v, "submit")}>
              Submit for Grading →
            </button>
          )}
          {v.stage === "submitted" && (
            <button className="btn btn-sm btn-primary" onClick={() => onAction(v, "result")}>
              Record Result →
            </button>
          )}
          {v.stage === "graded" && (
            <div style={{ display: "flex", gap: 8 }}>
              {onRegradeAnalysis && (v.result_cert_number ?? v.cert_number) && (
                <button
                  className="btn btn-sm"
                  onClick={() => onRegradeAnalysis((v.result_cert_number ?? v.cert_number)!)}
                >
                  Regrade Analysis
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={() => onAction(v, "sell")}>
                Record Sale →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add venture form ──────────────────────────────────────────────────────────

function AddVentureForm({ prefill, onDone, onCancel }: { prefill?: Partial<CreateVentureParams>; onDone: () => Promise<void>; onCancel: () => void }) {
  const [cardName, setCardName] = useState(prefill?.card_name ?? "");
  const [setCode, setSetCode] = useState(prefill?.set_code ?? "");
  const [cardNumber, setCardNumber] = useState(prefill?.card_number ?? "");
  const [certNumber, setCertNumber] = useState(prefill?.cert_number ?? "");
  const [priceDollars, setPriceDollars] = useState("");
  const [shippingDollars, setShippingDollars] = useState("");
  const [source, setSource] = useState("ebay");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!cardName.trim() || !setCode.trim()) {
      setError("Card name and set code are required");
      return;
    }
    const price = Math.round(parseFloat(priceDollars || "0") * 100);
    if (price <= 0) { setError("Enter a purchase price"); return; }

    setSaving(true);
    setError(null);
    try {
      await createVenture({
        market_tracker_card_id: prefill?.market_tracker_card_id,
        card_name: cardName.trim(),
        set_code: setCode.trim().toUpperCase(),
        card_number: cardNumber.trim() || undefined,
        cert_number: certNumber.trim() || undefined,
        purchase_price_cents: price,
        shipping_cents: Math.round(parseFloat(shippingDollars || "0") * 100),
        purchase_source: source,
      });
      await onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Card Name *" value={cardName} onChange={setCardName} placeholder="Charizard" />
        <FormField label="Set Code *" value={setCode} onChange={setSetCode} placeholder="BS" />
        <FormField label="Card #" value={cardNumber} onChange={setCardNumber} placeholder="4" />
        <FormField label="Cert Number" value={certNumber} onChange={setCertNumber} placeholder="12345678" />
        <FormField label="Purchase Price ($) *" value={priceDollars} onChange={setPriceDollars} placeholder="45.00" type="number" />
        <FormField label="Shipping ($)" value={shippingDollars} onChange={setShippingDollars} placeholder="0.00" type="number" />
      </div>
      <div className="form-group">
        <label className="form-label">Source</label>
        <select className="form-input" value={source} onChange={(e) => setSource(e.target.value)}>
          {PURCHASE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <FormActions onSave={() => void handleSave()} onCancel={onCancel} saving={saving} />
    </div>
  );
}

// ── Submit form ───────────────────────────────────────────────────────────────

function SubmitForm({ venture, onDone, onCancel }: { venture: Venture; onDone: () => Promise<void>; onCancel: () => void }) {
  const [service, setService] = useState("psa_economy");
  const [feeDollars, setFeeDollars] = useState("");
  const [submissionRef, setSubmissionRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await submitForGrading(venture.purchase_id, {
        service,
        fee_estimate_cents: feeDollars ? Math.round(parseFloat(feeDollars) * 100) : undefined,
        submission_ref: submissionRef.trim() || undefined,
      });
      await onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>
        {venture.card_name} · {venture.set_code}
      </div>
      <div className="form-group">
        <label className="form-label">Service</label>
        <select className="form-input" value={service} onChange={(e) => setService(e.target.value)}>
          {GRADING_SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Fee Estimate ($)" value={feeDollars} onChange={setFeeDollars} placeholder="18.00" type="number" />
        <FormField label="Submission Ref" value={submissionRef} onChange={setSubmissionRef} placeholder="ORD-12345" />
      </div>
      {error && <div className="error-banner">{error}</div>}
      <FormActions onSave={() => void handleSave()} onCancel={onCancel} saving={saving} />
    </div>
  );
}

// ── Result form ───────────────────────────────────────────────────────────────

function ResultForm({ venture, onDone, onCancel }: { venture: Venture; onDone: () => Promise<void>; onCancel: () => void }) {
  const [company, setCompany] = useState("psa");
  const [grade, setGrade] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [feeDollars, setFeeDollars] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!grade.trim()) { setError("Grade is required"); return; }
    setSaving(true);
    setError(null);
    try {
      await recordResult(venture.purchase_id, {
        company,
        grade: grade.trim(),
        cert_number: certNumber.trim() || undefined,
        fee_actual_cents: feeDollars ? Math.round(parseFloat(feeDollars) * 100) : undefined,
      });
      await onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>
        {venture.card_name} · {venture.set_code}
        {venture.grading_service ? ` · ${venture.grading_service.replace("_", " ")}` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Company</label>
          <select className="form-input" value={company} onChange={(e) => setCompany(e.target.value)}>
            {GRADING_COMPANIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </div>
        <FormField label="Grade *" value={grade} onChange={setGrade} placeholder="9" />
        <FormField label="Cert Number" value={certNumber} onChange={setCertNumber} placeholder="12345678" />
        <FormField label="Actual Fee ($)" value={feeDollars} onChange={setFeeDollars} placeholder="18.00" type="number" />
      </div>
      {error && <div className="error-banner">{error}</div>}
      <FormActions onSave={() => void handleSave()} onCancel={onCancel} saving={saving} />
    </div>
  );
}

// ── Sell form ─────────────────────────────────────────────────────────────────

function SellForm({ venture, onDone, onCancel }: { venture: Venture; onDone: () => Promise<void>; onCancel: () => void }) {
  const [saleDollars, setSaleDollars] = useState("");
  const [feesDollars, setFeesDollars] = useState("");
  const [platform, setPlatform] = useState("ebay");
  const [listingUrl, setListingUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost = totalCost(venture);
  const salePrice = Math.round(parseFloat(saleDollars || "0") * 100);
  const fees = Math.round(parseFloat(feesDollars || "0") * 100);
  const previewPnl = salePrice > 0 ? salePrice - fees - cost : null;

  const handleSave = async () => {
    if (salePrice <= 0) { setError("Enter a sale price"); return; }
    setSaving(true);
    setError(null);
    try {
      await recordSale(venture.purchase_id, {
        sale_price_cents: salePrice,
        fees_cents: fees,
        platform,
        listing_url: listingUrl.trim() || undefined,
      });
      await onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const grade = venture.result_grade ?? venture.grade;
  const co = (venture.result_company ?? venture.company ?? "psa").toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>
        {venture.card_name} · {grade ? `${co} ${grade}` : venture.set_code}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Sale Price ($) *" value={saleDollars} onChange={setSaleDollars} placeholder="120.00" type="number" />
        <FormField label="Platform Fees ($)" value={feesDollars} onChange={setFeesDollars} placeholder="15.00" type="number" />
      </div>
      <div className="form-group">
        <label className="form-label">Platform</label>
        <select className="form-input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {SALE_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <FormField label="Listing URL" value={listingUrl} onChange={setListingUrl} placeholder="https://ebay.com/itm/..." />

      {previewPnl !== null && (
        <div style={{
          padding: "10px 14px",
          borderRadius: "var(--radius)",
          background: previewPnl >= 0 ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
          border: `1px solid ${previewPnl >= 0 ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
          fontSize: 14,
        }}>
          <span style={{ fontWeight: 600 }}>P&L preview: </span>
          <span style={{ color: previewPnl >= 0 ? "var(--good)" : "var(--bad)", fontWeight: 700 }}>
            {previewPnl >= 0 ? "+" : ""}{formatCents(previewPnl)}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: 12, marginLeft: 8 }}>
            ({formatCents(salePrice)} − {formatCents(fees)} fees − {formatCents(cost)} cost)
          </span>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      <FormActions onSave={() => void handleSave()} onCancel={onCancel} saving={saving} saveLabel="Record Sale" />
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        className="form-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
      />
    </div>
  );
}

function FormActions({
  onSave, onCancel, saving, saveLabel = "Save",
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
      <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
      <button className="btn btn-primary" onClick={onSave} disabled={saving}>
        {saving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
        {saveLabel}
      </button>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, zIndex: 100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 24,
        width: "100%",
        maxWidth: 480,
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", fontSize: 18, padding: 4 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
