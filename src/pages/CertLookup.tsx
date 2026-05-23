import { useState } from "react";
import { getIdToken } from "../firebase";
import { lookupCert, fetchAndStoreImages, type PSACert } from "../lib/psa";

interface Props {
  onReady: (cert: PSACert, frontUrl: string | null, backUrl: string | null) => void;
}

type Phase = "idle" | "looking-up" | "fetching-images" | "done" | "error";

export default function CertLookup({ onReady }: Props) {
  const [certInput, setCertInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cert, setCert] = useState<PSACert | null>(null);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!certInput.trim()) return;
    setError(null);
    setCert(null);
    setFrontUrl(null);
    setBackUrl(null);
    setPhase("looking-up");

    try {
      const token = await getIdToken();

      // Step 1: fetch cert data
      const psaCert = await lookupCert(certInput, token);
      setCert(psaCert);
      setPhase("fetching-images");

      // Step 2: download images → Firebase Storage
      const { frontUrl: fUrl, backUrl: bUrl } = await fetchAndStoreImages(psaCert.CertNumber, token);
      setFrontUrl(fUrl);
      setBackUrl(bUrl);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleLookup();
  };

  const busy = phase === "looking-up" || phase === "fetching-images";

  return (
    <div className="page">
      <h1 className="page-title">PSA Cert Lookup</h1>

      {/* ── Lookup form ─────────────────────────────────────────── */}
      <div className="card">
        <div className="lookup-form">
          <div className="form-group">
            <label className="form-label" htmlFor="cert-input">PSA Cert Number</label>
            <input
              id="cert-input"
              className="form-input"
              placeholder="e.g. 12345678"
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => void handleLookup()}
            disabled={busy || !certInput.trim()}
          >
            {busy ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
            {phase === "looking-up" ? "Looking up…" : phase === "fetching-images" ? "Fetching images…" : "Look Up"}
          </button>
        </div>
        {phase === "fetching-images" && (
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10 }}>
            Downloading card images and uploading to storage…
          </p>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && <div className="error-banner">{error}</div>}

      {/* ── Cert result ─────────────────────────────────────────── */}
      {cert && (
        <div className="card">
          <div className="card-title">PSA Certification Details</div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {/* Images */}
            <div className="image-strip">
              {frontUrl ? (
                <img className="image-thumb" src={frontUrl} alt="Card front" />
              ) : (
                <div className="image-placeholder">
                  {phase === "fetching-images" ? <span className="spinner" /> : "No front image"}
                </div>
              )}
              {backUrl ? (
                <img className="image-thumb" src={backUrl} alt="Card back" />
              ) : (
                <div className="image-placeholder">
                  {phase === "fetching-images" ? <span className="spinner" /> : "No back image"}
                </div>
              )}
            </div>

            {/* Details */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="cert-grid">
                <div className="cert-field">
                  <label>Grade</label>
                  <div className="value grade">{cert.CardGrade}</div>
                </div>
                <div className="cert-field">
                  <label>Grade Description</label>
                  <div className="value">
                    <span className="badge badge-psa">{cert.GradeDescription}</span>
                  </div>
                </div>
                <div className="cert-field">
                  <label>Cert Number</label>
                  <div className="value" style={{ fontFamily: "monospace", fontSize: 12 }}>{cert.CertNumber}</div>
                </div>
                <div className="cert-field">
                  <label>Subject</label>
                  <div className="value">{cert.Subject}</div>
                </div>
                <div className="cert-field">
                  <label>Brand</label>
                  <div className="value">{cert.Brand}</div>
                </div>
                <div className="cert-field">
                  <label>Set</label>
                  <div className="value">{cert.VarietySet}</div>
                </div>
                <div className="cert-field">
                  <label>Card #</label>
                  <div className="value">{cert.CardNumber || "—"}</div>
                </div>
                <div className="cert-field">
                  <label>Year</label>
                  <div className="value">{cert.Year}</div>
                </div>
              </div>
            </div>
          </div>

          {phase === "done" && (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={() => onReady(cert, frontUrl, backUrl)}
              >
                Build eBay Listing →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
