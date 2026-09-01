import { GOOGLE_SHEET_CSV_URL } from "./google-sheet-data.ts";

export type ProductName = "Device" | "GIA" | "Postpay" | "TrueOnline";
export type MetricName = "Net" | "Qty";

export type ProductValue = {
  target: number;
  eligible?: boolean;
  daily: number[];
  dailyByDate?: Record<string, number>;
  runrate: number;
  previousActual: number;
  /** Backward-compatible alias for the original August-only dashboard. */
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
    monthKey?: string;
    previousMonth: string;
    asOf: string;
    targetUpdated: string;
    daysInMonth: number;
    currency: string;
    metric: MetricName;
  };
  products: ProductName[];
  branches: Branch[];
};

type MultiMetricBranch = {
  name: string;
  tds: number | null;
  ww: number | null;
  products: Record<ProductName, Partial<Record<MetricName, ProductValue>>>;
};

export type DashboardMonth = {
  meta: Omit<DashboardData["meta"], "metric">;
  branches: MultiMetricBranch[];
  availableMetrics: Record<ProductName, MetricName[]>;
};

export type DashboardDataset = {
  products: ProductName[];
  months: DashboardMonth[];
  latestMonthKey: string;
  latestAsOf: string;
};

export const PRODUCT_NAMES: ProductName[] = ["Device", "GIA", "Postpay", "TrueOnline"];
export const DEFAULT_METRIC_BY_PRODUCT: Record<ProductName, MetricName> = {
  Device: "Net",
  GIA: "Net",
  Postpay: "Net",
  TrueOnline: "Qty",
};

const ENGLISH_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

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

function safeIsoDate(value: string, fallback: string) {
  try {
    return toIsoDate(value);
  } catch {
    return fallback;
  }
}

