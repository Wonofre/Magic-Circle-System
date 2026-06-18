import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

const port = 4199;
const baseUrl = `http://127.0.0.1:${port}`;
const viteBin = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
const browserCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) => existsSync(candidate));

if (!executablePath) {
  throw new Error("Chrome or Edge was not found. Set CHROME_PATH to run the browser smoke test.");
}

const server = spawn(
  process.execPath,
  [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  {
    cwd: process.cwd(),
    stdio: "ignore",
    windowsHide: true,
  },
);

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for Vite preview.");
};

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const assetResponses = [];
  const failedResponses = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("glyph-recognizer-v1") || url.includes("/ort/")) {
      assetResponses.push({ url, status: response.status() });
    }
    if (response.status() >= 400) {
      failedResponses.push({ url, status: response.status() });
    }
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(5_000);

  const requiredFragments = [
    "/models/glyph-recognizer-v1/metadata.json",
    "/models/glyph-recognizer-v1/model.onnx",
    "/ort/ort-wasm-simd-threaded.wasm",
  ];
  for (const fragment of requiredFragments) {
    const response = assetResponses.find((entry) => entry.url.includes(fragment));
    if (!response || response.status !== 200) {
      throw new Error(`Missing successful ML asset response for ${fragment}.`);
    }
  }
  if (failedResponses.length > 0) {
    throw new Error(`Browser smoke saw failed responses: ${JSON.stringify(failedResponses)}`);
  }

  console.log(JSON.stringify({ ok: true, assetResponses }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
