// PSA cert data as returned by our Firebase Function proxy to api.psacard.com/publicapi
// Field names match PSA's documented public API response.
export interface PSAImage {
  IsFront: boolean;
  ImageURL: string;
}

export interface PSACert {
  CertNumber: string;
  SpecNumber: string;
  Year: string;
  Brand: string;
  Subject: string;
  CardNumber: string;
  VarietySet: string;
  GradeDescription: string;
  CardGrade: string;
  CertType: string;
  IsDualCert: boolean;
  PSAImages: PSAImage[];
}

export interface CertLookupResult {
  cert: PSACert;
  frontStorageUrl: string | null;
  backStorageUrl: string | null;
}

const FUNCTIONS_BASE = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string) ?? "";

export async function lookupCert(certNumber: string, idToken: string): Promise<PSACert> {
  const url = `${FUNCTIONS_BASE}/lookupCert?cert=${encodeURIComponent(certNumber.trim())}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PSA lookup failed (${res.status}): ${text}`);
  }
  const data = await res.json() as { PSACert: PSACert };
  return data.PSACert;
}

export async function fetchAndStoreImages(
  certNumber: string,
  idToken: string,
): Promise<{ frontUrl: string | null; backUrl: string | null }> {
  const url = `${FUNCTIONS_BASE}/fetchImages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ certNumber }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image fetch failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ frontUrl: string | null; backUrl: string | null }>;
}

// Build a suggested eBay title from PSA cert data (80-char eBay limit)
export function buildTitle(cert: PSACert): string {
  const parts = [
    cert.Year,
    cert.Brand,
    cert.VarietySet,
    cert.Subject,
    cert.CardNumber ? `#${cert.CardNumber}` : "",
    `PSA ${cert.CardGrade}`,
  ].filter(Boolean);

  let title = parts.join(" ");
  if (title.length > 80) {
    // Drop set name first to trim
    const trimmed = [cert.Year, cert.Brand, cert.Subject, cert.CardNumber ? `#${cert.CardNumber}` : "", `PSA ${cert.CardGrade}`]
      .filter(Boolean)
      .join(" ");
    title = trimmed.length <= 80 ? trimmed : trimmed.slice(0, 80);
  }
  return title;
}

// Build a plain-text description block for eBay
export function buildDescription(cert: PSACert): string {
  return [
    `${cert.Brand} ${cert.Subject}`,
    `Set: ${cert.VarietySet}`,
    cert.CardNumber ? `Card #: ${cert.CardNumber}` : "",
    `Year: ${cert.Year}`,
    `Grade: PSA ${cert.CardGrade} (${cert.GradeDescription})`,
    `PSA Cert #: ${cert.CertNumber}`,
    "",
    "Verify at: psacard.com/cert/" + cert.CertNumber,
    "",
    "Ships in rigid card holder inside bubble mailer. Combined shipping available.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}
