import focusSales from "./focus-device-sales.json";
import { GOOGLE_SHEET_ID, GOOGLE_SHEET_URL, type DashboardData } from "./google-sheet-data";

export type FocusDeviceBranch = {
  name: string;
  tds: number | null;
  ww: number | null;
  dailyTarget: number;
  daily: Array<number | null>;
};

export type FocusDeviceData = {
  meta: {
    area: string;
    month: string;
    asOf: string;
    daysInMonth: number;
    model: string;
  };
  branches: FocusDeviceBranch[];
};

export const FOCUS_DEVICE_SHEET_URL = GOOGLE_SHEET_URL;
export const FOCUS_DEVICE_SHEET_TAB = "Focus_Device";
export const FOCUS_DEVICE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Focus_Device&range=A4:K531`;

const SPECIAL_TARGET_BRANCHES = new Set([
  "True Shop Central Rama 9 4Fl.",
  "True Shop Central World 4Fl.",
]);

const EXCLUDED_TARGET_BRANCHES = new Set([
  "True Kiosk The Eight Thonglor",
  "True Shop U Chu Liang Building",
]);

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

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  return toNumber(value);
}

function toIdentifier(value: string) {
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toIsoDate(value: string) {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) throw new Error(`Invalid Focus Device date: ${value}`);
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function focusDeviceDataFromCsv(csv: string): FocusDeviceData {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex((row) => row.includes("BranchName") && row.includes("ActualQTY"));
  if (headerIndex < 0) throw new Error("Google Sheet is missing Focus Device headers");

  const headers = rows[headerIndex];
  const values = rows.slice(headerIndex + 1);
  const column = new Map(headers.map((header, index) => [header.trim(), index]));
  const required = ["Area", "Month", "AsOf", "Date", "BranchName", "TDS", "WW", "Model", "ActualQTY", "DailyTarget"];
  for (const header of required) {
    if (!column.has(header)) throw new Error(`Focus Device Sheet is missing column: ${header}`);
  }

  const read = (row: string[], header: string) => row[column.get(header) ?? -1] ?? "";
  const first = values.find((row) => read(row, "BranchName").trim());
  if (!first) throw new Error("Focus Device Sheet returned no branch rows");

  const branches = new Map<string, FocusDeviceBranch>();
  for (const row of values) {
    const branchName = read(row, "BranchName").trim();
    if (!branchName) continue;
    const date = toIsoDate(read(row, "Date"));
    const day = Number(date.slice(-2));
    if (day < 1 || day > 31) continue;

    let branch = branches.get(branchName);
    if (!branch) {
      branch = {
        name: branchName,
        tds: toIdentifier(read(row, "TDS")),
        ww: toIdentifier(read(row, "WW")),
        dailyTarget: toNumber(read(row, "DailyTarget")),
        daily: Array.from({ length: 31 }, () => null),
      };
      branches.set(branchName, branch);
    }
    branch.daily[day - 1] = toNullableNumber(read(row, "ActualQTY"));
  }

  return {
    meta: {
      area: read(first, "Area").trim() || "BMAV-Central",
      month: read(first, "Month").trim() || "August 2026",
      asOf: toIsoDate(read(first, "AsOf")),
      daysInMonth: 31,
      model: read(first, "Model").trim() || "Honor X5C Plus",
    },
    branches: Array.from(branches.values()),
  };
}

export function createFocusDeviceFallback(data: DashboardData): FocusDeviceData {
  const sales = new Map<string, number>();
  for (const entry of focusSales.sales) sales.set(`${entry.day}|${entry.branch}`, entry.qty);
  const asOfDay = Number(focusSales.asOf.slice(-2));

  return {
    meta: {
      area: data.meta.area,
      month: data.meta.month,
      asOf: focusSales.asOf,
      daysInMonth: data.meta.daysInMonth,
      model: focusSales.model,
    },
    branches: data.branches.map((branch) => ({
      name: branch.name,
      tds: branch.tds,
      ww: branch.ww,
      dailyTarget: EXCLUDED_TARGET_BRANCHES.has(branch.name)
        ? 0
        : SPECIAL_TARGET_BRANCHES.has(branch.name) ? 3 : 1,
      daily: Array.from({ length: data.meta.daysInMonth }, (_, index) =>
        index < asOfDay ? sales.get(`${index + 1}|${branch.name}`) ?? 0 : null),
    })),
  };
}

export async function loadFocusDeviceData(signal?: AbortSignal) {
  const endpoint = `${FOCUS_DEVICE_SHEET_CSV_URL}&_=${Date.now()}`;
  const response = await fetch(endpoint, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Focus Device Sheet request failed: ${response.status}`);
  return focusDeviceDataFromCsv(await response.text());
}
