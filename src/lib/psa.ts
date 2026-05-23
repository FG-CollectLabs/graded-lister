// PSA cert data as returned by our homelab backend proxy to api.psacard.com/publicapi
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

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "";
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string;

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${API_TOKEN}` };
}

export async function lookupCert(certNumber: string): Promise<PSACert> {
  const res = await fetch(`${API_BASE}/v1/cert/${encodeURIComponent(certNumber.trim())}`, {
    headers: authHeaders(),
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
): Promise<{ frontUrl: string | null; backUrl: string | null }> {
  const res = await fetch(`${API_BASE}/v1/cert/${encodeURIComponent(certNumber)}/images`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image fetch failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ frontUrl: string | null; backUrl: string | null }>;
}

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
    const trimmed = [cert.Year, cert.Brand, cert.Subject, cert.CardNumber ? `#${cert.CardNumber}` : "", `PSA ${cert.CardGrade}`]
      .filter(Boolean)
      .join(" ");
    title = trimmed.length <= 80 ? trimmed : trimmed.slice(0, 80);
  }
  return title;
}

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
