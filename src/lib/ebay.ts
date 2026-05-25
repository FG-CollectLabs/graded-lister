import type { PSACert } from "./psa";

// eBay File Exchange v1 CSV for Seller Hub > Listings > Import
// Spec: https://developer.ebay.com/devzone/file-exchange/docs/FlatFileOverview.html

export interface EbayListingRow {
  sku: string;
  title: string;
  categoryId: string;
  price: string;
  quantity: string;
  conditionId: string;
  description: string;
  picUrls: string[];   // up to 12 URLs, pipe-separated in CSV
  shippingProfile: string;
  returnProfile: string;
  paymentProfile: string;
  location: string;
  // PSA-specific item specifics
  gradingService: string;
  grade: string;
  certNumber: string;
  cardName: string;
  set: string;
  year: string;
}

// eBay category IDs for common TCG types — user can override
export const EBAY_CATEGORIES: { label: string; id: string }[] = [
  { label: "Pokemon TCG – Individual Cards", id: "183454" },
  { label: "Magic: The Gathering – Individual Cards", id: "19107" },
  { label: "Sports Cards – Baseball", id: "261328" },
  { label: "Sports Cards – Basketball", id: "261330" },
  { label: "Sports Cards – Football", id: "261329" },
  { label: "Sports Cards – Multi-Sport / Other", id: "261409" },
  { label: "Non-Sport Trading Cards – Graded", id: "99613" },
];

// ConditionID 3000 = Used (standard for graded TCG cards on eBay)
const CONDITION_ID = "3000";

export function buildRow(cert: PSACert, overrides: Partial<EbayListingRow>): EbayListingRow {
  return {
    sku: overrides.sku ?? cert.CertNumber,
    title: overrides.title ?? "",
    categoryId: overrides.categoryId ?? EBAY_CATEGORIES[0]!.id,
    price: overrides.price ?? "",
    quantity: "1",
    conditionId: CONDITION_ID,
    description: overrides.description ?? "",
    picUrls: overrides.picUrls ?? [],
    shippingProfile: overrides.shippingProfile ?? "",
    returnProfile: overrides.returnProfile ?? "",
    paymentProfile: overrides.paymentProfile ?? "",
    location: overrides.location ?? "",
    gradingService: "PSA",
    grade: cert.CardGrade,
    certNumber: cert.CertNumber,
    cardName: cert.Subject,
    set: cert.VarietySet,
    year: cert.Year,
  };
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// First column must contain the site/currency metadata for eBay to recognize the template.
const ACTION_HEADER = "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)";

const HEADERS = [
  ACTION_HEADER,
  "Custom label (SKU)",
  "Category ID",
  "Title",
  "UPC",
  "Price",
  "Quantity",
  "Item photo URL",
  "Condition ID",
  "Description",
  "Format",
  "ShippingProfileName",
  "ReturnProfileName",
  "PaymentProfileName",
  "Location",
  "C:Grading Service",
  "C:Grade",
  "C:Certification Number",
  "C:Card Name",
  "C:Set",
  "C:Year Manufactured",
];

export function generateCsv(rows: EbayListingRow[]): string {
  const lines: string[] = [HEADERS.map(escapeCsv).join(",")];

  for (const row of rows) {
    const cells = [
      "Add",
      row.sku,
      row.categoryId,
      row.title,
      "",                           // UPC — blank for TCG cards
      row.price,
      row.quantity,
      row.picUrls.slice(0, 12).join("|"),  // max 12 images, | separated
      row.conditionId,
      row.description,
      "FixedPrice",
      row.shippingProfile,
      row.returnProfile,
      row.paymentProfile,
      row.location,
      row.gradingService,
      row.grade,
      row.certNumber,
      row.cardName,
      row.set,
      row.year,
    ];
    lines.push(cells.map(escapeCsv).join(","));
  }

  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
