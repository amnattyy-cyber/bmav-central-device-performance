import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PERSON_CSV_URLS, personPerformanceFromCsv } from "../app/google-person-data.ts";

const outputs = {
  Device: "../app/device-person-performance.json",
  GIA: "../app/gia-person-performance.json",
  Postpay: "../app/postpay-person-performance.json",
  TrueOnline: "../app/tol-person-performance.json",
};

for (const [product, relativePath] of Object.entries(outputs)) {
  const response = await fetch(`${PERSON_CSV_URLS[product]}&_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${product} download failed: ${response.status}`);
  const data = personPerformanceFromCsv(await response.text(), product);
  await writeFile(fileURLToPath(new URL(relativePath, import.meta.url)), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`${product}: ${data.people.length} people as of ${data.meta.asOf}`);
}
