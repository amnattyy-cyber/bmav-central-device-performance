import type { MongkolArea, MongkolData, MongkolIndy } from "./mongkol-data";

export const MONGKOL_SHEET_ID = "1HnloV7TpFMWDrHgcCEUTaJKKDz2Zgb8WjQPCSvfn-Ns";
export const MONGKOL_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${MONGKOL_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Indy%20Update`;

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
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function number(value: string) {
  const parsed = Number(value.replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mongkolDataFromCsv(csv: string, fallback: MongkolData): MongkolData {
  const rows = parseCsv(csv);
  const headers = rows[0]?.map((value) => value.replace(/^\uFEFF/, "").trim());
  if (!headers?.length) throw new Error("Google Sheet returned no Indy headers");
  const column = new Map(headers.map((header, index) => [header, index]));
  const required = ["name_eng", "sname_eng", "emp_type_2", "shop_code", "Shop Name", "Shop Type", "Target", "D1"];
  const actualIndex = headers.findIndex((header) => /^Actual\b/i.test(header));
  const missing = required.filter((header) => !column.has(header));
  if (missing.length || actualIndex < 0) throw new Error(`Google Sheet is missing Indy columns: ${[...missing, ...(actualIndex < 0 ? ["Actual"] : [])].join(", ")}`);
  const dayColumns = headers
    .map((header, index) => ({ day: Number(header.match(/^D(\d+)$/i)?.[1]), index }))
    .filter(({ day }) => Number.isInteger(day) && day > 0)
    .sort((a, b) => a.day - b.day);
  const dayCount = dayColumns.length;
  if (!dayCount || dayColumns.some(({ day }, index) => day !== index + 1)) {
    throw new Error("Google Sheet Indy daily columns must be consecutive from D1");
  }

  const indies = rows.slice(1).map((row): MongkolIndy => {
    const get = (header: string) => (row[column.get(header) ?? -1] ?? "").trim();
    const target = number(get("Target"));
    const actual = number(row[actualIndex] ?? "");
    const daily = dayColumns.map(({ index }) => number(row[index] ?? ""));
    return {
      firstName: get("name_eng"),
      lastName: get("sname_eng"),
      employeeType: get("emp_type_2"),
      shopCode: get("shop_code"),
      shopName: get("Shop Name"),
      shopType: get("Shop Type"),
      target,
      daily,
      actual,
      achievement: target > 0 ? actual / target : 0,
    };
  }).filter((indy) => indy.firstName && indy.lastName && indy.shopCode && indy.shopName);

  if (!indies.length) throw new Error("Google Sheet returned no Indy performance rows");
  if (indies.some((indy) => indy.daily.length !== dayCount || Math.abs(indy.actual - indy.daily.reduce((sum, qty) => sum + qty, 0)) > 0.001)) {
    throw new Error(`Google Sheet Indy Actual does not match D1–D${dayCount}`);
  }

  const actualLabel = (headers[actualIndex].replace(/^Actual\s*/i, "").trim() || fallback.meta.actualLabel || "").replace(/-/g, "–");
  const dayMatch = actualLabel.match(/1\s*[–-]\s*(\d{1,2})/);
  const actualDayCount = Math.max(1, Math.min(31, Number(dayMatch?.[1] ?? dayCount)));
  const grouped = new Map<string, MongkolIndy[]>();
  for (const indy of indies) {
    const shop = grouped.get(indy.shopCode) ?? [];
    shop.push(indy);
    grouped.set(indy.shopCode, shop);
  }

  const areas: MongkolArea[] = [...grouped.values()].map((shopIndies) => {
    const target = shopIndies.reduce((sum, indy) => sum + indy.target, 0);
    const actual = shopIndies.reduce((sum, indy) => sum + indy.actual, 0);
    const daily = Array.from({ length: 31 }, (_, day) => day < dayCount ? shopIndies.reduce((sum, indy) => sum + indy.daily[day], 0) : null);
    return {
      area: fallback.meta.area,
      branch: shopIndies[0].shopName,
      target,
      daily,
      actual,
      achievement: target > 0 ? actual / target : 0,
      rrEndMonth: actualDayCount > 0 ? actual / actualDayCount * 31 : 0,
      noSaleCount: shopIndies.filter((indy) => indy.actual === 0).length,
      indyCount: shopIndies.length,
    };
  }).sort((a, b) => a.branch.localeCompare(b.branch, "en"));

  const totalActual = indies.reduce((sum, indy) => sum + indy.actual, 0);
  const noSale = indies.filter((indy) => indy.actual === 0).length;
  const forecastRate = (indy: MongkolIndy) => indy.target > 0 ? indy.actual / actualDayCount * 31 / indy.target : 0;
  const hasSales = indies.filter((indy) => indy.actual > 0);
  const atRisk = hasSales.filter((indy) => forecastRate(indy) < 0.85).length;
  const watch = hasSales.filter((indy) => forecastRate(indy) >= 0.85 && forecastRate(indy) < 1).length;
  const onTrack = hasSales.filter((indy) => forecastRate(indy) >= 1).length;

  return {
    ...fallback,
    meta: { ...fallback.meta, source: MONGKOL_SHEET_CSV_URL, actualLabel },
    areas,
    indies,
    indySummary: { count: indies.length, noSale, atRisk, watch, onTrack },
  };
}

export async function loadMongkolGoogleSheetData(fallback: MongkolData, signal?: AbortSignal) {
  const response = await fetch(`${MONGKOL_SHEET_CSV_URL}&_=${Date.now()}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Google Sheet request failed: ${response.status}`);
  return mongkolDataFromCsv(await response.text(), fallback);
}
