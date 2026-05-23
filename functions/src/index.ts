import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as https from "https";
import * as http from "http";

admin.initializeApp();
const bucket = admin.storage().bucket();

const OWNER_EMAIL = "fglabs.contact@gmail.com";
const PSA_API_BASE = "https://api.psacard.com/publicapi/cert/GetByCertNumber";

// ── HTTP fetch helpers (Node built-in, no extra deps) ─────────────────────────

function fetchUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod: typeof http = url.startsWith("https") ? (https as unknown as typeof http) : http;
    mod.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function fetchJson<T>(url: string): Promise<T> {
  const psaKey = process.env["PSA_API_KEY"];
  const headers: Record<string, string> = { "User-Agent": "graded-lister/1.0" };
  if (psaKey) headers["Authorization"] = `bearer ${psaKey}`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()) as T);
        } catch (e) {
          reject(e);
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ── lookupCert ────────────────────────────────────────────────────────────────
// GET /lookupCert?cert=12345678
// Proxies api.psacard.com to avoid browser CORS restrictions.

export const lookupCert = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  // Auth: require valid Firebase token for the owner email
  const authHeader = req.headers["authorization"] as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    if (decoded.email !== OWNER_EMAIL) { res.status(403).json({ error: "Forbidden" }); return; }
  } catch {
    res.status(401).json({ error: "Invalid token" }); return;
  }

  const cert = (req.query["cert"] as string | undefined)?.trim();
  if (!cert) { res.status(400).json({ error: "cert query param required" }); return; }

  try {
    const data = await fetchJson<unknown>(`${PSA_API_BASE}/${encodeURIComponent(cert)}`);
    res.json(data);
  } catch (e) {
    logger.error("PSA lookup error", e);
    res.status(502).json({ error: "PSA API request failed", detail: String(e) });
  }
});

// ── fetchImages ───────────────────────────────────────────────────────────────
// POST /fetchImages  body: { certNumber: string }
// Downloads PSA front/back images and uploads them to Firebase Storage.

interface PSAImageEntry {
  IsFront: boolean;
  ImageURL: string;
}

interface PSACertResponse {
  PSACert?: {
    CertNumber?: string;
    PSAImages?: PSAImageEntry[];
  };
}

export const fetchImages = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  const authHeader = req.headers["authorization"] as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    if (decoded.email !== OWNER_EMAIL) { res.status(403).json({ error: "Forbidden" }); return; }
  } catch {
    res.status(401).json({ error: "Invalid token" }); return;
  }

  const { certNumber } = req.body as { certNumber?: string };
  if (!certNumber) { res.status(400).json({ error: "certNumber body field required" }); return; }

  try {
    const data = await fetchJson<PSACertResponse>(`${PSA_API_BASE}/${encodeURIComponent(certNumber)}`);
    const images = data?.PSACert?.PSAImages ?? [];

    const frontEntry = images.find((i) => i.IsFront);
    const backEntry = images.find((i) => !i.IsFront);

    async function uploadImage(entry: PSAImageEntry | undefined, side: "front" | "back"): Promise<string | null> {
      if (!entry?.ImageURL) return null;
      try {
        const imgBuf = await fetchUrl(entry.ImageURL);
        const ext = entry.ImageURL.split(".").pop()?.split("?")[0] ?? "jpg";
        const destPath = `graded-lister/${certNumber}/${side}.${ext}`;
        const file = bucket.file(destPath);
        await file.save(imgBuf, { contentType: `image/${ext === "png" ? "png" : "jpeg"}` });
        await file.makePublic();
        return `https://storage.googleapis.com/${bucket.name}/${destPath}`;
      } catch (e) {
        logger.warn(`Failed to upload ${side} image for cert ${certNumber}`, e);
        return null;
      }
    }

    const [frontUrl, backUrl] = await Promise.all([
      uploadImage(frontEntry, "front"),
      uploadImage(backEntry, "back"),
    ]);

    res.json({ frontUrl, backUrl });
  } catch (e) {
    logger.error("fetchImages error", e);
    res.status(502).json({ error: "Image fetch failed", detail: String(e) });
  }
});
