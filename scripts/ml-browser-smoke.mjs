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

const mlAssetPattern = /glyph-recognizer-v1|\/ort\//;
const requiredFragments = [
  "/models/glyph-recognizer-v1/metadata.json",
  "/models/glyph-recognizer-v1/model.onnx",
  "/ort/ort-wasm-simd-threaded.wasm",
];

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
    if (mlAssetPattern.test(url)) {
      assetResponses.push({ url, status: response.status(), phase: currentPhase });
    }
    if (response.status() >= 400) {
      failedResponses.push({ url, status: response.status() });
    }
  });

  let currentPhase = "menu_idle";
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(5_000);

  const menuMlRequests = assetResponses.filter((entry) => entry.phase === "menu_idle");
  if (menuMlRequests.length > 0) {
    throw new Error(
      `Menu should not eagerly load ML assets: ${JSON.stringify(menuMlRequests)}`,
    );
  }

  for (const fragment of requiredFragments) {
    const response = await page.request.get(`${baseUrl}${fragment}`);
    if (!response.ok()) {
      throw new Error(`ML asset is not deployable at ${fragment}: HTTP ${response.status()}`);
    }
  }

  currentPhase = "battle_idle";
  await page.getByRole("button", { name: /Iniciar Batalha/i }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(3_000);

  const battleMlRequests = assetResponses.filter((entry) => entry.phase === "battle_idle");
  if (battleMlRequests.length > 0) {
    throw new Error(
      `Battle screen should not load ML before the first cast: ${JSON.stringify(battleMlRequests)}`,
    );
  }

  if (failedResponses.length > 0) {
    throw new Error(`Browser smoke saw failed responses: ${JSON.stringify(failedResponses)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    menuMlRequests: menuMlRequests.length,
    battleMlRequests: battleMlRequests.length,
    deployableAssets: requiredFragments,
  }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}