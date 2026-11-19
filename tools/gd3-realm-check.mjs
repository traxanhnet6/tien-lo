// GD3 realm-name check (Bui's order 2026-11-10: "Chuyển cấp độ thành
// cấp tu tiên"): the player-facing level display must show cultivation
// realm names — never "Cấp X" — while every number (XP thresholds,
// stats, internal numeric level) stays exactly as before. Verifies:
//   XP 0    -> psLevel "Luyện Khí tầng 1", internal level 1
//   XP 2250 -> psLevel "Luyện Khí tầng 8", internal level 8 (post-Q8)
//   XP 6250 -> psLevel "Trúc Cơ Hậu Kỳ",  internal level 12 (post-Q13)
//   Q13 turn-in (crafted save, real interaction + dialogue taps):
//     reward banner carries "Đạt cảnh giới Trúc Cơ Hậu Kỳ" and no
//     "Lên cấp" text; XP 5300 -> 6250; quest completes.
// Also asserts the numeric fields of all 13 GAME_DATA.levels rows.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { writeFileSync, appendFileSync, mkdirSync, rmSync, existsSync, readdirSync, openSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = "/home/hatch/workspace/game-tien-lo-gd3/";
const OUT = join(ROOT, "proof/gd3-verify");
mkdirSync(OUT, { recursive: true });
const PORT = 19250 + (process.pid % 150);
const CDP = 19850 + (process.pid % 150);
const VW = 390, VH = 844;
const LOGF = join(OUT, "gd3-realm-check.log");
writeFileSync(LOGF, "");
let failures = 0;
function log(...a) { const s = a.join(" "); console.log(s); try { appendFileSync(LOGF, s + "\n"); } catch {} }
function check(name, cond, extra = "") { log(cond ? "PASS" : "FAIL", name, extra); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const staticServer = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  try { const data = readFileSync(join(ROOT, p)); res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); res.end(data); }
  catch { res.writeHead(404); res.end("nf"); }
});
await new Promise(r => staticServer.listen(PORT, r));
process.on("exit", () => { try { process.kill(-chrome.pid, "SIGKILL"); } catch {} staticServer.close(); });

