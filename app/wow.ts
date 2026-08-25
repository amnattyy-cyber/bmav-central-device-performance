import type { Branch, DashboardData, ProductName, ProductValue } from "./google-sheet-data";

export type WowWeek = {
  id: "W32" | "W33" | "W34" | "W35" | "W36";
  label: string;
  start: string;
  end: string;
  baseStart: string;
  baseEnd: string;
};

export const WOW_WEEKS: WowWeek[] = [
  { id: "W32", label: "Week 32", start: "2026-08-03", end: "2026-08-09", baseStart: "2026-07-27", baseEnd: "2026-08-02" },
  { id: "W33", label: "Week 33", start: "2026-08-10", end: "2026-08-16", baseStart: "2026-08-03", baseEnd: "2026-08-09" },
  { id: "W34", label: "Week 34", start: "2026-08-17", end: "2026-08-23", baseStart: "2026-08-10", baseEnd: "2026-08-16" },
  { id: "W35", label: "Week 35", start: "2026-08-24", end: "2026-08-30", baseStart: "2026-08-17", baseEnd: "2026-08-23" },
  { id: "W36", label: "Week 36", start: "2026-08-31", end: "2026-09-06", baseStart: "2026-08-24", baseEnd: "2026-08-30" },
];

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function toUtcDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number) {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inclusiveDays(start: string, end: string) {
  return Math.floor((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / 86_400_000) + 1;
}

function datesBetween(start: string, days: number) {
  return Array.from({ length: Math.max(0, days) }, (_, index) => addDays(start, index));
}

export function formatWowRange(start: string, end: string) {
  const first = toUtcDate(start);
  const last = toUtcDate(end);
  const firstDay = first.getUTCDate();
  const lastDay = last.getUTCDate();
  const firstMonth = THAI_MONTHS[first.getUTCMonth()];
  const lastMonth = THAI_MONTHS[last.getUTCMonth()];
  return first.getUTCMonth() === last.getUTCMonth()
    ? `${firstDay}–${lastDay} ${lastMonth}`
    : `${firstDay} ${firstMonth}–${lastDay} ${lastMonth}`;
}

export function findDefaultWowWeek(asOf: string) {
  return WOW_WEEKS.find((week) => asOf >= week.start && asOf <= week.end)
    ?? [...WOW_WEEKS].reverse().find((week) => asOf >= week.start)
    ?? WOW_WEEKS[0];
}

export function getWowWindow(week: WowWeek, asOf: string) {
  const usedDays = asOf < week.start ? 0 : Math.min(7, inclusiveDays(week.start, asOf));
  const currentEnd = usedDays > 0 ? addDays(week.start, usedDays - 1) : week.end;
  const baseEnd = usedDays > 0 ? addDays(week.baseStart, usedDays - 1) : week.baseEnd;
  return {
    usedDays,
    currentStart: week.start,
    currentEnd,
    baseStart: week.baseStart,
    baseEnd,
    isCompleteWeek: usedDays === 7,
    isWaiting: usedDays === 0,
  };
}

function valueForDate(item: ProductValue, data: DashboardData, iso: string) {
  if (iso > data.meta.asOf) return null;
  if (item.dailyByDate && Object.prototype.hasOwnProperty.call(item.dailyByDate, iso)) {
    return item.dailyByDate[iso];
  }
  if (iso.slice(0, 7) !== data.meta.asOf.slice(0, 7)) return null;
  const day = Number(iso.slice(-2));
  const value = item.daily[day - 1];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumPeriod(branches: Branch[], product: ProductName, data: DashboardData, start: string, days: number) {
  if (days <= 0 || branches.length === 0) return { total: 0, complete: false };
  let total = 0;
  let complete = true;
  for (const branch of branches) {
    const item = branch.products[product];
    for (const date of datesBetween(start, days)) {
      const value = valueForDate(item, data, date);
      if (value === null) complete = false;
      else total += value;
    }
  }
  return { total, complete };
}

export function calculateWow(branches: Branch[], product: ProductName, data: DashboardData, week: WowWeek) {
  const window = getWowWindow(week, data.meta.asOf);
  const current = sumPeriod(branches, product, data, window.currentStart, window.usedDays);
  const base = sumPeriod(branches, product, data, window.baseStart, window.usedDays);
  const wow = window.usedDays > 0 && current.complete && base.complete && base.total > 0
    ? current.total / base.total - 1
    : null;
  return {
    ...window,
    currentTotal: current.total,
    baseTotal: base.total,
    currentComplete: current.complete,
    baseComplete: base.complete,
    wow,
  };
}

export function wowTone(value: number | null) {
  if (value === null || value === 0) return "neutral" as const;
  return value > 0 ? "positive" as const : "negative" as const;
}