function monthKeyFromLabel(label: string, asOf: string) {
  const normalized = label.trim().toLocaleLowerCase("en-US");
  const match = normalized.match(/^([a-z]+)\s+(\d{4})$/);
  if (match) {
    const monthIndex = ENGLISH_MONTHS.indexOf(match[1]);
    if (monthIndex >= 0) return `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
  }
  return asOf.slice(0, 7);
}

function previousMonthKey(monthKey: string) {
  const date = new Date(`${monthKey}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function monthLabel(monthKey: string) {
  const date = new Date(`${monthKey}-01T00:00:00Z`);
  const month = ENGLISH_MONTHS[date.getUTCMonth()];
  return `${month[0].toUpperCase()}${month.slice(1)} ${date.getUTCFullYear()}`;
}

function metricFromUnit(unit: string, product: ProductName): MetricName {
  const normalized = unit.trim().toUpperCase();
  if (normalized === "QTY" || normalized === "SUB") return "Qty";
  if (normalized === "THB" || normalized === "NET" || normalized === "NET AMOUNT") return "Net";
  return DEFAULT_METRIC_BY_PRODUCT[product];
}

function emptyProductValue(daysInMonth: number): ProductValue {
  return {
    target: 0,
    eligible: false,
    daily: Array(daysInMonth).fill(0),
    dailyByDate: {},
    runrate: 0,
    previousActual: 0,
    julyActual: 0,
  };
}

export function dashboardDatasetFromCsv(csv: string): DashboardDataset {
  const [headers, ...values] = parseCsv(csv);
  if (!headers || values.length === 0) throw new Error("Google Sheet returned no dashboard rows");

  const column = new Map(headers.map((header, index) => [header.trim(), index]));
  const required = ["Area", "Month", "AsOf", "TargetUpdated", "DaysInMonth", "Product", "BranchName", "TDS", "WW", "Target", "Runrate"];
  for (const header of required) {
    if (!column.has(header)) throw new Error(`Google Sheet is missing column: ${header}`);
  }

  const read = (row: string[], header: string) => row[column.get(header) ?? -1] ?? "";
  const monthRows = new Map<string, string[][]>();
  for (const row of values) {
    const fallbackAsOf = safeIsoDate(read(row, "AsOf"), "2026-08-01");
    const key = monthKeyFromLabel(read(row, "Month"), fallbackAsOf);
    const group = monthRows.get(key) ?? [];
    group.push(row);
    monthRows.set(key, group);
  }

  const months: DashboardMonth[] = [];
  for (const [monthKey, rows] of [...monthRows.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const first = rows[0];
    const fallbackDate = `${monthKey}-01`;
    const daysInMonth = Math.max(1, Math.min(31, Math.round(toNumber(read(first, "DaysInMonth"))) || 31));
    const asOf = safeIsoDate(read(first, "AsOf"), fallbackDate);
    const targetUpdated = safeIsoDate(read(first, "TargetUpdated"), asOf);
    const datedColumns = headers.flatMap((header, index) => {
      const match = header.trim().match(/^(?:Date[_-]?)?(\d{4}-\d{2}-\d{2})$/i);
      return match ? [{ date: match[1], index }] : [];
    });
    const branches = new Map<string, MultiMetricBranch>();
    const available = Object.fromEntries(PRODUCT_NAMES.map((product) => [product, new Set<MetricName>()])) as Record<ProductName, Set<MetricName>>;

    for (const row of rows) {
      const product = read(row, "Product").trim() as ProductName;
      const branchName = read(row, "BranchName").trim();
      if (!PRODUCT_NAMES.includes(product) || !branchName) continue;
      const metric = metricFromUnit(read(row, "Unit"), product);
      available[product].add(metric);

      let branch = branches.get(branchName);
      if (!branch) {
        branch = {
          name: branchName,
          tds: toIdentifier(read(row, "TDS")),
          ww: toIdentifier(read(row, "WW")),
          products: Object.fromEntries(PRODUCT_NAMES.map((name) => [name, {}])) as MultiMetricBranch["products"],
        };
        branches.set(branchName, branch);
      }

      const daily = Array.from({ length: daysInMonth }, (_, index) =>
        toNumber(read(row, `Day${String(index + 1).padStart(2, "0")}`)));
      const dailyByDate: Record<string, number> = Object.fromEntries(
        datedColumns.map(({ date, index }) => [date, toNumber(row[index] ?? "")]),
      );
      for (let index = 0; index < daily.length; index += 1) {
        dailyByDate[`${monthKey}-${String(index + 1).padStart(2, "0")}`] = daily[index];
      }
      const previousActual = column.has("PreviousActual")
        ? toNumber(read(row, "PreviousActual"))
        : column.has("JulyActual")
          ? toNumber(read(row, "JulyActual"))
          : 0;

      const target = toNumber(read(row, "Target"));
      branch.products[product][metric] = {
        target,
        eligible: target > 0,
        runrate: toNumber(read(row, "Runrate")),
        previousActual,
        julyActual: previousActual,
        daily,
        dailyByDate,
      };
    }

    const completeBranches = Array.from(branches.values()).filter((branch) =>
      PRODUCT_NAMES.every((product) => Object.keys(branch.products[product]).length > 0));
    if (completeBranches.length === 0) continue;

    months.push({
      meta: {
        area: read(first, "Area").trim() || "BMAV-Central",
        month: read(first, "Month").trim() || monthLabel(monthKey),
        monthKey,
        previousMonth: monthLabel(previousMonthKey(monthKey)),
        asOf,
        targetUpdated,
        daysInMonth,
        currency: "THB",
      },
      branches: completeBranches,
      availableMetrics: Object.fromEntries(PRODUCT_NAMES.map((product) => [product, [...available[product]]])) as Record<ProductName, MetricName[]>,
    });
  }

  if (months.length === 0) throw new Error("Google Sheet has no complete month data");
  const latest = months[months.length - 1];
  return {
    products: PRODUCT_NAMES,
    months,
    latestMonthKey: latest.meta.monthKey ?? latest.meta.asOf.slice(0, 7),
    latestAsOf: months.reduce((latestDate, month) => month.meta.asOf > latestDate ? month.meta.asOf : latestDate, months[0].meta.asOf),
  };
}

export function dashboardDatasetFromData(data: DashboardData): DashboardDataset {
  const monthKey = data.meta.monthKey ?? data.meta.asOf.slice(0, 7);
  const branches: MultiMetricBranch[] = data.branches.map((branch) => ({
    name: branch.name,
    tds: branch.tds,
    ww: branch.ww,
    products: Object.fromEntries(PRODUCT_NAMES.map((product) => [product, {
      [DEFAULT_METRIC_BY_PRODUCT[product]]: {
        ...branch.products[product],
        eligible: branch.products[product].eligible ?? branch.products[product].target > 0,
        previousActual: branch.products[product].previousActual ?? branch.products[product].julyActual ?? 0,
        julyActual: branch.products[product].julyActual ?? branch.products[product].previousActual ?? 0,
      },
    }])) as MultiMetricBranch["products"],
  }));
  return {
    products: PRODUCT_NAMES,
    latestMonthKey: monthKey,
    latestAsOf: data.meta.asOf,
    months: [{
      meta: {
        ...data.meta,
        monthKey,
        previousMonth: data.meta.previousMonth ?? monthLabel(previousMonthKey(monthKey)),
      },
      branches,
      availableMetrics: Object.fromEntries(PRODUCT_NAMES.map((product) => [product, [DEFAULT_METRIC_BY_PRODUCT[product]]])) as Record<ProductName, MetricName[]>,
    }],
  };
}

export function availableMetricsFor(dataset: DashboardDataset, monthKey: string, product: ProductName) {
  const month = dataset.months.find((item) => item.meta.monthKey === monthKey) ?? dataset.months[dataset.months.length - 1];
  return month.availableMetrics[product].length > 0
    ? month.availableMetrics[product]
    : [DEFAULT_METRIC_BY_PRODUCT[product]];
}

export function selectDashboardData(
  dataset: DashboardDataset,
  monthKey = dataset.latestMonthKey,
  selectedMetric: MetricName = "Net",
  selectedProduct: ProductName = "Device",
): DashboardData {
  const month = dataset.months.find((item) => item.meta.monthKey === monthKey) ?? dataset.months[dataset.months.length - 1];
  const chosenMetric = (product: ProductName) => {
    const options = availableMetricsFor(dataset, month.meta.monthKey ?? monthKey, product);
    const desired = product === selectedProduct ? selectedMetric : DEFAULT_METRIC_BY_PRODUCT[product];
    return options.includes(desired) ? desired : options[0];
  };
  const previousKey = previousMonthKey(month.meta.monthKey ?? monthKey);
  const previous = dataset.months.find((item) => item.meta.monthKey === previousKey);

  const branches: Branch[] = month.branches.map((branch) => ({
    name: branch.name,
    tds: branch.tds,
    ww: branch.ww,
    products: Object.fromEntries(PRODUCT_NAMES.map((product) => {
      const metric = chosenMetric(product);
      const current = branch.products[product][metric] ?? emptyProductValue(month.meta.daysInMonth);
      const eligible = Object.values(branch.products[product]).some((value) => (value?.target ?? 0) > 0);
      const history: Record<string, number> = {};
      for (const historicalMonth of dataset.months) {
        const historicalBranch = historicalMonth.branches.find((item) => item.name === branch.name);
        Object.assign(history, historicalBranch?.products[product][metric]?.dailyByDate ?? {});
      }
      const previousBranch = previous?.branches.find((item) => item.name === branch.name);
      const previousValue = previousBranch?.products[product][metric];
      const computedPreviousActual = previousValue
        ? previousValue.daily.reduce((sum, value) => sum + value, 0)
        : 0;
      const previousActual = current.previousActual > 0 ? current.previousActual : computedPreviousActual;
      return [product, {
        ...current,
        eligible,
        dailyByDate: history,
        previousActual,
        julyActual: previousActual,
      }];
    })) as Record<ProductName, ProductValue>,
  }));

  return {
    meta: {
      ...month.meta,
      metric: chosenMetric(selectedProduct),
    },
    products: PRODUCT_NAMES,
    branches,
  };
}

/** Preserves the legacy single-view parser API used by older tests and callers. */
export function dashboardDataFromCsv(csv: string): DashboardData {
  const dataset = dashboardDatasetFromCsv(csv);
  return selectDashboardData(dataset, dataset.latestMonthKey, "Net", "Device");
}

export async function loadGoogleSheetData(signal?: AbortSignal) {
  const endpoint = `${GOOGLE_SHEET_CSV_URL}&_=${Date.now()}`;
  const response = await fetch(endpoint, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Google Sheet request failed: ${response.status}`);
  return dashboardDatasetFromCsv(await response.text());
}
