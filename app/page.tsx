"use client";

import { useEffect, useMemo, useState } from "react";
import fallbackData from "./sales-product-data.json";
import postpayPersonData from "./postpay-person-performance.json";
import { type Branch, type DashboardData, loadGoogleSheetData, type ProductName } from "./google-sheet-data";

const ALL_BRANCHES = "ทุกสาขา";
const ALL_DAYS = "all";
const ALL_POSITIONS = "ทุกตำแหน่ง";
type PersonPerformance = {
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
const postpayPeople = postpayPersonData.people as PersonPerformance[];
const productMeta: Record<ProductName, { color: string; accent: string; short: string }> = {
  Device: { color: "#2563eb", accent: "#dbeafe", short: "DEV" },
  GIA: { color: "#8e44ad", accent: "#f3e8ff", short: "GIA" },
  Postpay: { color: "#f59e0b", accent: "#fef3c7", short: "POST" },
  TrueOnline: { color: "#00a8e8", accent: "#cffafe", short: "TOL" },
};

const executiveFocus: Record<ProductName, { title: string; description: string; action: string }> = {
  Device: {
    title: "เร่งมูลค่ายอดขายและปิด Gap รายสาขา",
    description: "ติดตามมูลค่ายอดขายเทียบ Target ตามวัน พร้อมจับตาการกระจุกตัวของยอดในสาขานำ",
    action: "ให้สาขาที่ต่ำกว่าแผนเร่งดีลมูลค่าสูง และทบทวนยอดปิดทุกวัน",
  },
  GIA: {
    title: "ยกระดับความสม่ำเสมอของยอด GIA",
    description: "โฟกัสความเร็วเทียบ Target MTD และความต่อเนื่องของผลงานระหว่างสาขา",
    action: "กำหนดเป้าปิด GIA รายวันให้สาขาที่ต่ำกว่าแผน และติดตามผลเป็นรายสาขา",
  },
  Postpay: {
    title: "เร่งยอดปิด Postpay ให้ทัน Runrate",
    description: "วัดยอดสะสมและจังหวะการปิดรายวัน โดยไม่รวมยอดจาก Product อื่น",
    action: "เร่งสาขาที่ ACH MTD ต่ำกว่า 85% และติดตามยอดปิด Postpay รายวัน",
  },
  TrueOnline: {
    title: "เพิ่มจำนวนปิด TOL ในมุม QTY",
    description: "ทุกตัวเลขวิเคราะห์เป็นจำนวน QTY เพื่อให้เห็นภารกิจปิดงานที่ชัดเจน",
    action: "กำหนด QTY ที่ต้องปิดต่อวัน และโฟกัสสาขาที่ไม่มียอดต่อเนื่อง",
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
  const [product, setProduct] = useState<ProductName>("Device");
  const [branchName, setBranchName] = useState(ALL_BRANCHES);
  const [dateFilter, setDateFilter] = useState(ALL_DAYS);
  const [captureMode, setCaptureMode] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState(ALL_POSITIONS);
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
  const displayValue = (value: number) => `${money(value)}${isQtyProduct ? " QTY" : ""}`;

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
    if (branchName !== ALL_BRANCHES && !targetedBranches.some((branch) => branch.name === branchName)) {
      setBranchName(ALL_BRANCHES);
    }
  }, [branchName, targetedBranches]);

  const selectedBranches = useMemo(
    () => branchName === ALL_BRANCHES ? targetedBranches : targetedBranches.filter((branch) => branch.name === branchName),
    [branchName, targetedBranches],
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
    return { ...branch, target: item.target, mtd, targetMtd, pace, forecast, runrate: item.runrate, runrateAchievement, julyActual: item.julyActual, mom, today: item.daily[periodDay - 1] ?? 0 };
  }).filter((branch) => branchName === ALL_BRANCHES || branch.name === branchName)
    .sort((a, b) => b.pace - a.pace), [targetedBranches, product, branchName, isDailyView, periodDay, periodDays]);

  const activeBranches = branchPerformance.filter((branch) => branch.target > 0);
  const onTrack = activeBranches.filter((branch) => branch.pace >= 1);
  const atRisk = activeBranches.filter((branch) => branch.pace < .85);
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
    ? "เหนือเป้าตามเวลา"
    : metrics.pace >= .85
      ? "ใกล้เป้า ต้องคุมจังหวะ"
      : "ต่ำกว่าแผน ต้องเร่ง";

  const selectedBranch = branchName === ALL_BRANCHES
    ? null
    : targetedBranches.find((branch) => branch.name === branchName) ?? null;
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
    () => [...new Set(postpayPeople.map((person) => person.position))].sort(),
    [],
  );
  const scopedPeople = useMemo(() => postpayPeople.filter((person) =>
    branchName === ALL_BRANCHES || person.shopName === branchName), [branchName]);
  const filteredPeople = useMemo(() => {
    const query = personSearch.trim().toLocaleLowerCase("th-TH");
    return scopedPeople.filter((person) => {
      const matchesPosition = positionFilter === ALL_POSITIONS || person.position === positionFilter;
      const matchesSearch = !query || `${person.name} ${person.id} ${person.shopName}`.toLocaleLowerCase("th-TH").includes(query);
      return matchesPosition && matchesSearch;
    });
  }, [scopedPeople, personSearch, positionFilter]);
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

  const reset = () => {
    setProduct("Device");
    setBranchName(ALL_BRANCHES);
    setDateFilter(ALL_DAYS);
    setCaptureMode(false);
    setPersonSearch("");
    setPositionFilter(ALL_POSITIONS);
  };

  const toggleCaptureMode = () => {
    if (!captureMode) setBranchName(ALL_BRANCHES);
    setCaptureMode((current) => !current);
  };

  return (
    <main className={captureMode ? "capture-mode" : ""} style={{ "--product": theme.color, "--product-soft": theme.accent } as React.CSSProperties}>
      <header className="hero" data-sync-source={syncSource}>
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> BMAV-CENTRAL • DAILY SALES</div>
          <h1>Product<br />Performance <em>Monitor</em></h1>
          <p>Dashboard ยอดขายรายวัน (Device/GIA : Data TSM, Post/TOL : Data Link Daily Sales)</p>
        </div>
        <div className="hero-focus">
          <span>PRODUCT IN FOCUS</span>
          <strong>{product}</strong>
          <small>{branchName === ALL_BRANCHES ? `${targetedBranches.length} สาขาที่มี Target` : shortShop(branchName)} • {syncSource === "sheet" ? "Google Sheet Live" : "ข้อมูลสำรอง"}</small>
        </div>
      </header>

      <section className="control-deck" aria-label="ตัวกรอง Dashboard">
        <div className="product-switch" role="group" aria-label="เลือก Product">
          {productNames.map((name) => <button key={name} className={product === name ? "active" : ""} onClick={() => setProduct(name)}>
            <i style={{ background: productMeta[name].color }}>{productMeta[name].short}</i><span>{name}{name === "TrueOnline" ? " (QTY)" : ""}</span>
          </button>)}
        </div>
        <label><span>สาขา</span><select value={branchName} onChange={(event) => setBranchName(event.target.value)}><option>{ALL_BRANCHES}</option>{targetedBranches.map((branch) => <option key={branch.name}>{branch.name}</option>)}</select></label>
        <label><span>เลือกวันที่</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value={ALL_DAYS}>ทุกวัน (ยอดสะสมถึง {String(asOfDay).padStart(2, "0")} {shortMonth})</option>{Array.from({ length: asOfDay }, (_, index) => <option key={index + 1} value={String(index + 1)}>เฉพาะวันที่ {String(index + 1).padStart(2, "0")} {shortMonth} {asOfDate.getFullYear()}</option>)}</select></label>
        <button className="reset" onClick={reset}>ล้างตัวกรอง</button>
      </section>

      <section className="scope-strip">
        <div><span>มุมมองปัจจุบัน</span><strong>{product} • {branchName}</strong></div>
        <div><span>ช่วงวันที่</span><strong>{isDailyView ? `เฉพาะวันที่ ${String(periodDay).padStart(2, "0")} ${monthYear}` : `ทุกวัน • สะสมถึง ${String(asOfDay).padStart(2, "0")} ${monthYear}`}</strong></div>
        <div><span>หลักการคำนวณ</span><strong>เฉพาะ {product} เท่านั้น{isQtyProduct ? " • มุม QTY" : ""}</strong></div>
      </section>

      <section className="kpi-grid" aria-label="KPI ของ Product ที่เลือก">
        <article className="kpi hero-kpi"><span>{isDailyView ? `ยอดวันที่ ${String(periodDay).padStart(2, "0")} ${shortMonth}` : "ยอดสะสม MTD"}</span><strong>{displayValue(metrics.mtd)}</strong><small>{isDailyView ? "ยอดเฉพาะวันที่เลือก" : `ยอดวันที่ ${String(asOfDay).padStart(2, "0")} ${shortMonth} ${displayValue(metrics.today)}`}</small></article>
        <article className="kpi"><span>Target</span><strong>{displayValue(metrics.target)}</strong><small>เฉลี่ย {displayValue(metrics.dailyTarget)} / วัน</small></article>
        <article className="kpi"><span>%ACH</span><strong>{percent(metrics.achievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.achievement * 100)}%` }} /></div></article>
        <article className={`kpi pace ${status(metrics.pace).key}`}><span>{isDailyView ? "ACH Daily" : "ACH MTD"}</span><strong>{percent(metrics.pace)}</strong><small>{status(metrics.pace).label}</small></article>
        <article className="kpi runrate-kpi"><span>Runrate</span><strong>{displayValue(metrics.runrate)}</strong><small>จาก {isQtyProduct ? "RR QTY" : "RR Net Amount"} ในไฟล์ต้นฉบับ</small></article>
        <article className="kpi"><span>Runrate % เทียบเป้า</span><strong>{percent(metrics.runrateAchievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.runrateAchievement * 100)}%` }} /></div></article>
        <article className={`kpi mom-kpi ${momTone(metrics.mom)}`}><span>%MOM</span><strong>{momPercent(metrics.mom)}</strong><small>Runrate เทียบ July Actual {displayValue(metrics.julyActual)}</small></article>
        <article className="kpi"><span>Forecast สิ้นเดือน</span><strong>{displayValue(metrics.forecast)}</strong><small>{percent(metrics.target ? metrics.forecast / metrics.target : 0)} ของเป้า</small></article>
        <article className="kpi"><span>Gap ถึงเป้าเดือน</span><strong>{displayValue(Math.max(0, metrics.target - metrics.mtd))}</strong><small>ยอดที่ยังต้องปิด</small></article>
      </section>

      <section className="executive-grid">
        <article className="panel insight-panel">
          <div className="section-head"><div><span>PRODUCT INTELLIGENCE</span><h2>Executive Infographic</h2></div><b>{product} • {isDailyView ? `วันที่ ${periodDay}` : `สะสม ${asOfDay} วัน`}</b></div>
          <div className="insight-grid">
            <div className="insight major"><i>01</i><div><span>ภาพรวม Product</span><strong>%Achieve {percent(metrics.pace)}</strong><p>ทำได้ {displayValue(metrics.mtd)} จากเป้าที่ควรได้ {displayValue(metrics.targetMtd)}</p></div></div>
            <div className="insight"><i>02</i><div><span>Shop Top Ranking</span><strong>{leader ? shortShop(leader.name) : "—"}</strong><p>{leader ? `%Achieve ${percent(leader.pace)} • ${displayValue(leader.mtd)}` : "ยังไม่มีเป้าหมาย"}</p></div></div>
            <div className="insight"><i>03</i><div><span>On Track</span><strong>{onTrack.length} สาขา</strong><p>{activeBranches.length ? `${Math.round(onTrack.length / activeBranches.length * 100)}% ของสาขาที่มีเป้า` : "ไม่มีสาขาที่มีเป้า"}</p></div></div>
            <div className="insight"><i>04</i><div><span>ต้องเร่ง</span><strong>{atRisk.length} สาขา</strong><p>%Achieve ต่ำกว่า 85% ของเป้าตามวัน</p></div></div>
          </div>
          <div className="product-lens">
            <div><span>PRODUCT EXECUTIVE LENS • {product}</span><strong>{productFocus.title}</strong><p>{productFocus.description}</p></div>
            <div className="lens-kpis">
              <div><small>สถานะเทียบแผน</small><b>{planSignal}</b></div>
              <div><small>Top 3 Contribution</small><b>{percent(topThreeShare)}</b></div>
              <div><small>ต้องปิดต่อวัน</small><b>{displayValue(requiredPerDay)}</b></div>
              <div><small>%MOM เทียบ July</small><b className={`mom-text ${momTone(metrics.mom)}`}>{momPercent(metrics.mom)}</b></div>
            </div>
            <p className="lens-action"><b>Management Action:</b> {productFocus.action}</p>
          </div>
        </article>

        <aside className="mission-card">
          <span>DAILY MISSION</span>
          <h2>{metrics.pace >= 1 ? "รักษาจังหวะเหนือเป้า" : "เร่งปิด Gap รายวัน"}</h2>
          <div className="mission-number"><small>เป้าต่อวัน</small><strong>{displayValue(metrics.dailyTarget)}</strong></div>
          <ul>
            <li><b>วันนี้</b><span>{displayValue(metrics.today)} • {percent(metrics.dailyTarget ? metrics.today / metrics.dailyTarget : 0)}</span></li>
            <li><b>Runrate</b><span>{displayValue(metrics.runrate)} • {percent(metrics.runrateAchievement)}</span></li>
            <li><b>%MOM</b><span>{momPercent(metrics.mom)} • July {displayValue(metrics.julyActual)}</span></li>
            <li><b>Forecast</b><span>{displayValue(metrics.forecast)}</span></li>
            <li><b>Priority</b><span>{atRisk[0] ? shortShop(atRisk[0].name) : "รักษาทุกสาขา"}</span></li>
          </ul>
        </aside>
      </section>

      {branchExecutive && selectedBranch && <section className="panel branch-analysis">
        <div className="section-head"><div><span>BRANCH EXECUTIVE ANALYSIS</span><h2>{shortShop(selectedBranch.name)} • {product}</h2></div><b>สะสมถึง {String(asOfDay).padStart(2, "0")} {shortMonth}</b></div>
        <div className="branch-summary">
          <div><span>EXECUTIVE SIGNAL</span><strong>{branchExecutive.pace >= 1 ? "สาขาเดินหน้าเหนือแผน" : branchExecutive.pace >= .85 ? "สาขาใกล้แผน ต้องคุมยอดปิด" : "สาขาต่ำกว่าแผน ต้องเร่งทันที"}</strong></div>
          <p>ยอดสะสม {displayValue(branchExecutive.mtd)} • %ACH {percent(branchExecutive.achievement)} • ACH MTD {percent(branchExecutive.pace)}</p>
        </div>
        <div className="branch-analysis-grid">
          <article><span>ตำแหน่งปัจจุบัน</span><strong>ACH MTD {percent(branchExecutive.pace)}</strong><small>{status(branchExecutive.pace).label} เทียบ Target MTD</small></article>
          <article><span>วันที่ทำยอดสูงสุด</span><strong>{branchExecutive.bestDay ? `วันที่ ${String(branchExecutive.bestDay).padStart(2, "0")}` : "ยังไม่มียอด"}</strong><small>{displayValue(branchExecutive.bestValue)} • มียอด {branchExecutive.activeDays}/{asOfDay} วัน</small></article>
          <article><span>ภารกิจปิด Gap</span><strong>{displayValue(branchExecutive.requiredDaily)} / วัน</strong><small>Gap คงเหลือ {displayValue(branchExecutive.gap)}</small></article>
          <article><span>Outlook สิ้นเดือน</span><strong>{displayValue(branchExecutive.forecast)}</strong><small>Runrate {percent(branchExecutive.runrateAchievement)} • %MOM {momPercent(branchExecutive.mom)}</small></article>
        </div>
        <div className="branch-action"><span>ข้อเสนอแนะสำหรับสาขา</span><p>{branchExecutive.pace >= 1 ? `รักษาจังหวะ ${product} ให้ต่อเนื่อง และใช้วันที่ทำยอดสูงสุดเป็นต้นแบบการปิดยอด` : `${productFocus.action} สาขานี้ต้องทำเพิ่มเฉลี่ย ${displayValue(branchExecutive.requiredDaily)} ต่อวันในวันที่เหลือ`}</p></div>
      </section>}

      {product === "Postpay" && <section className="panel people-performance">
        <div className="section-head people-head"><div><span>POSTPAY • PEOPLE PERFORMANCE</span><h2>Performance รายบุคคล</h2><p>Data as of 07/08/2026 • Detailed Performance แยกจากยอดระดับสาขา</p></div><b>{branchName === ALL_BRANCHES ? "ทุกสาขา" : shortShop(branchName)} • {filteredPeople.length} คน</b></div>
        <div className="people-kpis">
          <article><span>พนักงานในมุมมอง</span><strong>{filteredPeople.length} คน</strong><small>{peopleWithTarget.length} คนที่มี Target</small></article>
          <article><span>Actual ถึง 07 Aug</span><strong>{money(personTotals.actual)}</strong><small>%ACH {percent(personActualAchievement)}</small></article>
          <article><span>Actual-RR</span><strong>{money(personTotals.actualRunrate)}</strong><small>RR ACH {percent(personRunrateAchievement)}</small></article>
          <article><span>Top RR Ranking</span><strong>{topPerson ? topPerson.name : "—"}</strong><small>{topPerson ? `${percent(topPerson.runrateAchievement)} • ${shortShop(topPerson.shopName)}` : "ไม่พบข้อมูล"}</small></article>
        </div>
        <div className="people-insight-row">
          <div className="people-distribution">
            <div className="ontrack"><span>On Track</span><strong>{peopleOnTrack.length}</strong><small>RR ACH ≥ 100%</small></div>
            <div className="watch"><span>Watch</span><strong>{peopleWatch.length}</strong><small>RR ACH 85–99.9%</small></div>
            <div className="atrisk"><span>At Risk</span><strong>{peopleAtRisk.length}</strong><small>RR ACH ต่ำกว่า 85%</small></div>
          </div>
          <div className="people-executive-note"><span>EXECUTIVE TAKEAWAY</span><strong>{peopleOnTrack.length >= peopleAtRisk.length ? "กำลังหลักส่วนใหญ่เดินหน้าได้ตามแผน" : "ต้องเร่ง Coaching รายบุคคลในกลุ่ม At Risk"}</strong><p>{peopleAtRisk.length ? `มี ${peopleAtRisk.length} คนต่ำกว่า 85% ของ RR Target ควรเริ่มจากผู้ที่ Actual ยังต่ำและมี Gap สูง` : "รักษาจังหวะการปิดยอดและถอดบทเรียนจาก Top RR Ranking"}</p></div>
        </div>
        <div className="people-controls">
          <label><span>ค้นหาพนักงาน / ID / สาขา</span><input value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} placeholder="พิมพ์ชื่อ รหัส หรือสาขา" /></label>
          <label><span>ตำแหน่ง</span><select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}><option>{ALL_POSITIONS}</option>{personPositions.map((position) => <option key={position}>{position}</option>)}</select></label>
        </div>
        <div className="people-table-wrap"><table className="people-table"><thead><tr><th>Rank</th><th>พนักงาน</th><th>ตำแหน่ง</th><th>สาขา</th><th>Target</th><th>Actual</th><th>Actual-RR</th><th>% RR ACH</th><th>อายุงาน</th><th>สถานะ</th></tr></thead><tbody>
          {filteredPeople.map((person, index) => {
            const personStatus = person.target > 0 ? status(person.runrateAchievement) : { key: "notarget", label: "No Target" };
            return <tr key={`${person.id}-${person.name}`}><td><b>{String(index + 1).padStart(2, "0")}</b></td><td><strong>{person.name}</strong><small>ID {person.id || "—"}</small></td><td>{person.position}</td><td>{shortShop(person.shopName)}</td><td>{money(person.target)}</td><td><b>{money(person.actual)}</b></td><td>{money(person.actualRunrate)}</td><td><strong className={`rr-percent ${personStatus.key}`}>{percent(person.runrateAchievement)}</strong></td><td>{person.tenure}</td><td><span className={`status ${personStatus.key}`}>{personStatus.label}</span></td></tr>;
          })}
          {!filteredPeople.length && <tr><td colSpan={10} className="people-empty">ไม่พบข้อมูลตามตัวกรองที่เลือก</td></tr>}
        </tbody></table></div>
        <div className="people-source-note"><b>หมายเหตุ:</b> Target, Actual, Actual-RR และ % RR ACH ส่วนรายบุคคลมาจาก detailed_performance_table.csv ณ 07/08/2026 โดยตรง จึงแยกชุดคำนวณจาก Postpay ระดับสาขาที่อัปเดตถึง 08/08/2026</div>
      </section>}

      <section className="two-col">
        <article className="panel trend-panel">
          <div className="section-head"><div><span>DAILY TREND</span><h2>ยอดรายวัน • {product}</h2></div><b>เส้นประ = เป้าเฉลี่ย/วัน</b></div>
          <div className="daily-chart" style={{ "--target-level": `${100 - targetLevel}%` } as React.CSSProperties}>
            <div className="target-line"><span>{displayValue(metrics.dailyTarget)}</span></div>
            {metrics.daily.map((value, index) => <div className={`day-bar ${index + 1 > asOfDay ? "future" : ""} ${isDailyView && index + 1 !== selectedDay ? "not-selected" : ""} ${isDailyView && index + 1 === selectedDay ? "selected" : ""}`} key={index} title={`วันที่ ${index + 1}: ${displayValue(value)}`}>
              <i style={{ height: `${Math.max(value > 0 ? 4 : 0, value / maxDaily * 100)}%` }} /><span>{index + 1}</span>
            </div>)}
          </div>
        </article>

        <article className="panel ranking-panel">
          <div className="section-head"><div><span>SHOP RANKING</span><h2>Ranking Shop</h2></div><b>{activeBranches.length} สาขาที่มี Target</b></div>
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
        <div className="section-head"><div><span>BRANCH MONITOR</span><h2>{product} Performance by Branch</h2></div><div className="table-actions"><b>หน่วย: บาท • {isDailyView ? `เฉพาะวันที่ ${String(periodDay).padStart(2, "0")} Aug` : "ยอดสะสมทุกวัน"}</b><button className="capture-toggle" onClick={toggleCaptureMode}>{captureMode ? "กลับ Dashboard" : "ดูครบทุกสาขา / Copy รูป"}</button></div></div>
        <div className="table-wrap"><table><thead><tr><th>สาขา</th><th>{isDailyView ? `ยอดวันที่ ${String(periodDay).padStart(2, "0")}` : "ยอด MTD"}</th><th>Target</th><th>%ACH</th><th>{isDailyView ? "Target Daily" : "Target MTD"}</th><th>{isDailyView ? "ACH Daily" : "ACH MTD"}</th><th>Runrate</th><th>Runrate %</th><th>%MOM</th><th>Forecast</th><th>สถานะ</th></tr></thead>
          <tbody>{branchPerformance.map((branch) => {
            const currentStatus = status(branch.pace);
            return <tr key={branch.name}><td><strong>{shortShop(branch.name)}</strong><small>{branch.ww ? `WW ${branch.ww}` : "รอรหัสสาขา"}</small></td><td><b>{displayValue(branch.mtd)}</b><small>{isDailyView ? "เฉพาะวันที่เลือก" : `วันที่ ${String(asOfDay).padStart(2, "0")} ${shortMonth} ${displayValue(branch.today)}`}</small></td><td>{displayValue(branch.target)}</td><td>{percent(branch.target ? branch.mtd / branch.target : 0)}</td><td>{displayValue(branch.targetMtd)}</td><td><strong>{percent(branch.pace)}</strong></td><td><b className="rr-value">{displayValue(branch.runrate)}</b></td><td><strong className={`rr-percent ${status(branch.runrateAchievement).key}`}>{percent(branch.runrateAchievement)}</strong></td><td><strong className={`mom-cell ${momTone(branch.mom)}`}>{momPercent(branch.mom)}</strong></td><td>{displayValue(branch.forecast)}</td><td><span className={`status ${currentStatus.key}`}>{currentStatus.label}</span></td></tr>;
          })}</tbody></table></div>
      </section>

      <section className="method-note"><div><strong>หลักการแยก Product</strong><p>ทุก KPI, กราฟ, อันดับ และตารางคำนวณจาก Product ที่เลือกเพียงรายการเดียว พร้อมซ่อนสาขาที่ไม่มี Target ของ Product นั้น</p></div><div><strong>Runrate จากไฟล์ต้นฉบับ</strong><p>ใช้ค่า {isQtyProduct ? "RR QTY สำหรับ TOL" : "RR Net Amount"} แยกตาม Product และสาขา • Runrate % = Runrate ÷ Target รายเดือน</p></div></section>
      <footer><span>BMAV-Central Product Performance Monitor</span><b>Source: 8778 Aug 2026 V1.xlsx • As of {String(asOfDay).padStart(2, "0")} {shortMonth} {asOfDate.getFullYear()}</b></footer>
    </main>
  );
}
