import { useState } from "react";
import type { PSACert } from "../lib/psa";
import { buildTitle, buildDescription } from "../lib/psa";
import { EBAY_CATEGORIES, buildRow, generateCsv, downloadCsv } from "../lib/ebay";

interface Props {
  cert: PSACert;
  frontUrl: string | null;
  backUrl: string | null;
  onBack: () => void;
}

export default function ListingBuilder({ cert, frontUrl, backUrl, onBack }: Props) {
  const [title, setTitle] = useState(() => buildTitle(cert));
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState(EBAY_CATEGORIES[0]!.id);
  const [description, setDescription] = useState(() => buildDescription(cert));
  const [shippingProfile, setShippingProfile] = useState("");
  const [returnProfile, setReturnProfile] = useState("");
  const [paymentProfile, setPaymentProfile] = useState("");
  const [exported, setExported] = useState(false);

  const picUrls = [frontUrl, backUrl].filter((u): u is string => u !== null);

  const handleExport = () => {
    const row = buildRow(cert, {
      title,
      price,
      categoryId,
      description,
      picUrls,
      shippingProfile,
      returnProfile,
      paymentProfile,
    });
    const csv = generateCsv([row]);
    const filename = `ebay-listing-psa-${cert.CertNumber}.csv`;
    downloadCsv(filename, csv);
    setExported(true);
  };

  const canExport = title.trim() && price.trim();

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-sm" onClick={onBack}>← Back</button>
        <h1 className="page-title">Build eBay Listing</h1>
        <span className="badge badge-psa" style={{ marginLeft: "auto" }}>
          PSA {cert.CardGrade} · Cert #{cert.CertNumber}
        </span>
      </div>

      {/* ── Images preview ────────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Card Images</div>
        <div className="image-strip">
          {frontUrl ? (
            <img className="image-thumb" src={frontUrl} alt="Front" />
          ) : (
            <div className="image-placeholder">No front</div>
          )}
          {backUrl ? (
            <img className="image-thumb" src={backUrl} alt="Back" />
          ) : (
            <div className="image-placeholder">No back</div>
          )}
        </div>
        {picUrls.length > 0 && (
          <p className="form-hint" style={{ marginTop: 10 }}>
            {picUrls.length} image{picUrls.length > 1 ? "s" : ""} will be included in the CSV.
          </p>
        )}
      </div>

      {/* ── Listing form ──────────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Listing Details</div>
        <div className="listing-grid">

          <div className="form-group full-width">
            <label className="form-label" htmlFor="title">
              Title <span style={{ color: "var(--text-dim)" }}>({title.length}/80)</span>
            </label>
            <input
              id="title"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
            {title.length > 80 && (
              <span className="form-hint" style={{ color: "var(--bad)" }}>Title exceeds 80-character eBay limit</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="price">Price (USD) *</label>
            <input
              id="price"
              className="form-input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 49.99"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="category">eBay Category</label>
            <select
              id="category"
              className="form-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {EBAY_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label} ({c.id})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="shipping">Shipping Profile Name</label>
            <input
              id="shipping"
              className="form-input"
              placeholder="Must match your eBay shipping policy name"
              value={shippingProfile}
              onChange={(e) => setShippingProfile(e.target.value)}
            />
            <span className="form-hint">eBay Seller Hub &gt; Account &gt; Shipping policies</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="return">Return Profile Name</label>
            <input
              id="return"
              className="form-input"
              placeholder="Must match your eBay return policy name"
              value={returnProfile}
              onChange={(e) => setReturnProfile(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="payment">Payment Profile Name</label>
            <input
              id="payment"
              className="form-input"
              placeholder="Must match your eBay payment policy name"
              value={paymentProfile}
              onChange={(e) => setPaymentProfile(e.target.value)}
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              className="form-textarea"
              style={{ minHeight: 140 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

        </div>
      </div>

      {/* ── Item specifics preview ────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Item Specifics (auto-filled)</div>
        <div className="cert-grid">
          {[
            ["Grading Service", "PSA"],
            ["Grade", cert.CardGrade],
            ["Cert #", cert.CertNumber],
            ["Card Name", cert.Subject],
            ["Set", cert.VarietySet],
            ["Year", cert.Year],
            ["Card #", cert.CardNumber || "—"],
          ].map(([label, val]) => (
            <div key={label} className="cert-field">
              <label>{label}</label>
              <div className="value">{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Export ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 24 }}>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={!canExport}
        >
          Download eBay CSV
        </button>
        {exported && (
          <span style={{ fontSize: 12, color: "var(--good)" }}>
            CSV downloaded — import via Seller Hub › Listings › Import Listings
          </span>
        )}
        {!price.trim() && (
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Set a price to enable export</span>
        )}
      </div>
    </div>
  );
}
