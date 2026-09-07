import { chromium } from "@playwright/test";

const BASE = "http://localhost:8080";

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e}`));
page.on("request", (r) => logs.push(`REQ ${r.method()} ${r.url()}`));
page.on("response", (r) => logs.push(`RES ${r.status()} ${r.url()}`));

await page.goto(`${BASE}/postulaciones/nueva`);
const state = encodeURIComponent("abc123|/postulaciones/00000000-0000-0000-0000-000000000001");
await page.goto(`${BASE}/auth/gmail-callback?code=fake-code&state=${state}`);

await page.waitForTimeout(15000);
console.log("FINAL URL:", page.url());
console.log("LOGS:\n" + logs.join("\n"));
await browser.close();
