import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

const SEARCH_URL = process.env.ACF_SEARCH_URL || "https://www.avoncityford.com/vehicles/search";
const OUTPUT_FILE = resolve(process.env.ACF_BROWSER_OUTPUT || "cache/acf-current.html");
const PROFILE_DIR = resolve(process.env.ACF_BROWSER_PROFILE || "browser-profile");
const VISIBLE = process.env.ACF_BROWSER_VISIBLE === "1";
const MIN_CARDS = Number(process.env.MIN_INVENTORY_CARDS || "40");
const PORT_FILE = resolve(PROFILE_DIR, "DevToolsActivePort");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
].filter(Boolean);

async function firstExisting(paths) {
  for (const path of paths) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // Try the next known Chrome path.
    }
  }
  return "";
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function waitForPortFile(timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const [port, browserPath] = (await readFile(PORT_FILE, "utf8")).trim().split(/\r?\n/);
      if (port && browserPath) return `ws://127.0.0.1:${port}${browserPath}`;
    } catch {
      // Chrome has not written its connection file yet.
    }
    await wait(250);
  }
  throw new Error("Chrome did not start its updater connection in time.");
}

class CdpConnection {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolveOpen, rejectOpen) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", rejectOpen, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolveRequest, rejectRequest } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) rejectRequest(new Error(message.error.message));
      else resolveRequest(message.result || {});
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId;
    this.nextId += 1;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;

    return new Promise((resolveRequest, rejectRequest) => {
      this.pending.set(id, { resolveRequest, rejectRequest });
      this.socket.send(JSON.stringify(message));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  }, sessionId);
  return result.result?.value;
}

async function main() {
  const chromePath = await firstExisting(CHROME_CANDIDATES);
  if (!chromePath) throw new Error("Google Chrome was not found.");

  await mkdir(PROFILE_DIR, { recursive: true });
  await rm(PORT_FILE, { force: true });

  const args = [
    `--user-data-dir=${PROFILE_DIR}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,900"
  ];
  if (!VISIBLE) args.push("--start-minimized");

  const chrome = spawn(chromePath, args, { stdio: "ignore" });
  let cdp;

  try {
    const browserUrl = await waitForPortFile();
    cdp = new CdpConnection(browserUrl);
    await cdp.open();

    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Page.navigate", { url: SEARCH_URL }, sessionId);

    const timeout = Date.now() + 120000;
    let cardCount = 0;
    while (Date.now() < timeout) {
      cardCount = Number(await evaluate(cdp, sessionId, "document.querySelectorAll('article.gw-product-card').length")) || 0;
      if (cardCount >= MIN_CARDS) break;
      await wait(1500);
    }

    if (cardCount < MIN_CARDS) {
      throw new Error(`Only ${cardCount} ACF cards loaded. Run windows/first-run.ps1 and complete any browser verification shown by the website.`);
    }

    await wait(2000);
    const html = await evaluate(cdp, sessionId, "document.documentElement.outerHTML");
    if (!html) throw new Error("Chrome did not return the ACF inventory HTML.");

    await mkdir(dirname(OUTPUT_FILE), { recursive: true });
    await writeFile(OUTPUT_FILE, html, "utf8");
    console.log(JSON.stringify({ inventory_cards: cardCount, output: OUTPUT_FILE }, null, 2));

    await cdp.send("Browser.close");
  } finally {
    if (cdp) cdp.close();
    await wait(500);
    if (!chrome.killed) chrome.kill();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
