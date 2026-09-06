import type { Branch, DashboardData, ProductName } from "./dashboard-data";

function toUtcDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

function addDays(iso: string, days: number) {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysInCalendarMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function previousMonthKeyOf(monthKey: string) {
  const date = new Date(`${monthKey}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function datesFrom(monthKey: string, days: number) {
  const start = `${monthKey}-01`;
  return Array.from({ length: Math.max(0, days) }, (_, index) => addDays(start, index));
}

function sumMonthPeriod(branches: Branch[], product: ProductName, monthKey: string, days: number) {
  if (days <= 0 || branches.length === 0) return { total: 0, complete: false };
  let total = 0;
  let complete = true;
  const dates = datesFrom(monthKey, days);
  for (const branch of branches) {
    const item = branch.products[product];
    for (const date of dates) {
      const value = item.dailyByDate?.[date];
      if (typeof value !== "number" || !Number.isFinite(value)) complete = false;
      else total += value;
    }
  }
  return { total, complete };
}

/**
 * Compares the current month's actual-to-date against the same number of
 * calendar days at the start of the previous month, using the merged
 * dailyByDate history that selectDashboardData attaches to each branch.
 * Mirrors the equal-days approach calculateWow uses for week comparisons.
 */
export function calculateMomActual(branches: Branch[], product: ProductName, data: DashboardData) {
  const monthKey = data.meta.monthKey ?? data.meta.asOf.slice(0, 7);
  const hasPublishedMonthData = data.meta.asOf.slice(0, 7) === monthKey;
  const usedDays = hasPublishedMonthData ? Number(data.meta.asOf.slice(-2)) : 0;
  const previousMonthKey = previousMonthKeyOf(monthKey);
  const baseDays = Math.min(usedDays, daysInCalendarMonth(previousMonthKey));

  const current = sumMonthPeriod(branches, product, monthKey, usedDays);
  const base = sumMonthPeriod(branches, product, previousMonthKey, baseDays);
  const momActual = usedDays > 0 && baseDays === usedDays && current.complete && base.complete && base.total > 0
    ? current.total / base.total - 1
    : null;

  return {
    usedDays,
    baseDays,
    currentTotal: current.total,
    baseTotal: base.total,
    currentComplete: current.complete,
    baseComplete: base.complete,
    momActual,
    monthKey,
    previousMonthKey,
  };
}

export function momActualTone(value: number | null) {
  if (value === null || value === 0) return "neutral" as const;
  return value > 0 ? "positive" as const : "negative" as const;
}
