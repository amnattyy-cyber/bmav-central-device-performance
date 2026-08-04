"use client";

import { useEffect, useMemo, useState } from "react";
import fallbackData from "./sales-product-data.json";
import { type Branch, type DashboardData, loadGoogleSheetData, type ProductName } from "./google-sheet-data";

const ALL_BRANCHES = "à¸—à¸¸à¸à¸ªà¸²à¸‚à¸²";
const ALL_DAYS = "all";
const productMeta: Record<ProductName, { color: string; accent: string; short: string }> = {
  Device: { color: "#2563eb", accent: "#dbeafe", short: "DEV" },
  GIA: { color: "#8e44ad", accent: "#f3e8ff", short: "GIA" },
  Postpay: { color: "#f59e0b", accent: "#fef3c7", short: "POST" },
  TrueOnline: { color: "#00a8e8", accent: "#cffafe", short: "TOL" },
};

const money = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
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
    [product],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const sync = async () => {
      try {
        const nextData = await loadGoogleSheetData(controller.signal);
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
    return { target, daily, mtd, today, targetMtd, pace, forecast, achievement, runrate, runrateAchievement, dailyTarget: target / data.meta.daysInMonth };
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
    return { ...branch, target: item.target, mtd, targetMtd, pace, forecast, runrate: item.runrate, runrateAchievement, today: item.daily[periodDay - 1] ?? 0 };
  }).filter((branch) => branchName === ALL_BRANCHES || branch.name === branchName)
    .sort((a, b) => b.pace - a.pace), [targetedBranches, product, branchName, isDailyView, periodDay, periodDays]);

  const activeBranches = branchPerformance.filter((branch) => branch.target > 0);
  const onTrack = activeBranches.filter((branch) => branch.pace >= 1);
  const atRisk = activeBranches.filter((branch) => branch.pace < .85);
  const leader = activeBranches[0];
  const maxPace = Math.max(1, ...activeBranches.map((branch) => branch.pace));
  const maxDaily = Math.max(metrics.dailyTarget, ...metrics.daily.slice(0, asOfDay), 1);
  const targetLevel = Math.min(96, (metrics.dailyTarget / maxDaily) * 100);

  const reset = () => {
    setProduct("Device");
    setBranchName(ALL_BRANCHES);
    setDateFilter(ALL_DAYS);
    setCaptureMode(false);
  };

  const toggleCaptureMode = () => {
    if (!captureMode) setBranchName(ALL_BRANCHES);
    setCaptureMode((current) => !current);
  };

  return (
    <main className={captureMode ? "capture-mode" : ""} style={{ "--product": theme.color, "--product-soft": theme.accent } as React.CSSProperties}>
      <header className="hero" data-sync-source={syncSource}>
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> BMAV-CENTRAL â€¢ DAILY SALES</div>
          <h1>Product<br />Performance <em>Monitor</em></h1>
          <p>Dashboard à¸¢à¸­à¸”à¸‚à¸²à¸¢à¸£à¸²à¸¢à¸§à¸±à¸™ (Device/GIA : Data TSM, Post/TOL : Data Link Daily Sales)</p>
        </div>
        <div className="hero-focus">
          <span>PRODUCT IN FOCUS</span>
          <strong>{product}</strong>
          <small>{branchName === ALL_BRANCHES ? `${targetedBranches.length} à¸ªà¸²à¸‚à¸²à¸—à¸µà¹ˆà¸¡à¸µ Target` : shortShop(branchName)} â€¢ {syncSource === "sheet" ? "Google Sheet Live" : "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¸£à¸­à¸‡"}</small>
        </div>
      </header>

      <section className="control-deck" aria-label="à¸•à¸±à¸§à¸à¸£à¸­à¸‡ Dashboard">
        <div className="product-switch" role="group" aria-label="à¹€à¸¥à¸·à¸­à¸ Product">
          {productNames.map((name) => <button key={name} className={product === name ? "active" : ""} onClick={() => setProduct(name)}>
            <i style={{ background: productMeta[name].color }}>{productMeta[name].short}</i><span>{name}{name === "TrueOnline" ? " (QTY)" : ""}</span>
          </button>)}
        </div>
        <label><span>à¸ªà¸²à¸‚à¸²</span><select value={branchName} onChange={(event) => setBranchName(event.target.value)}><option>{ALL_BRANCHES}</option>{targetedBranches.map((branch) => <option key={branch.name}>{branch.name}</option>)}</select></label>
        <label><span>à¹€à¸¥à¸·à¸­à¸à¸§à¸±à¸™à¸—à¸µà¹ˆ</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value={ALL_DAYS}>à¸—à¸¸à¸à¸§à¸±à¸™ (à¸¢à¸­à¸”à¸ªà¸°à¸ªà¸¡à¸–à¸¶à¸‡ {String(asOfDay).padStart(2, "0")} {shortMonth})</option>{Array.from({ length: asOfDay }, (_, index) => <option key={index + 1} value={String(index + 1)}>à¹€à¸‰à¸žà¸²à¸°à¸§à¸±à¸™à¸—à¸µà¹ˆ {String(index + 1).padStart(2, "0")} {shortMonth} {asOfDate.getFullYear()}</option>)}</select></label>
        <button className="reset" onClick={reset}>à¸¥à¹‰à¸²à¸‡à¸•à¸±à¸§à¸à¸£à¸­à¸‡</button>
      </section>

      <section className="scope-strip">
        <div><span>à¸¡à¸¸à¸¡à¸¡à¸­à¸‡à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™</span><strong>{product} â€¢ {branchName}</strong></div>
        <div><span>à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆ</span><strong>{isDailyView ? `à¹€à¸‰à¸žà¸²à¸°à¸§à¸±à¸™à¸—à¸µà¹ˆ ${String(periodDay).padStart(2, "0")} ${monthYear}` : `à¸—à¸¸à¸à¸§à¸±à¸™ â€¢ à¸ªà¸°à¸ªà¸¡à¸–à¸¶à¸‡ ${String(asOfDay).padStart(2, "0")} ${monthYear}`}</strong></div>
        <div><span>à¸«à¸¥à¸±à¸à¸à¸²à¸£à¸„à¸³à¸™à¸§à¸“</span><strong>à¹€à¸‰à¸žà¸²à¸° {product} à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™{isQtyProduct ? " â€¢ à¸¡à¸¸à¸¡ QTY" : ""}</strong></div>
      </section>

      <section className="kpi-grid" aria-label="KPI à¸‚à¸­à¸‡ Product à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸">
        <article className="kpi hero-kpi"><span>{isDailyView ? `à¸¢à¸­à¸”à¸§à¸±à¸™à¸—à¸µà¹ˆ ${String(periodDay).padStart(2, "0")} ${shortMonth}` : "à¸¢à¸­à¸”à¸ªà¸°à¸ªà¸¡ MTD"}</span><strong>{displayValue(metrics.mtd)}</strong><small>{isDailyView ? "à¸¢à¸­à¸”à¹€à¸‰à¸žà¸²à¸°à¸§à¸±à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸" : `à¸¢à¸­à¸”à¸§à¸±à¸™à¸—à¸µà¹ˆ ${String(asOfDay).padStart(2, "0")} ${shortMonth} ${displayValue(metrics.today)}`}</small></article>
        <article className="kpi"><span>Target</span><strong>{displayValue(metrics.target)}</strong><small>à¹€à¸‰à¸¥à¸µà¹ˆà¸¢ {displayValue(metrics.dailyTarget)} / à¸§à¸±à¸™</small></article>
        <article className="kpi"><span>%ACH</span><strong>{percent(metrics.achievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.achievement * 100)}%` }} /></div></article>
        <article className={`kpi pace ${status(metrics.pace).key}`}><span>{isDailyView ? "ACH Daily" : "ACH MTD"}</span><strong>{percent(metrics.pace)}</strong><small>{status(metrics.pace).label}</small></article>
        <article className="kpi runrate-kpi"><span>Runrate</span><strong>{displayValue(metrics.runrate)}</strong><small>à¸ˆà¸²à¸ {isQtyProduct ? "RR QTY" : "RR Net Amount"} à¹ƒà¸™à¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸‰à¸šà¸±à¸š</small></article>
        <article className="kpi"><span>Runrate % à¹€à¸—à¸µà¸¢à¸šà¹€à¸›à¹‰à¸²</span><strong>{percent(metrics.runrateAchievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.runrateAchievement * 100)}%` }} /></div></article>
        <article className="kpi"><span>Forecast à¸ªà¸´à¹‰à¸™à¹€à¸”à¸·à¸­à¸™</span><strong>{displayValue(metrics.forecast)}</strong><small>{percent(metrics.target ? metrics.forecast / metrics.target : 0)} à¸‚à¸­à¸‡à¹€à¸›à¹‰à¸²</small></article>
        <article className="kpi"><span>Gap à¸–à¸¶à¸‡à¹€à¸›à¹‰à¸²à¹€à¸”à¸·à¸­à¸™</span><strong>{displayValue(Math.max(0, metrics.target - metrics.mtd))}</strong><small>à¸¢à¸­à¸”à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸•à¹‰à¸­à¸‡à¸›à¸´à¸”</small></article>
      </section>

      <section className="executive-grid">
        <article className="panel insight-panel">
          <div className="section-head"><div><span>PRODUCT INTELLIGENCE</span><h2>Executive Infographic</h2></div><b>{product} â€¢ {isDailyView ? `à¸§à¸±à¸™à¸—à¸µà¹ˆ ${periodDay}` : `à¸ªà¸°à¸ªà¸¡ ${asOfDay} à¸§à¸±à¸™`}</b></div>
          <div className="insight-grid">
            <div className="insight major"><i>01</i><div><span>à¸ à¸²à¸žà¸£à¸§à¸¡ Product</span><strong>%Achieve {percent(metrics.pace)}</strong><p>à¸—à¸³à¹„à¸”à¹‰ {displayValue(metrics.mtd)} à¸ˆà¸²à¸à¹€à¸›à¹‰à¸²à¸—à¸µà¹ˆà¸„à¸§à¸£à¹„à¸”à¹‰ {displayValue(metrics.targetMtd)}</p></div></div>
            <div className="insight"><i>02</i><div><span>Shop Top Ranking</span><strong>{leader ? shortShop(leader.name) : "â€”"}</strong><p>{leader ? `%Achieve ${percent(leader.pace)} â€¢ ${displayValue(leader.mtd)}` : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸›à¹‰à¸²à¸«à¸¡à¸²à¸¢"}</p></div></div>
            <div className="insight"><i>03</i><div><span>On Track</span><strong>{onTrack.length} à¸ªà¸²à¸‚à¸²</strong><p>{activeBranches.leçž{¶‰žËkºwµçLØÌ°(€€€€€€‰ÁÉ½‘ÕÑÌˆèì(€€€€€€€€‰•Ù¥”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÄÌÀÈÀÄä¸ÔÀäääääääà°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€ÈÈÜÀÀ°(€€€€€€€€€€€€äÐä°(€€€€€€€€€€€€ÔÜØÜÀ°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ØÌÀÈÈÈ¸ÈÔ(€€€€€€€ô°(€€€€€€€€‰%ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÄÐäÈÐÄ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€ÄääÀ°(€€€€€€€€€€€€ÌäØà°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÐØÄÜÐ¸Ô(€€€€€€€ô°(€€€€€€€€‰A½ÍÑÁ…äˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€àÌäàä¸ÄÈàÀÐÐØÔàÐ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€ÌÌÌÄ°(€€€€€€€€€€€€ÄÔäÜ°(€€€€€€€€€€€€Ìää°(€€€€€€€€€€€€Üäà(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÐÜÐØà¸ÜÔ(€€€€€€€ô°(€€€€€€€€‰QÉÕ•=¹±¥¹”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€Äà¸ÜàÔØÌÄÜÐÈÈÀäÌÌ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€Ä°(€€€€€€€€€€€€Ä°(€€€€€€€€€€€€À°(€€€€€€€€€€€€È(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÌÄ(€€€€€€€ô(€€€€€ô(€€€ô°(€€€ì(€€€€€€‰¹…µ”ˆè€‰QÉÕ”M¡½ÀMÑ…Ñ¥½¸1½ÑÕÌÌI…µ„€Ðˆ°(€€€€€€‰Ñ‘Ìˆè€àÀÀÀÀÈÐÜ°(€€€€€€‰ÝÜˆè€àÀÄÀÀÜÈä°(€€€€€€‰ÁÉ½‘ÕÑÌˆèì(€€€€€€€€‰•Ù¥”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÐÜäàÀÔ¸ÄÜääääääää°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€ÜÜÄÐÀ°(€€€€€€€€€€€€ÄØÐÀÀ°(€€€€€€€€€€€€ÈØÌÀÀ°(€€€€€€€€€€€€ÈÀÌÈÜ(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÄÀàØÈäÐ¸ÈÔ(€€€€€€€ô°(€€€€€€€€‰%ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÜØÔÌÀ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô°(€€€€€€€€‰A½ÍÑÁ…äˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€äàØä¸ØäÀÄØÄäÈääÀÐ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€Øää°(€€€€€€€€€€€€À°(€€€€€€€€€€€€ÌÀÀ°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÜÜÐÈ¸ÈÔ(€€€€€€€ô°(€€€€€€€€‰QÉÕ•=¹±¥¹”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€È¸ØÔÀÜÌÌÌÄÌÌÄÜààÀà°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô(€€€€€ô(€€€ô°(€€€ì(€€€€€€‰¹…µ”ˆè€‰QÉÕ”-¥½Í¬Q¡”¥¡ÐQ¡½¹±½Èˆ°(€€€€€€‰Ñ‘Ìˆè€àÀÀÀÀÄÐÔ°(€€€€€€‰ÝÜˆè€àÀÄÀÄÈÀÄ°(€€€€€€‰ÁÉ½‘ÕÑÌˆèì(€€€€€€€€‰•Ù¥”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€À°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô°(€€€€€€€€‰%ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€À°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô°(€€€€€€€€‰A½ÍÑÁ…äˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€À°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô°(€€€€€€€€‰QÉÕ•=¹±¥¹”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€À°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô(€€€€€ô(€€€ô°(€€€ì(€€€€€€‰¹…µ”ˆè€‰QÉÕ”M¡½ÀT¡Ô1¥…¹œ	Õ¥±‘¥¹œˆ°(€€€€€€‰Ñ‘Ìˆè€àÀÀÀÀÀÄÄ°(€€€€€€‰ÝÜˆè€àÀÄÀÄÌÐÜ°(€€€€€€‰ÁÉ½‘ÕÑÌˆèì(€€€€€€€€‰•Ù¥”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÈäØÀÄÈ¸Àà°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô°(€€€€€€€€‰%ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÐÐàØÈ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô°(€€€€€€€€‰A½ÍÑÁ…äˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€À°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô°(€€€€€€€€‰QÉÕ•=¹±¥¹”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€À°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô(€€€€€ô(€€€ô°(€€€ì(€€€€€€‰¹…µ”ˆè€‰-¥½Í¬1½ÑÕÌÌI…µ¥¹‘É„ˆ°(€€€€€€‰Ñ‘Ìˆè€àÀÄÀÄØÌÀ°(€€€€€€‰ÝÜˆè€àÀÄÀÄØÌÀ°(€€€€€€‰ÁÉ½‘ÕÑÌˆèì(€€€€€€€€‰•Ù¥”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ØÄÄØÀÈ¸ÀÀääääääää°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€ÈÐàÀÀ°(€€€€€€€€€€€€Èää°(€€€€€€€€€€€€ÈÄÈäà(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÌÔäÔÜØ¸ÜÔ(€€€€€€€ô°(€€€€€€€€‰%ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÄÌÔÜØÔ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€ÌÈä°(€€€€€€€€€€€€ÄÌØä°(€€€€€€€€€€€€À°(€€€€€€€€€€€€àÈÜ(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÄäÔØà¸ÜÔ(€€€€€€€ô°(€€€€€€€€‰A½ÍÑÁ…äˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÄÀÐÔÀ¸ÈØÀÄÜÄÐÔÔÄäÄ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€Äää°(€€€€€€€€€€€€Ðää(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÔÐÀä¸Ô(€€€€€€€ô°(€€€€€€€€‰QÉÕ•=¹±¥¹”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€È¸ÐÈÀÈÌÐÜØÐÌÌÌÜÄÜÐ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€À(€€€€€€€ô(€€€€€ô(€€€ô°(€€€ì(€€€€€€‰¹…µ”ˆè€‰QÉÕ”M¡½ÀMÕÁÉ•µ”½µÁ±•à€¡¤ˆ°(€€€€€€‰Ñ‘Ìˆè€àÀÄÀÄØØÜ°(€€€€€€‰ÝÜˆè€àÀÄÀÄØØÜ°(€€€€€€‰ÁÉ½‘ÕÑÌˆèì(€€€€€€€€‰•Ù¥”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÄÐÐÀÐØÜ¸àÀØÐÐÜÀÔàÔ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€ÔÄäØ°(€€€€€€€€€€€€ÈÐÜÀÀ°(€€€€€€€€€€€€Üää°(€€€€€€€€€€€€Üää(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÈÐÐÀÜà¸Ô(€€€€€€€ô°(€€€€€€€€‰%ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÈÀàÌÀ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€ØÜÀ°(€€€€€€€€€€€€ÔÄØÀ°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÐÔÄàÈ¸Ô(€€€€€€€ô°(€€€€€€€€‰A½ÍÑÁ…äˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÐÌÜàÈ¸ÈÐäÌÔàÈÜØÌÀÔ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€Ìää°(€€€€€€€€€€€€Ôää°(€€€€€€€€€€€€äÐà(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€ÄÔÀàÄ¸Ô(€€€€€€€ô°(€€€€€€€€‰QÉÕ•=¹±¥¹”ˆèì(€€€€€€€€€€‰Ñ…É•Ðˆè€ÈÈ¸äÔØÄÈäÀÐÌàÈÈààÐ°(€€€€€€€€€€‰‘…¥±äˆèl(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€À°(€€€€€€€€€€€€Ä(€€€€€€€€€t°(€€€€€€€€€€‰ÉÕ¹É…Ñ”ˆè€Ü¸ÜÔ(€€€€€€€ô(€€€€€ô(€€€ô(€t)ô