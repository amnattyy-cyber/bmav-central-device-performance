import type { ProductName } from "./google-sheet-data";

export type PersonPerformance = {
  name: string;
  position: string;
  shopName: string;
  area: string;
  target: number;
  actual: number;
  actualRunrate: number;
  runrateAchievement: number;
  tenure: string;
  id: string;
};

export type PersonPerformanceData = {
  meta: { product: string; asOf: string; area: string; source: string };
  people: PersonPerformance[];
};

export const PERSON_PERFORMANCE_SHEET_ID = "1F6pHFgsF3soHf7NJkgxQ_fKUU-ccQ2jIekmhgydPxv0";
export const PERSON_PERFORMANCE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${PERSON_PERFORMANCE_SHEET_ID}/edit`;
export const PERSON_CSV_URLS: Record<ProductName, string> = {
  Device: `https://docs.google.com/spreadsheets/d/${PERSON_PERFORMANCE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Dev_People`,
  GIA: `https://docs.google.com/spreadsheets/d/${PERSON_PERFORMANCE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=GIA_People`,
  Postpay: `https://docs.google.com/spreadsheets/d/${PERSON_PERFORMANCE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Postpay_People`,
  TrueOnline: `https://docs.google.com/spreadsheets/d/${PERSON_PERFORMANCE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=TOL_People`,
};
const PERSON_PRODUCTS: ProductName[] = ["Device", "GIA", "Postpay", "TrueOnline"];
const PERSON_UNIT: Record<ProductName, "Amount" | "QTY"> = {
  Device: "Amount",
  GIA: "Amount",
  Postpay: "Amount",
  TrueOnline: "QTY",
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function toNumber(value: string) {
  const parsed = Number(value.replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value: string) {
  const normalized = value.trim();
  const isoPrefix = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:\s|T|$)/);
  if (isoPrefix) return isoPrefix[1];
  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeShop(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ").replace(/^True Kiosk /, "Kiosk ");
  const aliases: Record<string, string> = {
    "True Shop (dtac) Supreme Complex Samsen": "True Shop Supreme Complex (D)",
    "True Shop Lotus's Ramindra": "Kiosk Lotus's Ramindra",
    "True Shop Central World Fl.4": "True Shop Central World 4Fl.",
  };
  return aliases[normalized] ?? normalized;
}

function isActive(value: string) {
  const normalized = value.trim().toLowerCase();
  return !["", "false", "0", "no", "inactive"].includes(normalized);
}

export function personPerformanceFromCsv(csv: string, product: ProductName): PersonPerformanceData {
  const expectedUnit = PERSON_UNIT[product];
  const rows = parseCsv(csv).filter((row) =>
    toIsoDate(row[0] ?? "")
    && row[1]?.trim() === product
    && row[7]?.trim().toUpperCase() === expectedUnit.toUpperCase());
  if (!rows.length) throw new Error(`Google Sheet returned no ${product} person rows`);

  const asOf = rows.reduce((latest, row) => {
    const date = toIsoDate(row[0]);
    return date > latest ? date : latest;
  }, "");
  const latestRows = rows.filter((row) => toIsoDate(row[0]) === asOf && isActive(row[14] ?? ""));
  const area = latestRows.find((row) => row[6]?.trim())?.[6].trim() || "BMA V - Central";

  const people = latestRows.map((row) => {
    const target = toNumber(row[8] ?? "");
    const actualRunrate = toNumber(row[10] ?? "");
    return {
      id: (row[2] ?? "").trim(),
      name: (row[3] ?? "").trim(),
      position: (row[4] ?? "").trim(),
      shopName: normalizeShop(row[5] ?? ""),
      area,
      target,
      actual: toNumber(row[9] ?? ""),
      actualRunrate,
      runrateAchievement: target > 0 ? actualRunrate / target : 0,
      tenure: (row[12] ?? "").trim(),
    };
  }).filter((person) => person.name && person.shopName)
    .sort((a, b) => b.runrateAchievement - a.runrateAchievement || b.actualRunrate - a.actualRunrate || a.name.localeCompare(b.name, "th"));

  if (!people.length) throw new Error(`Google Sheet returned no active ${product} people`);
  return { meta: { product, asOf, area, source: PERSON_CSV_URLS[product] }, people };
}

async function loadProduct(product: ProductName, signal?: AbortSignal) {
  const endpoint = `${PERSON_CSV_URLS[product]}&_=${Date.now()}`;
  const response = await fetch(endpoint, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Google Sheet ${product} request failed: ${response.status}`);
  return personPerformanceFromCsv(await response.text(), product);
}

export async function loadGooglePersonPerformance(signal?: AbortSignal): Promise<Record<ProductName, PersonPerformanceData>> {
  const entries = await Promise.all(PERSON_PRODUCTS.map(async (product) => [product, await loadProduct(product, signal)] as const));
  return Object.fromEntries(entries) as Record<ProductName, PersonPerformanceData>;
}
