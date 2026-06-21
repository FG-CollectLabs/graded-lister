import { useEffect, useRef, useState } from "react";
import { lookupCert, fetchAndStoreImages, uploadCapturedImage, type PSACert } from "../lib/psa";
import { startCertQrScan, type ScanController } from "../lib/qrScan";
import { openCamera, captureFrame } from "../lib/imageCapture";

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

  // Manual image capture (fallback when PSA API has no TrueGrade images).
  const [captureSide, setCaptureSide] = useState<"front" | "back" | null>(null);
  const [capturePreview, setCapturePreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [uploadingSide, setUploadingSide] = useState<"front" | "back" | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);

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
    // Wait a tick so the video element mounts before we attach the stream.
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

  const stopCaptureStream = () => {
    captureStreamRef.current?.getTracks().forEach((t) => t.stop());
    captureStreamRef.current = null;
  };

  const startCapture = async (side: "front" | "back") => {
    setError(null);
    setCapturePreview(null);
    setCaptureSide(side);
    await new Promise((r) => requestAnimationFrame(r));
    try {
      const stream = await openCamera();
      captureStreamRef.current = stream;
      if (captureVideoRef.current) {
        captureVideoRef.current.srcObject = stream;
        captureVideoRef.current.setAttribute("playsinline", "true");
        await captureVideoRef.current.play();
      }
    } catch (e) {
      setError(`Camera error: ${(e as Error).message}`);
      setCaptureSide(null);
    }
  };

  const cancelCapture = () => {
    stopCaptureStream();
    if (capturePreview) URL.revokeObjectURL(capturePreview.url);
    setCapturePreview(null);
    setCaptureSide(null);
  };

  const takeShot = async () => {
    if (!captureVideoRef.current) return;
    try {
      const blob = await captureFrame(captureVideoRef.current);
      const url = URL.createObjectURL(blob);
      setCapturePreview({ blob, url });
      stopCaptureStream();
    } catch (e) {
      setError(`Capture failed: ${(e as Error).message}`);
    }
  };

  const retake = async () => {
    if (capturePreview) URL.revokeObjectURL(capturePreview.url);
    setCapturePreview(null);
    if (!captureSide) return;
    try {
      const stream = await openCamera();
      captureStreamRef.current = stream;
      if (captureVideoRef.current) {
        captureVideoRef.current.srcObject = stream;
        await captureVideoRef.current.play();
      }
    } catch (e) {
      setError(`Camera error: ${(e as Error).message}`);
    }
  };

  const useShot = async () => {
    if (!cert || !capturePreview || !captureSide) return;
    setUploadingSide(captureSide);
    try {
      const url = await uploadCapturedImage(cert.CertNumber, captureSide, capturePreview.blob);
      if (captureSide === "front") setFrontUrl(url);
      else setBackUrl(url);
      URL.revokeObjectURL(capturePreview.url);
      setCapturePreview(null);
      setCaptureSide(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingSide(null);
    }
  };

  useEffect(() => {
    return () => {
      stopCaptureStream();
      if (capturePreview) URL.revokeObjectURL(capturePreview.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLookup = async () => {
    if (!certInput.trim()) return;
    setError(null);
    setCert(null);
    setFrontUrl(null);
    setBackUrl(null);
    setPhase("looking-up");

    try {
      const psaCert = await lookupCert(certInput);
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
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
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
            <button className="btn" onClick={stopScan} style={{ marginTop: 12 }}>
              Cancel
            </button>
          </div>
        )}
        {phase === "fetching-images" && (
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10 }}>
            Downloading card images and uploading to storage…
          </p>
        )}

        {captureSide && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.9)",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <p style={{ color: "#fff", marginBottom: 8, fontSize: 14 }}>
              Capture <strong>{captureSide}</strong> of slab
            </p>
            {capturePreview ? (
              <img
                src={capturePreview.url}
                alt="preview"
                style={{ width: "100%", maxWidth: 480, borderRadius: 8, background: "#000" }}
              />
            ) : (
              <video
                ref={captureVideoRef}
                style={{ width: "100%", maxWidth: 480, borderRadius: 8, background: "#000" }}
                muted
                playsInline
              />
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {capturePreview ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => void useShot()}
                    disabled={uploadingSide !== null}
                  >
                    {uploadingSide ? "Uploading…" : "Use Photo"}
                  </button>
                  <button className="btn" onClick={() => void retake()}>Retake</button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={() => void takeShot()}>
                  Take Photo
                </button>
              )}
              <button className="btn" onClick={cancelCapture}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {cert && (
        <div className="card">
          <div className="card-title">PSA Certification Details</div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div className="image-strip">
              {frontUrl ? (
                <img className="image-thumb" src={frontUrl} alt="Card front" />
              ) : (
                <div
                  className="image-placeholder"
                  style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}
                >
                  {phase === "fetching-images" ? (
                    <span className="spinner" />
                  ) : uploadingSide === "front" ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>No front image</span>
                      {phase === "done" && (
                        <button className="btn btn-sm" onClick={() => void startCapture("front")}>
                          📷 Capture
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {backUrl ? (
                <img className="image-thumb" src={backUrl} alt="Card back" />
              ) : (
                <div
                  className="image-placeholder"
                  style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}
                >
                  {phase === "fetching-images" ? (
                    <span className="spinner" />
                  ) : uploadingSide === "back" ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>No back image</span>
                      {phase === "done" && (
                        <button className="btn btn-sm" onClick={() => void startCapture("back")}>
                          📷 Capture
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

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
