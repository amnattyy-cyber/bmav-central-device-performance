"use client";

import { useEffect, useMemo, useState } from "react";
import fallbackData from "./sales-product-data.json";
import postpayPersonData from "./postpay-person-performance.json";
import tolPersonData from "./tol-person-performance.json";
import { type Branch, type DashboardData, loadGoogleSheetData, type ProductName } from "./google-sheet-data";
import { loadGooglePersonPerformance, PERSON_PERFORMANCE_SHEET_URL, type PersonPerformanceData } from "./google-person-data";
import { createFocusDeviceFallback, FOCUS_DEVICE_SHEET_URL, loadFocusDeviceData, type FocusDeviceData } from "./focus-device-data";
import { downloadExcelWorkbook, type ExcelSheet } from "./excel-export";
import { calculateWow, findDefaultWowWeek, formatWowRange, WOW_WEEKS, wowTone } from "./wow";

const ALL_BRANCHES = "�ء�Ң�";
const ALL_DAYS = "all";
const fallbackPersonDataByProduct: Partial<Record<ProductName, PersonPerformanceData>> = {
  Postpay: postpayPersonData as PersonPerformanceData,
  TrueOnline: tolPersonData as PersonPerformanceData,
};
const fallbackFocusDeviceData = createFocusDeviceFallback(fallbackData as DashboardData);
const productMeta: Record<ProductName, { color: string; accent: string; short: string }> = {
  Device: { color: "#2563eb", accent: "#dbeafe", short: "DEV" },
  GIA: { color: "#8e44ad", accent: "#f3e8ff", short: "GIA" },
  Postpay: { color: "#f59e0b", accent: "#fef3c7", short: "POST" },
  TrueOnline: { color: "#00a8e8", accent: "#cffafe", short: "TOL" },
};

const executiveFocus: Record<ProductName, { title: string; description: string; action: string }> = {
  Device: {
    title: "�����Ť���ʹ�����лԴ Gap ����Ң�",
    description: "�Դ�����Ť���ʹ�����º Target ����ѹ ������Ѻ�ҡ�á�Шء��Ǣͧ�ʹ��Ңҹ�",
    action: "����Ңҷ���ӡ���Ἱ��觴����Ť���٧ ��з��ǹ�ʹ�Դ�ء�ѹ",
  },
  GIA: {
    title: "¡�дѺ�����������ͧ͢�ʹ GIA",
    description: "⿡�ʤ���������º Target MTD ��Ф���������ͧ�ͧ�ŧҹ�����ҧ�Ң�",
    action: "��˹���һԴ GIA ����ѹ����Ңҷ���ӡ���Ἱ ��еԴ�����������Ң�",
  },
  Postpay: {
    title: "����ʹ�Դ Postpay ���ѹ Runrate",
    description: "�Ѵ�ʹ������Шѧ��С�ûԴ����ѹ ���������ʹ�ҡ Product ���",
    action: "����Ңҷ�� ACH MTD ��ӡ��� 85% ��еԴ����ʹ�Դ Postpay ����ѹ",
  },
  TrueOnline: {
    title: "�����ӹǹ�Դ TOL ���� QTY",
    description: "�ء����Ţ���������繨ӹǹ QTY ������������áԨ�Դ�ҹ���Ѵਹ",
    action: "��˹� QTY ����ͧ�Դ����ѹ ���⿡���Ңҷ��������ʹ������ͧ",
  },
};

const money = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const momPercent = (value: number | null) => value === null ? "N/A" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const momTone = (value: number | null) => value === null ? "neutral" : value >= 0 ? "positive" : "negative";
const shortShop = (name: string) => name
  .replace("True Shop Station ", "Station ")
  .replace("True Shop at ", "")
  .replace("True Shop ", "")
  .replace("True Kiosk ", "Kiosk ");

function status(pace: number) {
  if (pace >= 1) return { key: "ontrack", label: "On Track" };
  if (pace >= 0.85) return { key: "watch", label: "Watch" };
  return { key: "atrisk", label: "At Risk" };
}

