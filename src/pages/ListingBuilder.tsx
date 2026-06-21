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

function buildEbayQuery(cert: PSACert): string {
  const parts = [
    `PSA ${cert.CardGrade}`,
    cert.Year,
    cert.Subject,
    cert.CardNumber ? `#${cert.CardNumber}` : "",
    cert.Brand,
  ].filter(Boolean);
  return parts.join(" ");
}

function EbayLinks({ cert }: { cert: PSACert }) {
  const q = encodeURIComponent(buildEbayQuery(cert));
  const sold = `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Complete=1&LH_Sold=1&LH_ItemCondition=3000&_sop=13`;
  const active = `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_ItemCondition=3000&_sop=15`;
  const linkStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "var(--accent)",
    textDecoration: "none",
    padding: "6px 12px",
    border: "1px solid var(--accent)",
    borderRadius: 6,
    fontWeight: 500,
  };
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <a href={sold} target="_blank" rel="noreferrer" style={linkStyle}>
        📉 eBay Sold (90d)
      </a>
      <a href={active} target="_blank" rel="noreferrer" style={linkStyle}>
        🏷️ eBay Active Listings
      </a>
    </div>
  );
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

  // Order: user photos (front, back) first, then PSA registry stock images
  const psaStockUrls = cert.PSAImages
    .sort((a, b) => (b.IsFront ? 1 : 0) - (a.IsFront ? 1 : 0))
    .map((img) => img.ImageURL)
    .filter(Boolean);
  const picUrls = [...[frontUrl, backUrl].filter((u): u is string => u !== null), ...psaStockUrls]
    .slice(0, 12);

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
        <p className="form-hint" style={{ marginTop: 10 }}>
          {picUrls.length > 0
            ? `${picUrls.length} image${picUrls.length > 1 ? "s" : ""} will be included: ${[frontUrl, backUrl].filter(Boolean).length} photo${[frontUrl, backUrl].filter(Boolean).length !== 1 ? "s" : ""} + ${psaStockUrls.length} PSA stock`
            : "No images — fetch card images above to include photos in the listing."}
        </p>
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

          <div className="form-group full-width">
            <label className="form-label">Price Research</label>
            <EbayLinks cert={cert} />
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
