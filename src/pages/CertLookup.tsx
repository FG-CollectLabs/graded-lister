import { useEffect, useRef, useState } from "react";
import {
  lookupCert,
  fetchAndStoreImages,
  uploadImageFile,
  uploadImageFromUrl,
  type PSACert,
} from "../lib/psa";
import { startCertQrScan, type ScanController } from "../lib/qrScan";

interface Props {
  initialCert?: string;
  onReady: (cert: PSACert, frontUrl: string | null, backUrl: string | null) => void;
}

type Phase = "idle" | "looking-up" | "fetching-images" | "done" | "error";

export default function CertLookup({ initialCert, onReady }: Props) {
  const [certInput, setCertInput] = useState(initialCert ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cert, setCert] = useState<PSACert | null>(null);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCtrlRef = useRef<ScanController | null>(null);

  // Auto-trigger lookup when arriving from Ventures with a pre-filled cert.
  useEffect(() => {
    if (initialCert) void handleLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => scanCtrlRef.current?.stop();
  }, []);

  const handleLookupCert = async (certNumber: string) => {
    setCertInput(certNumber);
    setError(null);
    setCert(null);
    setFrontUrl(null);
    setBackUrl(null);
    setPhase("looking-up");
    try {
      const psaCert = await lookupCert(certNumber);
      setCert(psaCert);
      setPhase("fetching-images");
      const { frontUrl: fUrl, backUrl: bUrl } = await fetchAndStoreImages(psaCert.CertNumber);
      setFrontUrl(fUrl);
      setBackUrl(bUrl);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  const startScan = async () => {
    setError(null);
    setScanning(true);
    await new Promise((r) => requestAnimationFrame(r));
    if (!videoRef.current) return;
    scanCtrlRef.current = await startCertQrScan(
      videoRef.current,
      (certNumber) => {
        setScanning(false);
        void handleLookupCert(certNumber);
      },
      (err) => {
        setScanning(false);
        setError(`Camera error: ${err.message}`);
      },
    );
  };

  const stopScan = () => {
    scanCtrlRef.current?.stop();
    scanCtrlRef.current = null;
    setScanning(false);
  };

  const handleLookup = async () => {
    if (!certInput.trim()) return;
    await handleLookupCert(certInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleLookup();
  };

  const busy = phase === "looking-up" || phase === "fetching-images";

  return (
    <div className="page">
      <h1 className="page-title">PSA Cert Lookup</h1>

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
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => void handleLookup()}
              disabled={busy || !certInput.trim()}
            >
              {busy ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
              {phase === "looking-up" ? "Looking up…" : phase === "fetching-images" ? "Fetching images…" : "Look Up"}
            </button>
            <button
              className="btn"
              onClick={() => void startScan()}
              disabled={busy || scanning}
              title="Scan PSA slab QR code"
            >
              📷 Scan QR
            </button>
          </div>
        </div>

        {scanning && (
          <div
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16,
            }}
          >
            <video
              ref={videoRef}
              style={{ width: "100%", maxWidth: 480, borderRadius: 8, background: "#000" }}
              muted
            />
            <p style={{ color: "#fff", marginTop: 12, fontSize: 14 }}>
              Point camera at the PSA slab QR code
            </p>
            <button className="btn" onClick={stopScan} style={{ marginTop: 12 }}>Cancel</button>
          </div>
        )}

        {phase === "fetching-images" && (
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10 }}>
            Downloading card images and uploading to storage…
          </p>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {cert && (
        <div className="card">
          <div className="card-title">PSA Certification Details</div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div className="image-strip">
              <ImageSlot
                label="Front"
                side="front"
                certNumber={cert.CertNumber}
                url={frontUrl}
                disabled={phase !== "done"}
                onUploaded={setFrontUrl}
                onError={setError}
              />
              <ImageSlot
                label="Back"
                side="back"
                certNumber={cert.CertNumber}
                url={backUrl}
                disabled={phase !== "done"}
                onUploaded={setBackUrl}
                onError={setError}
              />
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="cert-grid">
                <div className="cert-field">
                  <label>Grade</label>
                  <div className="value grade">{cert.CardGrade}</div>
                </div>
                <div className="cert-field">
                  <label>Grade Description</label>
                  <div className="value"><span className="badge badge-psa">{cert.GradeDescription}</span></div>
                </div>
                <div className="cert-field">
                  <label>Cert Number</label>
                  <div className="value" style={{ fontFamily: "monospace", fontSize: 12 }}>{cert.CertNumber}</div>
                </div>
                <div className="cert-field"><label>Subject</label><div className="value">{cert.Subject}</div></div>
                <div className="cert-field"><label>Brand</label><div className="value">{cert.Brand}</div></div>
                <div className="cert-field"><label>Set</label><div className="value">{cert.VarietySet}</div></div>
                <div className="cert-field"><label>Card #</label><div className="value">{cert.CardNumber || "—"}</div></div>
                <div className="cert-field"><label>Year</label><div className="value">{cert.Year}</div></div>
              </div>
            </div>
          </div>

          {(!frontUrl || !backUrl) && phase === "done" && (
            <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 12 }}>
              PSA has no API images for this cert. Open{" "}
              <a
                href={`https://www.psacard.com/cert/${cert.CertNumber}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent)" }}
              >
                psacard.com/cert/{cert.CertNumber}
              </a>{" "}
              and right-click → Copy Image Address, then paste below. Or drop a local image file.
            </p>
          )}

          {phase === "done" && (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={() => onReady(cert, frontUrl, backUrl)}>
                Build eBay Listing →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ImageSlot ────────────────────────────────────────────────────────────────

interface ImageSlotProps {
  label: string;
  side: "front" | "back";
  certNumber: string;
  url: string | null;
  disabled: boolean;
  onUploaded: (url: string) => void;
  onError: (msg: string) => void;
}

function ImageSlot({ label, side, certNumber, url, disabled, onUploaded, onError }: ImageSlotProps) {
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (url) {
    return <img className="image-thumb" src={url} alt={`Card ${label.toLowerCase()}`} />;
  }

  const submitFile = async (file: File) => {
    setUploading(true);
    try {
      const u = await uploadImageFile(certNumber, side, file);
      onUploaded(u);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submitUrl = async () => {
    const v = urlInput.trim();
    if (!v) return;
    setUploading(true);
    try {
      const u = await uploadImageFromUrl(certNumber, side, v);
      onUploaded(u);
      setUrlInput("");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="image-placeholder"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 8,
        border: dragOver ? "2px dashed var(--accent)" : undefined,
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void submitFile(file);
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
        No {label.toLowerCase()} image
      </span>
      {uploading ? (
        <span className="spinner" />
      ) : (
        <>
          <button
            className="btn btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            style={{ width: "100%" }}
          >
            Drop or pick file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void submitFile(file);
              e.target.value = "";
            }}
          />
          <input
            type="url"
            className="form-input"
            placeholder="paste PSA image URL"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submitUrl(); }}
            disabled={disabled}
            style={{ fontSize: 11, padding: "4px 6px" }}
          />
          <button
            className="btn btn-sm"
            onClick={() => void submitUrl()}
            disabled={disabled || !urlInput.trim()}
            style={{ width: "100%" }}
          >
            Fetch URL
          </button>
        </>
      )}
    </div>
  );
}