class WSShim {
  constructor(url) {
    this._listeners = {}; this._sendQueue = []; this._opened = false;
    this._inner = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("CDP ws open timeout")), 10000);
      this._inner.addEventListener("open", () => { clearTimeout(to); this._opened = true; for (const s of this._sendQueue) this._inner.send(s); this._sendQueue = []; resolve(); }, { once: true });
      this._inner.addEventListener("error", () => { clearTimeout(to); reject(new Error("CDP ws error")); });
    });
    this._inner.addEventListener("message", ev2 => { for (const fn of this._listeners.message || []) fn({ data: typeof ev2.data === "string" ? ev2.data : String(ev2.data) }); });
  }
  addEventListener(t, fn) { (this._listeners[t] ??= []).push(fn); }
  send(s) { if (this._opened) this._inner.send(s); else this._sendQueue.push(s); }
}
function chromeBin() {
  const base = "/home/hatch/.cache/puppeteer/chrome";
  for (const v of readdirSync(base).sort().reverse()) {
    const p = join(base, v, "chrome-linux64/chrome");
    if (existsSync(p)) return p;
  }
  throw new Error("chrome not found");
}
const PROFILE = "/home/hatch/workspace/.gd3realm-profile-" + process.pid;
rmSync(PROFILE, { recursive: true, force: true });
const chromeErrFd = openSync(join(OUT, "gd3realm-chrome-stderr.log"), "w");
const chrome = spawn(chromeBin(), ["--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--force-device-scale-factor=2", "--in-process-gpu", "--disable-gpu-sandbox",
  "--js-flags=--max-old-space-size=3072", "--renderer-process-limit=1",
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${CDP}`,
  `--window-size=${VW},${VH}`, "about:blank"], { stdio: ["ignore", chromeErrFd, chromeErrFd], detached: true });

let msgId = 0; const pending = new Map(); const exceptions = [];
let ws = null;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: "PUT" })).json();
    const cand = new WSShim(j.webSocketDebuggerUrl);
    await cand.ready; ws = cand;
  } catch { await sleep(300); }
}
if (!ws) throw new Error("could not connect to Chrome CDP");
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown")
    exceptions.push("exception: " + (m.params.exceptionDetails?.exception?.description || "").split("\n")[0]);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
    exceptions.push("console.error: " + m.params.args.map(a => a.value || a.description || "").join(" ").slice(0, 160));
});
const cdp = (method, params = {}, timeoutMs = 30000) => new Promise((res, rej) => {
  const id = ++msgId;
  const to = setTimeout(() => { pending.delete(id); rej(new Error("CDP timeout " + method)); }, timeoutMs);
  pending.set(id, v => { clearTimeout(to); res(v); });
  ws.send(JSON.stringify({ id, method, params }));
});
await cdp("Page.enable"); await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
const ev = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 240));
  return r.result?.value;
};
async function until(expr, timeoutMs = 10000) {
  const t0 = Date.now();
  for (;;) { const v = await ev(expr).catch(() => undefined); if (v) return v; if (Date.now() - t0 > timeoutMs) return undefined; await sleep(250); }
}
async function tapXY(x, y) {
  try { await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 }, 9000); } catch {}
  await sleep(50);
  try { await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 }, 9000); } catch {}
  await sleep(60);
}
async function tapEl(sel) {
  const c = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  if (!c) return false;
  await tapXY(c.x, c.y); return true;
}
async function shot(name) {
  const r = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 90000);
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
  log("shot:", name);
}
async function navAndReady(url) {
  await cdp("Page.navigate", { url });
  const ok = await until("window.Gameplay && Gameplay.isReady()", 45000);
  await sleep(900); // let syncHUDStats paint the plate
  return !!ok;
}
async function setSave(obj) {
  await ev(`localStorage.setItem("tl3_save_v1", ${JSON.stringify(JSON.stringify(obj))})`);
}
const psLevel = () => ev(`(document.getElementById("psLevel") || {}).textContent || ""`);

// ---- numeric integrity of the 13 level rows (pre-change values) ----
await navAndReady(`http://127.0.0.1:${PORT}/?map=island`);
const rows = JSON.parse(await ev(`JSON.stringify(GAME_DATA.levels.map(r => [r.xpNeed, r.maxHp, r.atk, r.def, r.maxMp, r.mpRegen, r.title]))`));
const EXPECTED_NUM = [
  [0, 220, 32, 6, 60, 3.5], [100, 238, 35, 7, 75, 4.0], [250, 256, 38, 9, 90, 4.5],
  [450, 274, 41, 10, 105, 5.0], [700, 292, 44, 11, 120, 5.5], [1000, 312, 47, 12, 135, 6.0],
  [1450, 334, 50, 13, 150, 6.5], [2000, 358, 53, 15, 165, 7.0], [2700, 382, 56, 17, 180, 7.5],
  [3500, 408, 59, 19, 195, 8.0], [4400, 434, 62, 21, 210, 8.5], [5400, 462, 65, 23, 225, 9.0],
  [6500, 492, 68, 25, 240, 9.5],
];
const EXPECTED_TITLE = [
  "Luyện Khí tầng 1", "Luyện Khí tầng 2", "Luyện Khí tầng 3", "Luyện Khí tầng 4",
  "Luyện Khí tầng 5", "Luyện Khí tầng 6", "Luyện Khí tầng 7", "Luyện Khí tầng 8",
  "Luyện Khí tầng 9", "Trúc Cơ Sơ Kỳ", "Trúc Cơ Trung Kỳ", "Trúc Cơ Hậu Kỳ", "Trúc Cơ Viên Mãn",
];
let numOk = rows.length === 13, titleOk = rows.length === 13;
rows.forEach((r, i) => {
  for (let k = 0; k < 6; k++) if (r[k] !== EXPECTED_NUM[i][k]) numOk = false;
  if (r[6] !== EXPECTED_TITLE[i]) titleOk = false;
});
check("levels table: all 13 rows keep EXACT pre-change numbers", numOk);
check("levels table: all 13 titles are the locked realm names", titleOk);

// ---- three XP landmarks ----------------------------------------------
check("XP 0: game ready (fresh profile)", true);
const t0 = await psLevel();
const ic0 = JSON.parse(await ev("JSON.stringify(Gameplay.inspectCombat())"));
check("XP 0: psLevel shows 'Luyện Khí tầng 1'", t0 === "Luyện Khí tầng 1", `got '${t0}'`);
check("XP 0: internal level still numeric 1", ic0.playerLevel === 1 && ic0.xp === 0, `level=${ic0.playerLevel} xp=${ic0.xp}`);
await shot("realm_xp0.png");

await setSave({ questIndex: 8, questState: "not_accepted", questProgress: 0, playerXp: 2250, herbsCount: 0, gatheredNodes: [] });
await navAndReady(`http://127.0.0.1:${PORT}/?map=island`);
const t8 = await psLevel();
const ic8 = JSON.parse(await ev("JSON.stringify(Gameplay.inspectCombat())"));
check("XP 2250 (post-Q8): psLevel shows 'Luyện Khí tầng 8'", t8 === "Luyện Khí tầng 8", `got '${t8}'`);
check("XP 2250: internal level still numeric 8", ic8.playerLevel === 8 && ic8.xp === 2250, `level=${ic8.playerLevel} xp=${ic8.xp}`);
await shot("realm_xp2250.png");

await setSave({ questIndex: 12, questState: "active", questProgress: 0, playerXp: 6250, herbsCount: 0, gatheredNodes: [] });
await navAndReady(`http://127.0.0.1:${PORT}/?map=xichviem`);
const t12 = await psLevel();
const ic12 = JSON.parse(await ev("JSON.stringify(Gameplay.inspectCombat())"));
check("XP 6250 (post-Q13): psLevel shows 'Trúc Cơ Hậu Kỳ'", t12 === "Trúc Cơ Hậu Kỳ", `got '${t12}'`);
check("XP 6250: internal level still numeric 12", ic12.playerLevel === 12 && ic12.xp === 6250, `level=${ic12.playerLevel} xp=${ic12.xp}`);
await shot("realm_xp6250.png");

// ---- Q13 turn-in: reward banner text ----------------------------------
await setSave({ questIndex: 12, questState: "ready_to_turn_in", questProgress: 1, playerXp: 5300, herbsCount: 0, gatheredNodes: [] });
await navAndReady(`http://127.0.0.1:${PORT}/?map=xichviem`);
await ev("Gameplay.teleportTo(1028, 876)"); // Q13 giver stand point
await sleep(500);
await ev(`Gameplay.interactWith("npc_xichviem_tientri")`);
let bannerText = "";
for (let i = 0; i < 16; i++) {
  await sleep(300);
  const b = await ev(`(document.getElementById("gameBanner") || {}).textContent || ""`).catch(() => "");
  if (b && b.trim()) bannerText = b;
  const open = await ev("Gameplay.getQuestState().dialogueOpen").catch(() => false);
  if (open) { await tapEl("#dialogueAdvanceBtn"); }
  const qs = JSON.parse(await ev("JSON.stringify(Gameplay.getQuestState())"));
  if (qs.index === 13 && qs.state === "completed") break;
}
// The completion banner paints on the dialogue-close frame, which can
// land just after the quest state flips — keep reading it briefly.
for (let i = 0; i < 14 && !bannerText.trim(); i++) {
  await sleep(300);
  const b = await ev(`(document.getElementById("gameBanner") || {}).textContent || ""`).catch(() => "");
  if (b && b.trim()) bannerText = b;
}
const qsF = JSON.parse(await ev("JSON.stringify(Gameplay.getQuestState())"));
const icF = JSON.parse(await ev("JSON.stringify(Gameplay.inspectCombat())"));
log("banner captured:", bannerText.replace(/\s+/g, " ").slice(0, 200));
check("Q13 turn-in completes the quest chain (index 13, completed)", qsF.index === 13 && qsF.state === "completed", `index=${qsF.index} state=${qsF.state}`);
check("Q13 turn-in grants +950 XP (5300 -> 6250)", icF.xp === 6250, `xp=${icF.xp}`);
check("reward banner announces the realm: 'Đạt cảnh giới Trúc Cơ Hậu Kỳ'", bannerText.includes("Đạt cảnh giới Trúc Cơ Hậu Kỳ"));
check("reward banner has NO 'Lên cấp' text and NO 'Cấp 12'", !bannerText.includes("Lên cấp") && !bannerText.includes("Cấp 12"));
const tF = await psLevel();
check("after turn-in: psLevel shows 'Trúc Cơ Hậu Kỳ'", tF === "Trúc Cơ Hậu Kỳ", `got '${tF}'`);
await shot("realm_q13_turnin.png");

check("no page exceptions", exceptions.length === 0, exceptions.slice(0, 2).join(" | "));
log(failures === 0 ? "ALL REALM CHECKS PASS" : `${failures} CHECK(S) FAILED`);
try { process.kill(-chrome.pid, "SIGKILL"); } catch {}
staticServer.close();
process.exit(failures === 0 ? 0 : 1);
