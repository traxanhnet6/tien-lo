// LAYOUT01 repro/verify harness: opens the skill panel, measures the
// geometry of every .skill-row (main-column width, name line count,
// actions placement) at top / mid / bottom scroll positions, before and
// after a slot swap, and screenshots each state. Real touch input only;
// game state is read, teleportTo used only for staging.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync, existsSync, readdirSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";

const ROOT = "/home/hatch/workspace/game-tien-lo-hud2/";
const OUT = "/home/hatch/workspace/game-tien-lo-hud2/proof/layout01-verify";
mkdirSync(OUT, { recursive: true });
const PORT = 13400 + (process.pid % 300), CDP = 13800 + (process.pid % 300);
const VW = 390, VH = 844;
const PHASE = process.argv[2] || "before"; // before | after

const LOGF = join(OUT, `layout01-${PHASE}.log`);
try { writeFileSync(LOGF, ""); } catch {}
function log(...a) { const line = a.join(" "); console.log(line); try { appendFileSync(LOGF, line + "\n"); } catch {} }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  try {
    const data = readFileSync(join(ROOT, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise(r => server.listen(PORT, r));

function chromeBin() {
  const base = "/home/hatch/.cache/puppeteer/chrome";
  for (const v of readdirSync(base).sort().reverse()) {
    const p = join(base, v, "chrome-linux64/chrome");
    if (existsSync(p)) return p;
  }
  throw new Error("chrome not found");
}
class WSShim {
  constructor(url) {
    this._listeners = {}; this._sendQueue = []; this._opened = false;
    this._inner = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("CDP websocket open timeout (10s)")), 10000);
      this._inner.addEventListener("open", () => {
        clearTimeout(to); this._opened = true;
        for (const s of this._sendQueue) this._inner.send(s);
        this._sendQueue = []; this._emit("open", {}); resolve();
      }, { once: true });
      this._inner.addEventListener("error", ev2 => {
        clearTimeout(to);
        const err = new Error("CDP websocket error: " + ((ev2 && ev2.message) || "unknown"));
        reject(err); this._emit("error", err);
      });
    });
    this._inner.addEventListener("close", () => this._emit("close", {}));
    this._inner.addEventListener("message", ev2 =>
      this._emit("message", { data: typeof ev2.data === "string" ? ev2.data : String(ev2.data) }));
  }
  _emit(type, event) { for (const fn of this._listeners[type] || []) fn(event); }
  addEventListener(type, fn) {
    (this._listeners[type] ??= []).push(fn);
    if (type === "open" && this._opened) queueMicrotask(() => fn({}));
  }
  send(s) { if (this._opened) this._inner.send(s); else this._sendQueue.push(s); }
}

const PROFILE = "/home/hatch/workspace/.layout01-profile-" + process.pid;
rmSync(PROFILE, { recursive: true, force: true });
const chromeErrFd = openSync(join(OUT, `chrome-stderr-${PHASE}.log`), "w");
const chrome = spawn(chromeBin(), ["--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--no-sandbox", "--disable-dev-shm-usage",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding", "--force-device-scale-factor=2",
  "--in-process-gpu", "--disable-gpu-sandbox", "--js-flags=--max-old-space-size=3072",
  "--renderer-process-limit=1",
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${CDP}`,
  `--window-size=${VW},${VH}`, "about:blank"], { stdio: ["ignore", chromeErrFd, chromeErrFd] });
process.on("exit", () => { try { process.kill(-chrome.pid, "SIGKILL"); } catch {} try { chrome.kill("SIGKILL"); } catch {} });

let ws = null, lastConnErr = null;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: "PUT" })).json();
    const cand = new WSShim(j.webSocketDebuggerUrl);
    await cand.ready;
    ws = cand;
  } catch (e) { lastConnErr = e; await sleep(300); }
}
if (!ws) throw new Error("could not connect to Chrome CDP: " + ((lastConnErr && lastConnErr.message) || lastConnErr));
let msgId = 0; const pending = new Map();
const exceptions = [];
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") {
    exceptions.push("exception: " + (m.params.exceptionDetails?.exception?.description || "").split("\n")[0]);
  }
});
const cdp = (method, params = {}, timeoutMs = 15000) => new Promise((res, rej) => {
  const id = ++msgId;
  const to = setTimeout(() => { pending.delete(id); rej(new Error("CDP call timeout: " + method)); }, timeoutMs);
  pending.set(id, v => { clearTimeout(to); res(v); });
  ws.send(JSON.stringify({ id, method, params }));
});
await cdp("Page.enable");
await cdp("Runtime.enable");
const ev = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result?.value;
};
async function shot(name) {
  const r = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 90000);
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
  log("shot:", name);
}
async function touchTap(x, y) {
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
  await sleep(50);
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(60);
}
async function elCenter(selector) {
  const r = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null; const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; })()`);
  if (!r) throw new Error("element not found: " + selector);
  return r;
}
async function tapEl(selector) { const c = await elCenter(selector); await touchTap(c.x, c.y); }
async function waitFor(fn, timeoutMs, label, pollMs = 200) {
  const t0 = Date.now(); let last;
  while (Date.now() - t0 < timeoutMs) {
    try { last = await fn(); } catch { last = null; }
    if (last) return last;
    await sleep(pollMs);
  }
  throw new Error("timeout waiting: " + label);
}

