import { writeFile } from "node:fs/promises";
import { dashboardDataFromCsv, GOOGLE_SHEET_CSV_URL } from "../app/google-sheet-data.ts";

const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&_=${Date.now()}`, { cache: "no-store" });
if (!response.ok) throw new Error(`Google Sheet request failed: ${response.status}`);

const data = dashboardDataFromCsv(await response.text());
await writeFile(new URL("../app/sales-product-data.json", import.meta.url), `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(`Updated sales fallback: ${data.meta.month} as of ${data.meta.asOf} • ${data.branches.length} branches`);