export default function Home() {
  const [data, setData] = useState<DashboardData>(fallbackData as DashboardData);
  const [syncSource, setSyncSource] = useState<"sheet" | "fallback">("fallback");
  const [personDataByProduct, setPersonDataByProduct] = useState(fallbackPersonDataByProduct);
  const [peopleSyncSource, setPeopleSyncSource] = useState<"sheet" | "fallback">("fallback");
  const [focusData, setFocusData] = useState<FocusDeviceData>(fallbackFocusDeviceData);
  const [focusSyncSource, setFocusSyncSource] = useState<"sheet" | "fallback">("fallback");
  const [product, setProduct] = useState<ProductName>("Device");
  const [selectedBranchNames, setSelectedBranchNames] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState(ALL_DAYS);
  const [weekFilter, setWeekFilter] = useState("auto");
  const [captureMode, setCaptureMode] = useState(false);
  const [focusCaptureMode, setFocusCaptureMode] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
  const [positionFilters, setPositionFilters] = useState<string[]>([]);
  const [showNoSales, setShowNoSales] = useState(false);
  const productNames = data.products;
  const branches = data.branches as Branch[];
  const asOfDay = Number(data.meta.asOf.slice(-2));
  const asOfDate = new Date(`${data.meta.asOf}T00:00:00+07:00`);
  const shortMonth = asOfDate.toLocaleDateString("en-GB", { month: "short" });
  const monthYear = data.meta.month;
  const selectedDay = dateFilter === ALL_DAYS ? null : Number(dateFilter);
  const periodDay = selectedDay ?? asOfDay;
  const periodDays = selectedDay === null ? asOfDay : 1;
  const isDailyView = selectedDay !== null;
  const theme = productMeta[product];
  const isQtyProduct = product === "TrueOnline";
  const wowUnit = isQtyProduct ? "Qty" : "Net";
  const defaultWowWeek = findDefaultWowWeek(data.meta.asOf);
  const selectedWowWeek = weekFilter === "auto"
    ? defaultWowWeek
    : WOW_WEEKS.find((week) => week.id === weekFilter) ?? defaultWowWeek;
  const displayValue = (value: number) => `${money(value)}${isQtyProduct ? " QTY" : ""}`;
  const personData = personDataByProduct[product];
  const productPeople = personData?.people ?? [];
  const personAsOf = personData?.meta.asOf ?? data.meta.asOf;
  const personAsOfDate = new Date(`${personAsOf}T00:00:00+07:00`);
  const personAsOfDisplay = personAsOfDate.toLocaleDateString("en-GB");
  const personAsOfShort = personAsOfDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const personValue = (value: number) => `${money(value)}${isQtyProduct ? " QTY" : ""}`;
  const focusAsOfDay = Number(focusData.meta.asOf.slice(-2));
  const focusPeriodDay = selectedDay ?? focusAsOfDay;
  const focusPeriodDays = selectedDay === null ? focusAsOfDay : 1;

  const targetedBranches = useMemo(
    () => branches.filter((branch) => branch.products[product].target > 0),
    [branches, product],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const sync = async () => {
      try {
        const nextData = await loadGoogleSheetData(controller.signal);
        if (nextData.meta.asOf < (fallbackData as DashboardData).meta.asOf) {
          throw new Error("Google Sheet data is older than the bundled dashboard update");
        }
        if (active) {
          setData(nextData);
          setSyncSource("sheet");
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Google Sheet sync unavailable; using bundled dashboard data.", error);
          setSyncSource("fallback");
        }
      }
    };

    void sync();
    const interval = window.setInterval(sync, 5 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const syncFocusDevice = async () => {
      try {
        const nextData = await loadFocusDeviceData(controller.signal);
        if (nextData.meta.asOf < fallbackFocusDeviceData.meta.asOf) {
          throw new Error("Focus Device Sheet data is older than the bundled update");
        }
        if (active) {
          setFocusData(nextData);
          setFocusSyncSource("sheet");
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Focus Device Sheet sync unavailable; using bundled focus data.", error);
          setFocusSyncSource("fallback");
        }
      }
    };

    void syncFocusDevice();
    const interval = window.setInterval(syncFocusDevice, 5 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncFocusDevice();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const syncPeople = async () => {
      try {
        const nextData = await loadGooglePersonPerformance(controller.signal);
        for (const productName of ["Postpay", "TrueOnline"] as const) {
          const next = nextData[productName];
          const bundled = fallbackPersonDataByProduct[productName];
          if (!next || (bundled && next.meta.asOf < bundled.meta.asOf)) {
            throw new Error(`Google Sheet ${productName} data is older than the bundled update`);
          }
        }
        if (active) {
          setPersonDataByProduct(nextData);
          setPeopleSyncSource("sheet");
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Google Sheet person sync unavailable; using bundled person data.", error);
          setPeopleSyncSource("fallback");
        }
      }
    };

    void syncPeople();
    const interval = window.setInterval(syncPeople, 5 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncPeople();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    setSelectedBranchNames((current) => {
      const available = new Set(targetedBranches.map((branch) => branch.name));
      const next = current.filter((name) => available.has(name));
      return next.length === current.length ? current : next;
    });
  }, [targetedBranches]);

  useEffect(() => {
    setPersonSearch("");
    setPositionFilters([]);
    setShowNoSales(false);
  }, [product]);

  const selectedBranches = useMemo(
    () => selectedBranchNames.length === 0
      ? targetedBranches
      : targetedBranches.filter((branch) => selectedBranchNames.includes(branch.name)),
    [selectedBranchNames, targetedBranches],
  );

  const metrics = useMemo(() => {
    const target = selectedBranches.reduce((sum, branch) => sum + branch.products[product].target, 0);
    const daily = Array.from({ length: data.meta.daysInMonth }, (_, index) =>
      selectedBranches.reduce((sum, branch) => sum + (branch.products[product].daily[index] ?? 0), 0));
    const mtd = isDailyView
      ? daily[periodDay - 1] ?? 0
      : daily.slice(0, asOfDay).reduce((sum, value) => sum + value, 0);
    const today = daily[periodDay - 1] ?? 0;
    const targetMtd = target * periodDays / data.meta.daysInMonth;
    const pace = targetMtd > 0 ? mtd / targetMtd : 0;
    const forecast = periodDays > 0 ? mtd / periodDays * data.meta.daysInMonth : 0;
    const achievement = target > 0 ? mtd / target : 0;
    const runrate = selectedBranches.reduce((sum, branch) => sum + branch.products[product].runrate, 0);
    const runrateAchievement = target > 0 ? runrate / target : 0;
    const julyActual = selectedBranches.reduce((sum, branch) => sum + branch.products[product].julyActual, 0);
    const mom = julyActual > 0 ? runrate / julyActual - 1 : null;
    return { target, daily, mtd, today, targetMtd, pace, forecast, achievement, runrate, runrateAchievement, julyActual, mom, dailyTarget: target / data.meta.daysInMonth };
  }, [selectedBranches, product, isDailyView, periodDay, periodDays]);

  const wowMetrics = useMemo(
    () => calculateWow(selectedBranches, product, data, selectedWowWeek),
    [selectedBranches, product, data, selectedWowWeek],
  );
  const wowCurrentRange = formatWowRange(wowMetrics.currentStart, wowMetrics.currentEnd);
  const wowBaseRange = formatWowRange(wowMetrics.baseStart, wowMetrics.baseEnd);
  const wowStatusText = wowMetrics.isWaiting
    ? "�͢����Ţͧ�ѻ������"
    : wowMetrics.isCompleteWeek
      ? "�����Ťú 7 �ѹ"
      : `�������ѧ���ú � �� ${wowMetrics.usedDays}/7 �ѹ`;
  const wowAvailabilityText = !wowMetrics.baseComplete
    ? "����բ����Űҹ���º��º�ú�ء�ѹ"
    : wowMetrics.baseTotal <= 0
      ? "�ҹ���º��º�� 0 �֧���ӹǳ�����繵�"
      : `���º��º�ӹǹ�ѹ��ҡѹ ${wowMetrics.usedDays} �ѹ`;

  const branchPerformance = useMemo(() => targetedBranches.map((branch) => {
    const item = branch.products[product];
    const mtd = isDailyView
      ? item.daily[periodDay - 1] ?? 0
      : item.daily.slice(0, asOfDay).reduce((sum, value) => sum + value, 0);
    const targetMtd = item.target * periodDays / data.meta.daysInMonth;
    const pace = targetMtd > 0 ? mtd / targetMtd : 0;
    const forecast = periodDays > 0 ? mtd / periodDays * data.meta.daysInMonth : 0;
    const runrateAchievement = item.target > 0 ? item.runrate / item.target : 0;
    const mom = item.julyActual > 0 ? item.runrate / item.julyActual - 1 : null;
    const branchWow = calculateWow([branch], product, data, selectedWowWeek);
    return { ...branch, target: item.target, mtd, targetMtd, pace, forecast, runrate: item.runrate, runrateAchievement, julyActual: item.julyActual, mom, wow: branchWow.wow, wowCurrent: branchWow.currentTotal, wowBase: branchWow.baseTotal, today: item.daily[periodDay - 1] ?? 0 };
  }).filter((branch) => selectedBranchNames.length === 0 || selectedBranchNames.includes(branch.name))
    .sort((a, b) => b.pace - a.pace), [targetedBranches, product, data, selectedWowWeek, selectedBranchNames, isDailyView, periodDay, periodDays]);

  const focusBranchPerformance = useMemo(() => focusData.branches
    .filter((branch) => branch.dailyTarget > 0)
    .filter((branch) => selectedBranchNames.length === 0 || selectedBranchNames.includes(branch.name))
    .map((branch) => {
      const actual = selectedDay === null
        ? branch.daily.slice(0, focusAsOfDay).reduce<number>((sum, value) => sum + (value ?? 0), 0)
        : branch.daily[focusPeriodDay - 1] ?? 0;
      const target = branch.dailyTarget * focusPeriodDays;
      const achievement = target > 0 ? actual / target : 0;
      const activeDays = selectedDay === null
        ? branch.daily.slice(0, focusAsOfDay).filter((value) => (value ?? 0) > 0).length
        : actual > 0 ? 1 : 0;
      return { ...branch, actual, target, achievement, gap: Math.max(0, target - actual), activeDays };
    })
    .sort((a, b) => b.actual - a.actual || b.dailyTarget - a.dailyTarget || a.name.localeCompare(b.name)),
  [focusData, selectedBranchNames, selectedDay, focusAsOfDay, focusPeriodDay, focusPeriodDays]);

  const focusMetrics = useMemo(() => {
    const total = focusBranchPerformance.reduce((sum, branch) => ({
      actual: sum.actual + branch.actual,
      target: sum.target + branch.target,
      dailyTarget: sum.dailyTarget + branch.dailyTarget,
    }), { actual: 0, target: 0, dailyTarget: 0 });
    return {
      ...total,
      achievement: total.target > 0 ? total.actual / total.target : 0,
      gap: Math.max(0, total.target - total.actual),
      branchesWithSales: focusBranchPerformance.filter((branch) => branch.actual > 0).length,
    };
  }, [focusBranchPerformance]);

  const activeBranches = branchPerformance.filter((branch) => branch.target > 0);
  const onTrack = activeBranches.filter((branch) => branch.pace >= 1);
  const watch = activeBranches.filter((branch) => branch.pace >= .85 && branch.pace < 1);
  const atRisk = activeBranches.filter((branch) => branch.pace < .85);
  const branchHealthScore = activeBranches.length > 0
    ? (onTrack.length * 100 + watch.length * 70 + atRisk.length * 30) / activeBranches.length
    : 0;
  const leader = activeBranches[0];
  const maxPace = Math.max(1, ...activeBranches.map((branch) => branch.pace));
  const maxDaily = Math.max(metrics.dailyTarget, ...metrics.daily.slice(0, asOfDay), 1);
  const targetLevel = Math.min(96, (metrics.dailyTarget / maxDaily) * 100);
  const productFocus = executiveFocus[product];
  const remainingDays = Math.max(1, data.meta.daysInMonth - asOfDay);
  const monthlyGap = Math.max(0, metrics.target - metrics.mtd);
  const requiredPerDay = monthlyGap / remainingDays;
  const topThreeTotal = [...activeBranches]
    .sort((a, b) => b.mtd - a.mtd)
    .slice(0, 3)
    .reduce((sum, branch) => sum + branch.mtd, 0);
  const topThreeShare = metrics.mtd > 0 ? topThreeTotal / metrics.mtd : 0;
  const planSignal = metrics.pace >= 1
    ? "�˹����ҵ������"
    : metrics.pace >= .85
      ? "������ ��ͧ����ѧ���"
      : "��ӡ���Ἱ ��ͧ���";

  const selectedBranch = selectedBranchNames.length === 1
    ? targetedBranches.find((branch) => branch.name === selectedBranchNames[0]) ?? null
    : null;
  const branchExecutive = useMemo(() => {
    if (!selectedBranch) return null;
    const item = selectedBranch.products[product];
    const dailyValues = item.daily.slice(0, asOfDay);
    const mtd = dailyValues.reduce((sum, value) => sum + value, 0);
    const targetMtd = item.target * asOfDay / data.meta.daysInMonth;
    const pace = targetMtd > 0 ? mtd / targetMtd : 0;
    const achievement = item.target > 0 ? mtd / item.target : 0;
    const forecast = asOfDay > 0 ? mtd / asOfDay * data.meta.daysInMonth : 0;
    const gap = Math.max(0, item.target - mtd);
    const requiredDaily = gap / remainingDays;
    const bestValue = Math.max(...dailyValues, 0);
    const bestDay = bestValue > 0 ? dailyValues.indexOf(bestValue) + 1 : 0;
    const activeDays = dailyValues.filter((value) => value > 0).length;
    const runrateAchievement = item.target > 0 ? item.runrate / item.target : 0;
    const mom = item.julyActual > 0 ? item.runrate / item.julyActual - 1 : null;
    return { mtd, pace, achievement, forecast, gap, requiredDaily, bestValue, bestDay, activeDays, runrate: item.runrate, runrateAchievement, julyActual: item.julyActual, mom };
  }, [selectedBranch, product, asOfDay, data.meta.daysInMonth, remainingDays]);

  const personPositions = useMemo(
    () => [...new Set(productPeople.map((person) => person.position))].sort(),
    [productPeople],
  );
  const scopedPeople = useMemo(() => productPeople.filter((person) =>
    selectedBranchNames.length === 0 || selectedBranchNames.includes(person.shopName)), [selectedBranchNames, productPeople]);
  const positionScopedPeople = useMemo(() => scopedPeople.filter((person) =>
    positionFilters.length === 0 || positionFilters.includes(person.position)), [scopedPeople, positionFilters]);
  const filteredPeople = useMemo(() => {
    const query = personSearch.trim().toLocaleLowerCase("th-TH");
    return positionScopedPeople.filter((person) => {
      const matchesSearch = !query || `${person.name} ${person.id} ${person.shopName}`.toLocaleLowerCase("th-TH").includes(query);
      return matchesSearch;
    });
  }, [positionScopedPeople, personSearch]);
  const peopleWithTarget = filteredPeople.filter((person) => person.target > 0);
  const personTotals = filteredPeople.reduce((sum, person) => ({
    target: sum.target + person.target,
    actual: sum.actual + person.actual,
    actualRunrate: sum.actualRunrate + person.actualRunrate,
  }), { target: 0, actual: 0, actualRunrate: 0 });
  const personActualAchievement = personTotals.target > 0 ? personTotals.actual / personTotals.target : 0;
  const personRunrateAchievement = personTotals.target > 0 ? personTotals.actualRunrate / personTotals.target : 0;
  const peopleOnTrack = peopleWithTarget.filter((person) => person.runrateAchievement >= 1);
  const peopleWatch = peopleWithTarget.filter((person) => person.runrateAchievement >= .85 && person.runrateAchievement < 1);
  const peopleAtRisk = peopleWithTarget.filter((person) => person.runrateAchievement < .85);
  const topPerson = filteredPeople[0];
  const noSalesPeople = positionScopedPeople.filter((person) => person.actual <= 0);
  const noSalesRate = positionScopedPeople.length > 0 ? noSalesPeople.length / positionScopedPeople.length : 0;
  const noSalesGroups = useMemo(() => {
    const groups = new Map<string, typeof noSalesPeople>();
    for (const person of noSalesPeople) {
      const group = groups.get(person.shopName) ?? [];
      group.push(person);
      groups.set(person.shopName, group);
    }
    return Array.from(groups.entries())
      .map(([shopName, people]) => ({ shopName, people: [...people].sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name, "th")) }))
      .sort((a, b) => b.people.length - a.people.length || a.shopName.localeCompare(b.shopName));
  }, [noSalesPeople]);

  const togglePosition = (position: string) => {
    setPositionFilters((current) => current.includes(position)
      ? current.filter((item) => item !== position)
      : [...current, position]);
  };

  const toggleBranch = (branch: string) => {
    setSelectedBranchNames((current) => current.includes(branch)
      ? current.filter((item) => item !== branch)
      : [...current, branch]);
  };

  const branchSelectionLabel = selectedBranchNames.length === 0
    ? ALL_BRANCHES
    : selectedBranchNames.length === 1
      ? shortShop(selectedBranchNames[0])
      : `${selectedBranchNames.length} �Ңҷ�����͡`;

  const analysisActiveDays = metrics.daily.slice(0, asOfDay).filter((value) => value > 0).length;
  const analysisBestValue = Math.max(...metrics.daily.slice(0, asOfDay), 0);
  const analysisBestDay = analysisBestValue > 0 ? metrics.daily.indexOf(analysisBestValue) + 1 : 0;
  const analysisScope = selectedBranchNames.length === 0
    ? `�Ҿ��� ${activeBranches.length} �Ң�`
    : selectedBranchNames.length === 1
      ? shortShop(selectedBranchNames[0])
      : `����� ${selectedBranchNames.length} �Ңҷ�����͡`;
  const analysisPeriod = isDailyView ? `�ѹ��� ${String(periodDay).padStart(2, "0")} ${shortMonth}` : `�����֧ ${String(asOfDay).padStart(2, "0")} ${shortMonth}`;
  const weakestBranch = [...activeBranches].sort((a, b) => a.pace - b.pace)[0];
  const strongestBranch = [...activeBranches].sort((a, b) => b.pace - a.pace)[0];
  const executiveActions = [
    metrics.pace >= 1
      ? `�ѡ���ʹ ${product} ��������¡��� ${displayValue(metrics.dailyTarget)} ����ѹ ��жʹ�ٻẺ�ҡ�ѹ�����ʹ�٧�ش`
      : `��觻Դ Gap ����� ${displayValue(requiredPerDay)} ����ѹ ���͡�Ѻ��������������͹`,
    selectedBranchNames.length !== 1 && weakestBranch
      ? `�Դ��� ${shortShop(weakestBranch.name)} �� Priority �á ���� ACH MTD ������ ${percent(weakestBranch.pace)}`
      : `���ǹ�ʹ�Դ����ѹ�ͧ ${analysisScope} ������ѹ��� ${analysisBestDay || "�"} �� Benchmark`,
    personData
      ? noSalesPeople.length > 0
        ? `Coaching ����� No Sales ${noSalesPeople.length} �� ��������ҡ�Ңҷ���ըӹǹ�٧�ش${noSalesGroups[0] ? `: ${shortShop(noSalesGroups[0].shopName)} ${noSalesGroups[0].people.length} ��` : ""}`
        : "�ѡ�Ҽŧҹ��ºؤ����еԴ����������Դ No Sales ����"
      : productFocus.action,
  ];

  const exportSubtitle = `${analysisScope} � ${analysisPeriod} � Data as of ${data.meta.asOf}`;
  const exportFileSuffix = `${data.meta.asOf}_${isDailyView ? `day-${String(periodDay).padStart(2, "0")}` : "mtd"}`;

  const downloadProductExcel = () => {
    const branchSheet: ExcelSheet = {
      name: `${product} Branch`,
      title: `${product} Performance by Branch`,
      subtitle: exportSubtitle,
      headers: ["Rank", "Branch", "WW", "Product", "Period", "Target", "Actual", "Target by Period", "ACH by Period", "Status", "Runrate", "Runrate % Target", "July Actual", "%MOM", "Week", "Compared Days", "Current Week", "Base Week", `%WoW ${wowUnit}`, "WoW Unit", "Forecast", "Gap to Target", "Latest / Selected Day"],
      rows: branchPerformance.map((branch, index) => [
        index + 1,
        branch.name,
        branch.ww ?? "",
        product,
        analysisPeriod,
        branch.target,
        branch.mtd,
        branch.targetMtd,
        branch.pace,
        status(branch.pace).label,
        branch.runrate,
        branch.runrateAchievement,
        branch.julyActual,
        branch.mom,
        selectedWowWeek.label,
        wowMetrics.usedDays,
        branch.wowCurrent,
        branch.wowBase,
        branch.wow,
        wowUnit,
        branch.forecast,
        Math.max(0, branch.target - branch.mtd),
        branch.today,
      ]),
      numberColumns: [0, 5, 6, 7, 10, 12, 15, 16, 17, 20, 21, 22],
      percentageColumns: [8, 11, 13, 18],
    };
    const trendSheet: ExcelSheet = {
      name: "Daily Trend",
      title: `${product} Daily Trend`,
      subtitle: `${analysisScope} � �����֧ ${String(asOfDay).padStart(2, "0")} ${monthYear}`,
      headers: ["Date", "Actual", "Daily Target", "Variance"],
      rows: metrics.daily.slice(0, asOfDay).map((actual, index) => [
        `${data.meta.asOf.slice(0, 8)}${String(index + 1).padStart(2, "0")}`,
        actual,
        metrics.dailyTarget,
        actual - metrics.dailyTarget,
      ]),
      numberColumns: [1, 2, 3],
    };
    downloadExcelWorkbook([branchSheet, trendSheet], `BMAV_${product}_${exportFileSuffix}.xlsx`);
  };

  const downloadFocusExcel = () => {
    const focusSheet: ExcelSheet = {
      name: "Honor X5C Plus",
      title: `Focus Model: ${focusData.meta.model}`,
      subtitle: `${branchSelectionLabel} � ${selectedDay === null ? `���� 1-${focusAsOfDay} Aug 2026` : `੾���ѹ��� ${focusPeriodDay} Aug 2026`} � Data as of ${focusData.meta.asOf}`,
      headers: ["Rank", "Branch", "Target / Day", "Target by Period", "Actual QTY", "%ACH", "Gap", "Active Days"],
      rows: focusBranchPerformance.map((branch, index) => [
        index + 1,
        branch.name,
        branch.dailyTarget,
        branch.target,
        branch.actual,
        branch.achievement,
        branch.gap,
        branch.activeDays,
      ]),
      numberColumns: [0, 2, 3, 4, 6, 7],
      percentageColumns: [5],
    };
    downloadExcelWorkbook([focusSheet], `BMAV_Honor-X5C-Plus_${exportFileSuffix}.xlsx`);
  };

  const downloadPeopleExcel = () => {
    if (!personData) return;
    const peopleSheet: ExcelSheet = {
      name: `${product} Indy`,
      title: `${product} Performance Indy`,
      subtitle: `${branchSelectionLabel} � ${positionFilters.length === 0 ? "�ء���˹�" : positionFilters.join(", ")} � Data as of ${personAsOf}`,
      headers: ["Rank", "Employee ID", "Name", "Position", "Branch", "Area", "Target", "Actual", "Actual % Target", "Actual-Runrate", "RR ACH", "Tenure", "No Sales"],
      rows: filteredPeople.map((person, index) => [
        index + 1,
        person.id,
        person.name,
        person.position,
        person.shopName,
        person.area,
        person.target,
        person.actual,
        person.target > 0 ? person.actual / person.target : 0,
        person.actualRunrate,
        person.runrateAchievement,
        person.tenure,
        person.actual <= 0 ? "Yes" : "No",
      ]),
      numberColumns: [0, 6, 7, 9],
      percentageColumns: [8, 10],
    };
    downloadExcelWorkbook([peopleSheet], `BMAV_${product}_Performance-Indy_${exportFileSuffix}.xlsx`);
  };

  const reset = () => {
    setProduct("Device");
    setSelectedBranchNames([]);
    setDateFilter(ALL_DAYS);
    setWeekFilter("auto");
    setCaptureMode(false);
    setPersonSearch("");
    setPositionFilters([]);
    setShowNoSales(false);
  };

  const toggleCaptureMode = () => {
    if (!captureMode) setSelectedBranchNames([]);
    setCaptureMode((current) => !current);
  };

  const toggleFocusCaptureMode = () => {
    if (!focusCaptureMode) {
      setProduct("Device");
      setSelectedBranchNames([]);
    }
    setFocusCaptureMode((current) => !current);
  };

  return (
    <main className={captureMode ? "capture-mode" : focusCaptureMode ? "focus-capture-mode" : ""} style={{ "--product": theme.color, "--product-soft": theme.accent } as React.CSSProperties}>
      <header className="hero" data-sync-source={syncSource}>
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> BMAV-CENTRAL � DAILY SALES</div>
          <h1>Product<br />Performance <em>Monitor</em></h1>
          <p>Dashboard �ʹ�������ѹ (Device/GIA : Data TSM, Post/TOL : Data Link Daily Sales)</p>
        </div>
        <div className="hero-focus">
          <span>PRODUCT IN FOCUS</span>
          <strong>{product}</strong>
          <small>{selectedBranchNames.length === 0 ? `${targetedBranches.length} �Ңҷ���� Target` : branchSelectionLabel} � {syncSource === "sheet" ? "Google Sheet Live" : "���������ͧ"}</small>
        </div>
      </header>

      <section className="control-deck" aria-label="��ǡ�ͧ Dashboard">
        <div className="product-switch" role="group" aria-label="���͡ Product">
          {productNames.map((name) => <button key={name} className={product === name ? "active" : ""} onClick={() => setProduct(name)}>
            <i style={{ background: productMeta[name].color }}>{productMeta[name].short}</i><span>{name}{name === "TrueOnline" ? " (QTY)" : ""}</span>
          </button>)}
        </div>
        <div className="branch-multiselect">
          <span className="control-label">�Ң�</span>
          <details>
            <summary><span>{branchSelectionLabel}</span><b>{selectedBranchNames.length === 0 ? "������" : `${selectedBranchNames.length}/${targetedBranches.length}`}</b></summary>
            <div className="branch-options">
              <label className={selectedBranchNames.length === 0 ? "selected" : ""}>
                <input type="checkbox" checked={selectedBranchNames.length === 0} onChange={() => setSelectedBranchNames([])} />
                <span>{ALL_BRANCHES}</span><small>{targetedBranches.length} �Ңҷ���� Target</small>
              </label>
              {targetedBranches.map((branch) => <label className={selectedBranchNames.includes(branch.name) ? "selected" : ""} key={branch.name}>
                <input type="checkbox" checked={selectedBranchNames.includes(branch.name)} onChange={() => toggleBranch(branch.name)} />
                <span>{branch.name}</span><small>{branch.ww ? `WW ${branch.ww}` : ""}</small>
              </label>)}
            </div>
          </details>
        </div>
        <label><span>���͡ Week � WoW {wowUnit}</span><select value={weekFilter} onChange={(event) => setWeekFilter(event.target.value)}><option value="auto">Week �Ѩ�غѹ ({defaultWowWeek.label})</option>{WOW_WEEKS.map((week) => <option key={week.id} value={week.id}>{week.label} � {formatWowRange(week.start, week.end)}</option>)}</select></label>
        <label><span>���͡�ѹ���</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value={ALL_DAYS}>�ء�ѹ (�ʹ�����֧ {String(asOfDay).padStart(2, "0")} {shortMonth})</option>{Array.from({ length: asOfDay }, (_, index) => <option key={index + 1} value={String(index + 1)}>੾���ѹ��� {String(index + 1).padStart(2, "0")} {shortMonth} {asOfDate.getFullYear()}</option>)}</select></label>
        <div className="download-menu">
          <span className="control-label">��ǹ���Ŵ</span>
          <details>
            <summary>Download Excel</summary>
            <div className="download-options">
              <button onClick={(event) => { downloadProductExcel(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><b>{product} ����ͧ�Ѩ�غѹ</b><small>��ػ����Ң� + Daily Trend</small></button>
              {product === "Device" && <button onClick={(event) => { downloadFocusExcel(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><b>Focus Honor X5C Plus</b><small>Target ����ʹ�������Ң�</small></button>}
              {personData && <button onClick={(event) => { downloadPeopleExcel(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><b>Performance Indy</b><small>��ºؤ�ŵ����ǡ�ͧ�Ѩ�غѹ</small></button>}
            </div>
          </details>
        </div>
        <button className="reset" onClick={reset}>��ҧ��ǡ�ͧ</button>
      </section>

      <section className="scope-strip">
        <div><span>����ͧ�Ѩ�غѹ</span><strong>{product} � {branchSelectionLabel}</strong></div>
        <div><span>��ǧ�ѹ���</span><strong>{isDailyView ? `੾���ѹ��� ${String(periodDay).padStart(2, "0")} ${monthYear}` : `�ء�ѹ � �����֧ ${String(asOfDay).padStart(2, "0")} ${monthYear}`}</strong></div>
        <div><span>��ѡ��äӹǳ</span><strong>੾�� {product} ��ҹ��{isQtyProduct ? " � ��� QTY" : ""}</strong></div>
      </section>

      <section className="panel wow-panel" aria-label="Performance WoW">
        <div className="wow-heading">
          <div><span>PERFORMANCE WOW</span><h2>{product === "TrueOnline" ? "TOL" : product === "Postpay" ? "Post" : product} Performance WoW</h2><p>{selectedWowWeek.label} � ��ǧ Week {formatWowRange(selectedWowWeek.start, selectedWowWeek.end)} � ��ǧ����� {wowCurrentRange} � �ҹ {wowBaseRange}</p></div>
          <b className={`wow-status ${wowMetrics.isWaiting || !wowMetrics.baseComplete ? "neutral" : wowMetrics.isCompleteWeek ? "complete" : "partial"}`}>{wowStatusText}</b>
        </div>
        <div className="wow-summary">
          <article><span>�ʹ��ǧ Week �Ѩ�غѹ</span><strong>{displayValue(wowMetrics.currentTotal)}</strong><small>{wowCurrentRange} � {wowMetrics.usedDays} �ѹ</small></article>
          <article><span>�ʹ�ҹ���º��º</span><strong>{displayValue(wowMetrics.baseTotal)}</strong><small>{wowBaseRange} � {wowMetrics.usedDays} �ѹ</small></article>
          <article className={`wow-result ${wowTone(wowMetrics.wow)}`}><span>WoW {wowUnit}</span><strong>{momPercent(wowMetrics.wow)}</strong><small>{wowAvailabilityText}</small></article>
        </div>
        <p className="wow-footnote">�ٵ� WoW: (�ʹ��ǧ�Ѩ�غѹ ? �ʹ��ǧ�ҹ) ? 1 � �к��ӡѴ�ѹ�����ҡѹ�ѵ��ѵԵ�������Ũ�ԧ ��Фӹǳ������ Product, Week ��� Shop ������͡</p>
      </section>

      <section className="kpi-grid" aria-label="KPI �ͧ Product ������͡">
        <article className="kpi hero-kpi"><span>{isDailyView ? `�ʹ�ѹ��� ${String(periodDay).padStart(2, "0")} ${shortMonth}` : "�ʹ���� MTD"}</span><strong>{displayValue(metrics.mtd)}</strong><small>{isDailyView ? "�ʹ੾���ѹ������͡" : `�ʹ�ѹ��� ${String(asOfDay).padStart(2, "0")} ${shortMonth} ${displayValue(metrics.today)}`}</small></article>
        <article className="kpi"><span>Target</span><strong>{displayValue(metrics.target)}</strong><small>����� {displayValue(metrics.dailyTarget)} / �ѹ</small></article>
        <article className="kpi"><span>%ACH</span><strong>{percent(metrics.achievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.achievement * 100)}%` }} /></div></article>
        <article className={`kpi pace ${status(metrics.pace).key}`}><span>{isDailyView ? "ACH Daily" : "ACH MTD"}</span><strong>{percent(metrics.pace)}</strong><small>{status(metrics.pace).label}</small></article>
        <article className="kpi runrate-kpi"><span>Runrate</span><strong>{displayValue(metrics.runrate)}</strong><small>�ҡ {isQtyProduct ? "RR QTY" : "RR Net Amount"} ����鹩�Ѻ</small></article>
        <article className="kpi"><span>Runrate % ��º���</span><strong>{percent(metrics.runrateAchievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.runrateAchievement * 100)}%` }} /></div></article>
        <article className={`kpi mom-kpi ${momTone(metrics.mom)}`}><span>%MOM</span><strong>{momPercent(metrics.mom)}</strong><small>Runrate ��º July Actual {displayValue(metrics.julyActual)}</small></article>
        <article className="kpi"><span>Forecast �����͹</span><strong>{displayValue(metrics.forecast)}</strong><small>{percent(metrics.target ? metrics.forecast / metrics.target : 0)} �ͧ���</small></article>
        <article className="kpi"><span>Gap �֧�����͹</span><strong>{displayValue(Math.max(0, metrics.target - metrics.mtd))}</strong><small>�ʹ����ѧ��ͧ�Դ</small></article>
      </section>

      <section className="executive-grid">
        <article className="panel insight-panel">
          <div className="section-head"><div><span>PRODUCT INTELLIGENCE</span><h2>Executive Infographic</h2></div><b>{product} � {isDailyView ? `�ѹ��� ${periodDay}` : `���� ${asOfDay} �ѹ`}</b></div>
          <div className="insight-grid">
            <div className="insight major"><i>01</i><div><span>�Ҿ��� Product</span><strong>%Achieve {percent(metrics.pace)}</strong><p>���� {displayValue(metrics.mtd)} �ҡ��ҷ������ {displayValue(metrics.targetMtd)}</p></div></div>
            <div className="insight"><i>02</i><div><span>Shop Top Ranking</span><strong>{leader ? shortShop(leader.name) : "�"}</strong><p>{leader ? `%Achieve ${percent(leader.pace)} � ${displayValue(leader.mtd)}` : "�ѧ������������"}</p></div></div>
            <div className="insight"><i>03</i><div><span>On Track</span><strong>{onTrack.length} �Ң�</strong><p>{activeBranches.length ? `${Math.round(onTrack.length / activeBranches.length * 100)}% �ͧ�Ңҷ�������` : "������Ңҷ�������"}</p></div></div>
            <div className="insight"><i>04</i><div><span>��ͧ���</span><strong>{atRisk.length} �Ң�</strong><p>%Achieve ��ӡ��� 85% �ͧ��ҵ���ѹ</p></div></div>
          </div>
          <div className="product-lens">
            <div><span>PRODUCT EXECUTIVE LENS � {product}</span><strong>{productFocus.title}</strong><p>{productFocus.description}</p></div>
            <div className="lens-kpis">
              <div><small>ʶҹ���ºἹ</small><b>{planSignal}</b></div>
              <div><small>Top 3 Contribution</small><b>{percent(topThreeShare)}</b></div>
              <div><small>��ͧ�Դ����ѹ</small><b>{displayValue(requiredPerDay)}</b></div>
              <div><small>%MOM ��º July</small><b className={`mom-text ${momTone(metrics.mom)}`}>{momPercent(metrics.mom)}</b></div>
            </div>
            <p className="lens-action"><b>Management Action:</b> {productFocus.action}</p>
          </div>
        </article>

        <aside className="mission-card">
          <span>DAILY MISSION</span>
          <h2>{metrics.pace >= 1 ? "�ѡ�Ҩѧ����˹�����" : "��觻Դ Gap ����ѹ"}</h2>
          <div className="mission-number"><small>��ҵ���ѹ</small><strong>{displayValue(metrics.dailyTarget)}</strong></div>
          <ul>
            <li><b>�ѹ���</b><span>{displayValue(metrics.today)} � {percent(metrics.dailyTarget ? metrics.today / metrics.dailyTarget : 0)}</span></li>
            <li><b>Runrate</b><span>{displayValue(metrics.runrate)} � {percent(metrics.runrateAchievement)}</span></li>
            <li><b>%MOM</b><span>{momPercent(metrics.mom)} � July {displayValue(metrics.julyActual)}</span></li>
            <li><b>Forecast</b><span>{displayValue(metrics.forecast)}</span></li>
            <li><b>Priority</b><span>{atRisk[0] ? shortShop(atRisk[0].name) : "�ѡ�ҷء�Ң�"}</span></li>
          </ul>
        </aside>
      </section>

      {branchExecutive && selectedBranch && <section className="panel branch-analysis">
        <div className="section-head"><div><span>BRANCH EXECUTIVE ANALYSIS</span><h2>{shortShop(selectedBranch.name)} � {product}</h2></div><b>�����֧ {String(asOfDay).padStart(2, "0")} {shortMonth}</b></div>
        <div className="branch-summary">
          <div><span>EXECUTIVE SIGNAL</span><strong>{branchExecutive.pace >= 1 ? "�Ң��Թ˹���˹��Ἱ" : branchExecutive.pace >= .85 ? "�Ң����Ἱ ��ͧ����ʹ�Դ" : "�Ңҵ�ӡ���Ἱ ��ͧ��觷ѹ��"}</strong></div>
          <p>�ʹ���� {displayValue(branchExecutive.mtd)} � %ACH {percent(branchExecutive.achievement)} � ACH MTD {percent(branchExecutive.pace)}</p>
        </div>
        <div className="branch-analysis-grid">
          <article><span>���˹觻Ѩ�غѹ</span><strong>ACH MTD {percent(branchExecutive.pace)}</strong><small>{status(branchExecutive.pace).label} ��º Target MTD</small></article>
          <article><span>�ѹ�����ʹ�٧�ش</span><strong>{branchExecutive.bestDay ? `�ѹ��� ${String(branchExecutive.bestDay).padStart(2, "0")}` : "�ѧ������ʹ"}</strong><small>{displayValue(branchExecutive.bestValue)} � ���ʹ {branchExecutive.activeDays}/{asOfDay} �ѹ</small></article>
          <article><span>��áԨ�Դ Gap</span><strong>{displayValue(branchExecutive.requiredDaily)} / �ѹ</strong><small>Gap ������� {displayValue(branchExecutive.gap)}</small></article>
          <article><span>Outlook �����͹</span><strong>{displayValue(branchExecutive.forecast)}</strong><small>Runrate {percent(branchExecutive.runrateAchievement)} � %MOM {momPercent(branchExecutive.mom)}</small></article>
        </div>
        <div className="branch-action"><span>����ʹ�������Ѻ�Ң�</span><p>{branchExecutive.pace >= 1 ? `�ѡ�Ҩѧ��� ${product} ��������ͧ ������ѹ�����ʹ�٧�ش�繵�Ẻ��ûԴ�ʹ` : `${productFocus.action} �Ңҹ���ͧ����������� ${displayValue(branchExecutive.requiredDaily)} ����ѹ��ѹ��������`}</p></div>
      </section>}

      {product === "Device" && <section className="panel focus-device-monitor">
        <div className="section-head focus-device-head"><div><span>FOCUS DEVICE MODEL</span><h2>{focusData.meta.model}</h2><p>�Դ����ʹ��� QTY ��� Target ����Ң� � ������Ѻ����� 1 Aug 2026</p></div><div className="focus-device-actions"><b>{focusSyncSource === "sheet" ? "Google Sheet Live" : "���������ͧ"} � �֧ {String(focusAsOfDay).padStart(2, "0")} Aug</b><button className="capture-toggle" onClick={toggleFocusCaptureMode}>{focusCaptureMode ? "��Ѻ Dashboard" : "�٤ú 15 �Ң� / Copy �ٻ"}</button></div></div>
        <div className="focus-device-kpis">
          <article><span>{isDailyView ? `�ʹ�ѹ��� ${String(focusPeriodDay).padStart(2, "0")} Aug` : "�ʹ����"}</span><strong>{money(focusMetrics.actual)} QTY</strong><small>{focusMetrics.branchesWithSales} �Ң����ʹ</small></article>
          <article><span>{isDailyView ? "Target ��Ш��ѹ" : "Target ����"}</span><strong>{money(focusMetrics.target)} QTY</strong><small>������ {money(focusMetrics.dailyTarget)} ����ͧ/�ѹ</small></article>
          <article><span>%ACH</span><strong>{percent(focusMetrics.achievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, focusMetrics.achievement * 100)}%` }} /></div></article>
          <article><span>Gap</span><strong>{money(focusMetrics.gap)} QTY</strong><small>�ʹ����ͧ�������</small></article>
        </div>
        <div className="focus-target-rule"><strong>Target ����ѹ</strong><span>Central Rama 9 4Fl. ��� Central World 4Fl. = 3 ����ͧ/�Ң�</span><span>�ա 13 �Ңҷ���� Target = 1 ����ͧ/�Ң�</span></div>
        <div className="table-wrap focus-device-table-wrap"><table className="focus-device-table"><thead><tr><th>Rank</th><th>�Ң�</th><th>Target/�ѹ</th><th>{isDailyView ? "Target �ѹ���" : "Target ����"}</th><th>Actual QTY</th><th>%ACH</th><th>Gap</th><th>�ѹ������ʹ</th><th>ʶҹ�</th></tr></thead><tbody>
          {focusBranchPerformance.map((branch, index) => {
            const currentStatus = status(branch.achievement);
            const isSpecialTarget = branch.dailyTarget === 3;
            return <tr key={branch.name}><td>{index + 1}</td><td><strong>{shortShop(branch.name)}</strong><small>{branch.ww ? `WW ${branch.ww}` : "�������Ң�"}{isSpecialTarget ? " � Focus 3/�ѹ" : ""}</small></td><td><b>{branch.dailyTarget} QTY</b></td><td>{money(branch.target)} QTY</td><td><strong>{money(branch.actual)} QTY</strong></td><td><b>{percent(branch.achievement)}</b></td><td>{money(branch.gap)} QTY</td><td>{branch.activeDays}/{focusPeriodDays} �ѹ</td><td><span className={`status ${currentStatus.key}`}>{currentStatus.label}</span></td></tr>;
          })}
        </tbody></table></div>
        <p className="focus-device-source">�ʹ��ԧ 14 ����ͧ �ҡ�����ŷ���׹�ѹ�֧ 15 Aug 2026 � �ʴ�੾�� 15 �Ңҷ���� Target � ����¹�ѹ����������͡�ҢҴ�ҹ�����ʹ�੾���������ͧ��� � <a href={FOCUS_DEVICE_SHEET_URL} target="_blank" rel="noreferrer">�Դ Google Sheet</a></p>
      </section>}

      {personData && <section className="panel people-performance">
        <div className="section-head people-head"><div><span>{product === "TrueOnline" ? "TOL" : "POSTPAY"} � PEOPLE PERFORMANCE</span><h2>Performance Indy ��ºؤ��</h2><p>Data as of {personAsOfDisplay} � {peopleSyncSource === "sheet" ? "Google Sheet Live � �ѻവ�ѵ��ѵԷء 5 �ҷ�" : "���������ͧ � ���ѧ������� Google Sheet"}</p></div><b>{branchSelectionLabel} � {filteredPeople.length} ��</b></div>
        <div className="people-kpis">
          <article><span>��ѡ�ҹ�����ͧ</span><strong>{filteredPeople.length} ��</strong><small>{peopleWithTarget.length} ������� Target</small></article>
          <article><span>Actual �֧ {personAsOfShort}</span><strong>{personValue(personTotals.actual)}</strong><small>%ACH {percent(personActualAchievement)}</small></article>
          <article><span>{isQtyProduct ? "RR QTY" : "Actual-RR"}</span><strong>{personValue(personTotals.actualRunrate)}</strong><small>RR ACH {percent(personRunrateAchievement)}</small></article>
          <article><span>Top RR Ranking</span><strong>{topPerson ? topPerson.name : "�"}</strong><small>{topPerson ? `${percent(topPerson.runrateAchievement)} � ${shortShop(topPerson.shopName)}` : "��辺������"}</small></article>
        </div>
        <div className="people-insight-row">
          <div className="people-distribution">
            <div className="ontrack"><span>On Track</span><strong>{peopleOnTrack.length}</strong><small>RR ACH ? 100%</small></div>
            <div className="watch"><span>Watch</span><strong>{peopleWatch.length}</strong><small>RR ACH 85�99.9%</small></div>
            <div className="atrisk"><span>At Risk</span><strong>{peopleAtRisk.length}</strong><small>RR ACH ��ӡ��� 85%</small></div>
          </div>
          <div className="people-executive-note"><span>EXECUTIVE TAKEAWAY</span><strong>{peopleOnTrack.length >= peopleAtRisk.length ? "���ѧ��ѡ��ǹ�˭��Թ˹������Ἱ" : "��ͧ��� Coaching ��ºؤ��㹡���� At Risk"}</strong><p>{peopleAtRisk.length ? `�� ${peopleAtRisk.length} ����ӡ��� 85% �ͧ RR Target ���������ҡ����� Actual �ѧ�������� Gap �٧` : "�ѡ�Ҩѧ��С�ûԴ�ʹ��жʹ�����¹�ҡ Top RR Ranking"}</p></div>
        </div>
        <button className={`no-sales-focus ${showNoSales ? "open" : ""}`} onClick={() => setShowNoSales((current) => !current)} aria-expanded={showNoSales}>
          <span><i>NO SALES FOCUS</i><strong>{noSalesPeople.length} ��</strong><small>{analysisScope} � {percent(noSalesRate)} �ͧ��ѡ�ҹ {positionScopedPeople.length} ��� Type ������͡</small></span>
          <b>{showNoSales ? "��͹��ª���" : "�٪��� � ���˹� � �Ң�"}</b>
        </button>
        {showNoSales && <div className="no-sales-detail">
          <div className="no-sales-title"><div><span>NO SALES PERSON DETAIL</span><h3>{analysisScope}</h3></div><b>Actual = 0 � {personAsOfDisplay}</b></div>
          {noSalesGroups.length > 0 ? <div className="no-sales-groups">{noSalesGroups.map((group) => <article key={group.shopName}>
            <header><strong>{shortShop(group.shopName)}</strong><b>{group.people.length} ��</b></header>
            <div>{group.people.map((person) => <p key={`${person.id}-${person.name}`}><span><strong>{person.name}</strong><small>ID {person.id || "�"}</small></span><b>{person.position}</b></p>)}</div>
          </article>)}</div> : <p className="no-sales-empty">��辺��ѡ�ҹ No Sales �����ͧ������͡</p>}
        </div>}
        <div className="people-controls">
          <label><span>���Ҿ�ѡ�ҹ / ID / �Ң�</span><input value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} placeholder="�������� ���� �����Ң�" /></label>
          <fieldset className="position-checks"><legend>���͡ Type / ���˹�</legend><div>
            <label className={positionFilters.length === 0 ? "selected" : ""}><input type="checkbox" checked={positionFilters.length === 0} onChange={() => setPositionFilters([])} /><span>�ء���˹�</span></label>
            {personPositions.map((position) => <label className={positionFilters.includes(position) ? "selected" : ""} key={position}><input type="checkbox" checked={positionFilters.includes(position)} onChange={() => togglePosition(position)} /><span>{position}</span></label>)}
          </div></fieldset>
        </div>
        <div className="people-table-wrap"><table className="people-table"><thead><tr><th>Rank</th><th>��ѡ�ҹ</th><th>���˹�</th><th>�Ң�</th><th>Target</th><th>Actual</th><th>{isQtyProduct ? "RR QTY" : "Actual-RR"}</th><th>% RR ACH</th><th>���اҹ</th><th>ʶҹ�</th></tr></thead><tbody>
          {filteredPeople.map((person, index) => {
            const personStatus = person.target > 0 ? status(person.runrateAchievement) : { key: "notarget", label: "No Target" };
            return <tr key={`${person.id}-${person.name}`}><td><b>{String(index + 1).padStart(2, "0")}</b></td><td><strong>{person.name}</strong><small>ID {person.id || "�"}</small></td><td>{person.position}</td><td>{shortShop(person.shopName)}</td><td>{personValue(person.target)}</td><td><b>{personValue(person.actual)}</b></td><td>{personValue(person.actualRunrate)}</td><td><strong className={`rr-percent ${personStatus.key}`}>{percent(person.runrateAchievement)}</strong></td><td>{person.tenure}</td><td><span className={`status ${personStatus.key}`}>{personStatus.label}</span></td></tr>;
          })}
          {!filteredPeople.length && <tr><td colSpan={10} className="people-empty">��辺�����ŵ����ǡ�ͧ������͡</td></tr>}
        </tbody></table></div>
        <div className="people-source-note"><b>�����˵�:</b> Target, Actual, {isQtyProduct ? "RR QTY" : "Actual-RR"} ��� % RR ACH ��ºؤ���Ҩҡ <a href={PERSON_PERFORMANCE_SHEET_URL} target="_blank" rel="noreferrer">BMAV Person Performance Daily Update</a> � {personAsOfDisplay} �µç � ���觢������Ҹ�ó� � ���ê�ѵ��ѵԷء 5 �ҷ� ����¡�ش�ӹǳ�ҡ�ʹ�дѺ�Ң�</div>
      </section>}

      <section className="two-col">
        <article className="panel trend-panel">
          <div className="section-head"><div><span>DAILY TREND</span><h2>�ʹ����ѹ � {product}</h2></div><b>��鹻�� = ��������/�ѹ</b></div>
          <div className="daily-chart" style={{ "--target-level": `${100 - targetLevel}%` } as React.CSSProperties}>
            <div className="target-line"><span>{displayValue(metrics.dailyTarget)}</span></div>
            {metrics.daily.map((value, index) => <div className={`day-bar ${index + 1 > asOfDay ? "future" : ""} ${isDailyView && index + 1 !== selectedDay ? "not-selected" : ""} ${isDailyView && index + 1 === selectedDay ? "selected" : ""}`} key={index} title={`�ѹ��� ${index + 1}: ${displayValue(value)}`}>
              <i style={{ height: `${Math.max(value > 0 ? 4 : 0, value / maxDaily * 100)}%` }} /><span>{index + 1}</span>
            </div>)}
          </div>
          <div className="trend-scorebar">
            <div className="trend-score-head"><span>BRANCH HEALTH SCORE</span><strong>{Math.round(branchHealthScore)} / 100</strong></div>
            <div className="trend-score-track">
              {onTrack.length > 0 && <i className="ontrack" style={{ width: `${onTrack.length / activeBranches.length * 100}%` }} />}
              {watch.length > 0 && <i className="watch" style={{ width: `${watch.length / activeBranches.length * 100}%` }} />}
              {atRisk.length > 0 && <i className="atrisk" style={{ width: `${atRisk.length / activeBranches.length * 100}%` }} />}
            </div>
            <div className="trend-score-legend"><span><i className="ontrack" />On Track <b>{onTrack.length}</b></span><span><i className="watch" />Watch <b>{watch.length}</b></span><span><i className="atrisk" />At Risk <b>{atRisk.length}</b></span></div>
          </div>
        </article>

        <article className="panel ranking-panel">
          <div className="section-head"><div><span>SHOP RANKING</span><h2>Ranking Shop</h2></div><b>{activeBranches.length} �Ңҷ���� Target</b></div>
          <div className="rank-list">{activeBranches.map((branch, index) => {
            const currentStatus = status(branch.pace);
            return <div className="rank-row" key={branch.name}>
              <span className="rank-no">{String(index + 1).padStart(2, "0")}</span>
              <div><div className="rank-label"><strong>{shortShop(branch.name)}</strong><span>{currentStatus.label}</span></div><div className="rank-track"><i className={currentStatus.key} style={{ width: `${Math.min(100, branch.pace / maxPace * 100)}%` }} /></div></div>
              <b>{percent(branch.pace)}</b>
            </div>;
          })}</div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="section-head"><div><span>BRANCH MONITOR</span><h2>{product} Performance by Branch</h2></div><div className="table-actions"><b>˹���: {isQtyProduct ? "QTY" : "Net"} � {isDailyView ? `੾���ѹ��� ${String(periodDay).padStart(2, "0")} Aug` : "�ʹ�����ء�ѹ"}</b><button className="capture-toggle" onClick={toggleCaptureMode}>{captureMode ? "��Ѻ Dashboard" : "�٤ú�ء�Ң� / Copy �ٻ"}</button></div></div>
        <div className="table-wrap"><table><thead><tr><th>�Ң�</th><th>{isDailyView ? `�ʹ�ѹ��� ${String(periodDay).padStart(2, "0")}` : "�ʹ MTD"}</th><th>Target</th><th>%ACH</th><th>{isDailyView ? "Target Daily" : "Target MTD"}</th><th>{isDailyView ? "ACH Daily" : "ACH MTD"}</th><th>Runrate</th><th>Runrate %</th><th>MoM / WoW</th><th>Forecast</th><th>ʶҹ�</th></tr></thead>
          <tbody>{branchPerformance.map((branch) => {
            const currentStatus = status(branch.pace);
            return <tr key={branch.name}><td><strong>{shortShop(branch.name)}</strong><small>{branch.ww ? `WW ${branch.ww}` : "�������Ң�"}</small></td><td><b>{displayValue(branch.mtd)}</b><small>{isDailyView ? "੾���ѹ������͡" : `�ѹ��� ${String(asOfDay).padStart(2, "0")} ${shortMonth} ${displayValue(branch.today)}`}</small></td><td>{displayValue(branch.target)}</td><td>{percent(branch.target ? branch.mtd / branch.target : 0)}</td><td>{displayValue(branch.targetMtd)}</td><td><strong>{percent(branch.pace)}</strong></td><td><b className="rr-value">{displayValue(branch.runrate)}</b></td><td><strong className={`rr-percent ${status(branch.runrateAchievement).key}`}>{percent(branch.runrateAchievement)}</strong></td><td><div className="trend-badges"><strong className={`trend-badge ${momTone(branch.mom)}`}><small>MoM</small>{momPercent(branch.mom)}</strong><strong className={`trend-badge ${wowTone(branch.wow)}`}><small>WoW {wowUnit}</small>{momPercent(branch.wow)}</strong></div></td><td>{displayValue(branch.forecast)}</td><td><span className={`status ${currentStatus.key}`}>{currentStatus.label}</span></td></tr>;
          })}</tbody></table></div>
      </section>

      <section className="panel auto-executive-analysis">
        <div className="analysis-heading"><div><span>AUTO-GENERATED EXECUTIVE INSIGHT</span><h2>�������ԧ�֡����Ѻ��������</h2><p>���������ѵ��ѵԵ�� {product} � {analysisScope} � {analysisPeriod}</p></div><b>{planSignal}</b></div>
        <div className="analysis-lead">
          <span>EXECUTIVE SUMMARY</span>
          <strong>{metrics.pace >= 1 ? `${product} �Թ˹���˹����ҵ������` : metrics.pace >= .85 ? `${product} ���������� ���ͧ����ʹ�Դ�ء�ѹ` : `${product} ��ӡ���Ἱ��е�ͧ����� Gap`}</strong>
          <p>{analysisScope} ���ʹ {displayValue(metrics.mtd)} ��º Target MTD {displayValue(metrics.targetMtd)} �Դ�� ACH MTD {percent(metrics.pace)} ��з�� Runrate ������ {displayValue(metrics.runrate)} ���� {percent(metrics.runrateAchievement)} �ͧ Target ��͹ ����������º��͹��͹������ {momPercent(metrics.mom)}</p>
        </div>
        <div className="analysis-grid">
          <article><span>01 � PERFORMANCE POSITION</span><h3>���˹���ºἹ</h3><ul><li><b>%ACH ��͹</b><strong>{percent(metrics.achievement)}</strong></li><li><b>ACH MTD</b><strong>{percent(metrics.pace)}</strong></li><li><b>Forecast</b><strong>{displayValue(metrics.forecast)}</strong></li><li><b>Gap ��͹</b><strong>{displayValue(monthlyGap)}</strong></li></ul></article>
          <article><span>02 � SALES MOMENTUM</span><h3>�س�Ҿ��Шѧ����ʹ</h3><p>���ʹ {analysisActiveDays}/{asOfDay} �ѹ ���ѹ���շ���ش��� {analysisBestDay ? `�ѹ��� ${analysisBestDay}` : "�ѧ������ʹ"} ���� {displayValue(analysisBestValue)} �Ѩ�غѹ��ͧ�ѡ�����������ʹ����� {displayValue(requiredPerDay)} ����ѹ㹪�ǧ��������</p><div className="analysis-signal"><b>%MOM</b><strong className={momTone(metrics.mom)}>{momPercent(metrics.mom)}</strong></div></article>
          <article><span>03 � RISK & PEOPLE</span><h3>�ش����§����ͧ������</h3>{personData ? <><p>� Type ������͡�� No Sales {noSalesPeople.length} �� �ҡ {positionScopedPeople.length} �� ({percent(noSalesRate)}) ��С���� At Risk ��� RR ACH �ӹǹ {peopleAtRisk.length} ��</p><div className="analysis-signal"><b>�Ң� No Sales �٧�ش</b><strong>{noSalesGroups[0] ? `${shortShop(noSalesGroups[0].shopName)} � ${noSalesGroups[0].people.length} ��` : "����� No Sales"}</strong></div></> : <><p>���Ңҵ�ӡ��� 85% �ͧ Target MTD �ӹǹ {atRisk.length} �Ң� �ҡ {activeBranches.length} �Ң� �µ�ͧ�Դ�������������ͧ�ͧ�ʹ��� Gap ����ѹ</p><div className="analysis-signal"><b>�Ңҷ���ͧ���</b><strong>{weakestBranch ? `${shortShop(weakestBranch.name)} � ${percent(weakestBranch.pace)}` : "�"}</strong></div></>}</article>
          <article><span>04 � OPPORTUNITY</span><h3>�͡�ʢ��¼�</h3><p>{strongestBranch ? `${shortShop(strongestBranch.name)} �� Benchmark �ͧ����ͧ����� ACH MTD ${percent(strongestBranch.pace)} ��öʹ�Ը����ҧ�ʹ����觵������Ңҷ���ӡ���Ἱ` : "�ѧ����բ������Ң�����Ѻ��������"}</p><div className="analysis-signal"><b>Top Contribution</b><strong>{strongestBranch ? `${shortShop(strongestBranch.name)} � ${displayValue(strongestBranch.mtd)}` : "�"}</strong></div></article>
        </div>
        <div className="management-actions"><span>MANAGEMENT PRIORITIES</span><div>{executiveActions.map((action, index) => <p key={action}><b>{String(index + 1).padStart(2, "0")}</b><span>{action}</span></p>)}</div></div>
        <p className="analysis-footnote">���������������ҧ�ҡ������ Dashboard �Ѩ�غѹ���ѵ��ѵ� ��ШФӹǳ����ѹ�����������¹ Product, �Ң�, �ѹ��� ���� Type ���˹�</p>
      </section>

      <section className="method-note"><div><strong>��ѡ����¡ Product</strong><p>�ء KPI, ��ҿ, �ѹ�Ѻ ��е��ҧ�ӹǳ�ҡ Product ������͡��§��¡������ �������͹�Ңҷ������� Target �ͧ Product ���</p></div><div><strong>Runrate �ҡ���鹩�Ѻ</strong><p>���� {isQtyProduct ? "RR QTY ����Ѻ TOL" : "RR Net Amount"} �¡��� Product ����Ң� � Runrate % = Runrate ? Target �����͹</p></div></section>
      <footer><span>BMAV-Central Product Performance Monitor</span><b>Source: 8778 Aug 2026 V1.xlsx � As of {String(asOfDay).padStart(2, "0")} {shortMonth} {asOfDate.getFullYear()}</b></footer>
    </main>
  );
}