const MEASURE = `(() => {
  const card = document.querySelector(".skill-panel-card");
  const rows = [...document.querySelectorAll(".skill-row")].map(row => {
    const main = row.querySelector(".skill-row-main");
    const name = row.querySelector(".skill-row-name");
    const meta = row.querySelector(".skill-row-meta");
    const act = row.querySelector(".skill-row-actions");
    const rb = row.getBoundingClientRect(), mb = main.getBoundingClientRect(),
          nb = name.getBoundingClientRect(), ab = act.getBoundingClientRect(),
          tb = meta.getBoundingClientRect();
    const cs = getComputedStyle(main), ca = getComputedStyle(act), cr = getComputedStyle(row);
    return {
      id: row.dataset.skillId, slotted: row.classList.contains("slotted"),
      rowW: Math.round(rb.width), rowH: Math.round(rb.height),
      mainW: Math.round(mb.width), mainX: Math.round(mb.left - rb.left),
      nameH: Math.round(nb.height), metaH: Math.round(tb.height),
      actW: Math.round(ab.width), actRelTop: Math.round(ab.top - rb.top),
      mainRelTop: Math.round(mb.top - rb.top),
      flexMain: cs.flex, flexAct: ca.flex, wrapRow: cr.flexWrap,
      broken: mb.width < 150 || nb.height > 30
    };
  });
  return { scrollTop: Math.round(card.scrollTop), scrollH: card.scrollHeight,
           clientH: card.clientHeight, clientW: card.clientWidth, rows };
})()`;

function reportMeasure(tag, m) {
  log(`--- measure ${tag}: scrollTop=${m.scrollTop} scrollH=${m.scrollH} clientW=${m.clientW}`);
  for (const r of m.rows) {
    log(`  ${r.broken ? "BROKEN" : "ok    "} ${r.id.padEnd(20)} rowW=${r.rowW} rowH=${r.rowH} mainW=${r.mainW} nameH=${r.nameH} metaH=${r.metaH} actW=${r.actW} actTop=${r.actRelTop} mainTop=${r.mainRelTop} flexMain="${r.flexMain}" flexAct="${r.flexAct}" wrap=${r.wrapRow}`);
  }
  const broken = m.rows.filter(r => r.broken);
  log(`  => ${tag}: ${broken.length} broken rows${broken.length ? ": " + broken.map(r => r.id).join(",") : ""}`);
  return broken.length;
}

