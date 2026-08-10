export type ProductName = "Device" | "GIA" | "Postpay" | "TrueOnline";

export type ProductValue = {
  target: number;
  daily: number[];
  runrate: number;
  julyActual: number;
};

export type Branch = {
  name: string;
  tds: number | null;
  ww: number | null;
  products: Record<ProductName, ProductValue>;
};

export type DashboardData = {
  meta: {
    area: string;
    month: string;
    asOf: string;
    targetUpdated: string;
    daysInMonth: number;
    currency: string;
  };
  products: ProductName[];
  branches: Branch[];
};

export const GOOGLE_SHEET_ID = "1UTvefrVV2fuCS07_dAxvsp2NLAtMumQumyw8gvbMl4w";
export const GOOGLE_SHEET_TAB = "Dashboard_Data";
export const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit`;
export const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRL3jDKCZEI0VJuYlPlRZCkTqH4tBwEQoSkcfQGmXzMs0SgbDCqrkdukhk2Gko9DoW9zwyE7hUs-h0w/pub?gid=54305357&single=true&output=csv";

const PRODUCT_NAMES: ProductName[] = ["Device", "GIA", "Postpay", "TrueOnline"];

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
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIdentifier(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toIsoDate(value: string) {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) throw new Error(`Invalid date from Google Sheet: ${value}`);
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function dashboardDataFromCsv(csv: string): DashboardData {
  const [headers, ...values] = parseCsv(csv);
  if (!headers || values.length === 0) throw new Error("Google Sheet returned no dashboard rows");

  const column = new Map(headers.map((header, index) => [header.trim(), index]));
  const required = ["Area", "Month", "AsOf", "TargetUpdated", "DaysInMonth", "Product", "BranchName", "TDS", "WW", "Target", "Runrate"];
  for (const header of required) {
    if (!column.has(header)) throw new Error(`Google Sheet is missing column: ${header}`);
  }

  const read = (row: string[], header: string) => row[column.get(header) ?? -1] ?? "";
  const first = values[0];
  const daysInMonth = Math.max(1, Math.min(31, Math.round(toNumber(read(first, "DaysInMonth")))));
  const branches = new Map<string, Branch>();

  for (const row of values) {
    const product = read(row, "Product").trim() as ProductName;
    const branchName = read(row, "BranchName").trim();
    if (!PRODUCT_NAMES.includes(product) || !branchName) continue;

    let branch = branches.get(branchName);
    if (!branch) {
      branch = {
        name: branchName,
        tds: toIdentifier(read(row, "TDS")),
        ww: toIdentifier(read(row, "WW")),
        products: {} as Record<ProductName, ProductValue>,
      };
      branches.set(branchName, branch);
    }

    branch.products[product] = {
      target: toNumber(read(row, "Target")),
      runrate: toNumber(read(row, "Runrate")),
      julyActual: column.has("JulyActual") ? toNumber(read(row, "JulyActual")) : 0,
      daily: Array.from({ length: daysInMonth }, (_, index) =>
        toNumber(read(row, `Day${String(index + 1).padStart(2, "0")}`))),
    };
  }

  const completeBranches = Array.from(branches.values()).filter((branch) =>
    PRODUCT_NAMES.every((product) => branch.products[product]));
  if (completeBranches.length === 0) throw new Error("Google Sheet has no complete branch data");

  return {
    meta: {
      area: read(first, "Area").trim() || "BMAV-Central",
      month: read(first, "Month").trim(),
      asOf: toIsoDate(read(first, "AsOf")),
      targetUpdated: toIsoDate(read(first, "TargetUpdated")),
      daysInMonth,
      currency: "THB",
    },
    products: PRODUCT_NAMES,
    branches: completeBranches,
  };
}

export async function loadGoogleSheetData(signal?: AbortSignal) {
  const endpoint = `${GOOGLE_SHEET_CSV_URL}&_=${Date.now()}`;
  const response = await fetch(endpoint, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Google Sheet request failed: ${response.status}`);
  return dashboardDataFromCsv(await response.text());
}