let totalBroken = 0;
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
await waitFor(async () => {
  try { return (await ev("window.TL2 && TL2.ready() && window.Gameplay && !!Gameplay.inspectSkills")) || null; }
  catch { return null; }
}, 60000, "game boot");
await cdp("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
await sleep(800);
// PHASE "prefix": simulate the pre-fix stylesheet by overriding the
// :has() rule back to the base flex:none behaviour, to prove the crush
// mechanism on the current tree before touching any file.
if (PHASE === "prefix") {
  await ev(`(() => { const s = document.createElement("style");
    s.textContent = ".skill-row-actions:has(.skill-assign-btn) { flex: none; justify-content: flex-end; margin-top: 0; }";
    document.head.appendChild(s); return "override injected"; })()`);
  log("pre-fix simulation: :has rule overridden to flex:none");
}
if (PHASE === "nowrap") {
  await ev(`(() => { const s = document.createElement("style");
    s.textContent = ".skill-row { flex-wrap: nowrap; }";
    document.head.appendChild(s); return "override injected"; })()`);
  log("ablation: .skill-row flex-wrap removed (nowrap)");
}
if (PHASE === "nowidth") {
  await ev(`(() => { const s = document.createElement("style");
    s.textContent = ".skill-row { flex-wrap: nowrap; } .skill-row-actions:has(.skill-assign-btn) { flex: none; justify-content: flex-end; margin-top: 0; }";
    document.head.appendChild(s); return "override injected"; })()`);
  log("ablation: nowrap + actions flex:none (full pre-fix guess)");
}
if (PHASE === "immune") {
  await ev(`(() => { const s = document.createElement("style");
    s.textContent = ".skill-row { flex-wrap: nowrap; }";
    document.head.appendChild(s); return "override injected"; })()`);
  log("immunity probe on FIXED tree: .skill-row forced nowrap (worst-case regression)");
}
// Stage at the quiet spot used by the HUD2 harness for panel work.
await ev("Gameplay.teleportTo(2405, 2425)");
await sleep(600);
await tapEl("#skillPanelBtn");
await waitFor(async () => (await ev(`document.querySelectorAll(".skill-row").length`)) === 10 || null, 15000, "panel rows");
await sleep(500);

// State 1: top of panel
await ev(`document.querySelector(".skill-panel-card").scrollTop = 0`);
await sleep(350);
totalBroken += reportMeasure("TOP", await ev(MEASURE));
await shot(`layout01_${PHASE}_top.png`);

// State 2: mid scroll, matching cluster_after_swap framing (Băng Phong row near top)
await ev(`(() => { const card = document.querySelector(".skill-panel-card");
  const row = document.querySelector('.skill-row[data-skill-id="sk_bangphong_chuong"]');
  card.scrollTop += row.getBoundingClientRect().top - card.getBoundingClientRect().top - 84;
  return card.scrollTop; })()`);
await sleep(350);
totalBroken += reportMeasure("MID", await ev(MEASURE));
await shot(`layout01_${PHASE}_mid.png`);

// State 3: bottom of panel
await ev(`(() => { const c = document.querySelector(".skill-panel-card"); c.scrollTop = c.scrollHeight; return c.scrollTop; })()`);
await sleep(350);
totalBroken += reportMeasure("BOTTOM", await ev(MEASURE));
await shot(`layout01_${PHASE}_bottom.png`);

// State 4: swap Lôi Đình Kích into SK2 (same state as cluster_after_swap),
// then back to the same mid framing.
await ev(`(() => { const card = document.querySelector(".skill-panel-card"); card.scrollTop = 0; return "ok"; })()`);
await sleep(300);
await ev(`document.querySelector('.skill-row[data-skill-id="sk_loidinh_kich"]').scrollIntoView({ block: "center" })`);
await sleep(350);
const btn = await elCenter('.skill-row[data-skill-id="sk_loidinh_kich"] .skill-assign-btn[data-slot="1"]');
await touchTap(btn.x, btn.y);
await sleep(600);
const slots = await ev(`Gameplay.inspectSkills().slots.join(",")`);
log("slots after swap:", slots);
await ev(`(() => { const card = document.querySelector(".skill-panel-card");
  const row = document.querySelector('.skill-row[data-skill-id="sk_bangphong_chuong"]');
  card.scrollTop += row.getBoundingClientRect().top - card.getBoundingClientRect().top - 84;
  return card.scrollTop; })()`);
await sleep(350);
totalBroken += reportMeasure("MID-AFTERSWAP", await ev(MEASURE));
await shot(`layout01_${PHASE}_mid_afterswap.png`);

log("exceptions:", exceptions.length ? exceptions.join(" | ") : "none");
log(`RESULT ${PHASE}: total broken-row sightings = ${totalBroken}`);
process.exit(0);
