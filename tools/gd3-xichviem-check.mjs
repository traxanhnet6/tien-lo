// GD3 supplementary check — the agy2 finisher's map-gate fix applied
// to this tree (target selection / skill-hit helpers carry NO map
// gates; inspectSkills reports G.boss.id): a skill cast must damage a
// real monster on the xichviem map, in LOCAL mode and in ONLINE mode.
// (On the pre-fix helpers, casts on xichviem animated but could never
// select or hit a target.) Real touch input; state read via hooks.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { writeFileSync, appendFileSync, mkdirSync, rmSync, existsSync, readdirSync, openSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = "/home/hatch/workspace/game-tien-lo-gd3/";
const OUT = join(ROOT, "proof/gd3-verify");
mkdirSync(OUT, { recursive: true });
const LPORT = 19100 + (process.pid % 150);
const SPORT = 19650 + (process.pid % 150);
const CDP = 19750 + (process.pid % 150);
const VW = 390, VH = 844;
const LOGF = join(OUT, "gd3-xichviem-check.log");
writeFileSync(LOGF, "");
let failures = 0;
function log(...a) { const s = a.join(" "); console.log(s); try { appendFileSync(LOGF, s + "\n"); } catch {} }
function check(name, cond, extra = "") { log(cond ? "PASS" : "FAIL", name, extra); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// static server for the LOCAL phase (no GD3 server involved at all)
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const staticServer = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  try { const data = readFileSync(join(ROOT, p)); res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); res.end(data); }
  catch { res.writeHead(404); res.end("nf"); }
});
await new Promise(r => staticServer.listen(LPORT, r));

// GD3 server for the ONLINE phase
const serverLogF = join(OUT, "gd3-xichviem-server.log");
writeFileSync(serverLogF, "");
const server = spawn("node", [join(ROOT, "server/server.mjs")],
  { env: { ...process.env, TL_PORT: String(SPORT) }, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", d => appendFileSync(serverLogF, d));
server.stderr.on("data", d => appendFileSync(serverLogF, d));
process.on("exit", () => { try { server.kill("SIGKILL"); } catch {} try { process.kill(-chrome.pid, "SIGKILL"); } catch {} staticServer.close(); });
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(`http://127.0.0.1:${SPORT}/index.html`); if (r.ok) break; } catch {}
  await sleep(250);
}
log("servers up: static", LPORT, "gd3", SPORT);

// ---- CDP plumbing (same team pattern as gd3-online-harness)
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
const PROFILE = "/home/hatch/workspace/.gd3xv-profile-" + process.pid;
rmSync(PROFILE, { recursive: true, force: true });
const chromeErrFd = openSync(join(OUT, "gd3xv-chrome-stderr.log"), "w");
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
async function tapEl(sel) {
  const c = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  if (!c) throw new Error("element not found " + sel);
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: Math.round(c.x), y: Math.round(c.y), id: 1 }] });
  await sleep(50);
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(60);
}
async function shot(name) {
  const r = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 90000);
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
  log("shot:", name);
}
async function dismissDialogue() {
  for (let i = 0; i < 6; i++) {
    const open = await ev("Gameplay.getQuestState().dialogueOpen").catch(() => false);
    if (!open) return;
    await tapEl("#dialogueAdvanceBtn").catch(() => {});
    await sleep(350);
  }
}
const monsterExpr = `(() => { const m = Gameplay.inspectCombat().monsters.find(m => m.id === "mon_hoatinh_1"); return m ? JSON.stringify(m) : null; })()`;
async function castAndMeasure(label) {
  await ev("Gameplay.teleportTo(750, 640)"); // 50px west of mon_hoatinh_1 anchor (800,640)
  await sleep(700);
  const before = JSON.parse(await ev(monsterExpr));
  log(`${label}: mon_hoatinh_1 before hp=${before.hp}/${before.maxHp}`);
  await tapEl("#btnSkill2"); // Kim Cang Quyền — single-target, range 160
  let after = null;
  for (let i = 0; i < 24; i++) {
    await sleep(250);
    const m = JSON.parse(await ev(monsterExpr));
    if (m && m.hp < before.hp) { after = m; break; }
  }
  return { before, after };
}

// ================= LOCAL phase =================
await cdp("Page.navigate", { url: `http://127.0.0.1:${LPORT}/?map=xichviem` });
check("local xichviem: game ready", !!(await until("window.Gameplay && Gameplay.isReady()", 45000)));
check("local xichviem: NOT online (no ?online param)", (await ev("window.TLNET && TLNET.connected()")) === false);
await dismissDialogue();
const loc = await castAndMeasure("LOCAL");
check("LOCAL: SK2 cast damages mon_hoatinh_1 on xichviem (map-gate fix active)",
  !!loc.after && loc.after.hp < loc.before.hp, `hp ${loc.before.hp} -> ${loc.after && loc.after.hp}`);
const mpLoc = await ev("Gameplay.inspectCombat().playerMp");
check("LOCAL: mana charged for the cast (42 + up to ~3 regen ticks)", mpLoc >= 42 && mpLoc <= 45, `mp=${mpLoc}`);
await shot("gd3_xichviem_local.png");

// ================= ONLINE phase =================
await cdp("Page.navigate", { url: `http://127.0.0.1:${SPORT}/?map=xichviem&online&pname=XichViem` });
check("online xichviem: game ready + connected", !!(await until("window.Gameplay && Gameplay.isReady() && window.TLNET && TLNET.connected()", 45000)));
await dismissDialogue();
const onl = await castAndMeasure("ONLINE");
check("ONLINE: SK2 cast damages mon_hoatinh_1 on xichviem (server-applied)",
  !!onl.after && onl.after.hp < onl.before.hp, `hp ${onl.before.hp} -> ${onl.after && onl.after.hp}`);
const sawAccept = await ev(`TLNET.state().eventLog.some(e => e.kind === "cast_result" && e.data.ok === true && e.data.skill_id === "sk_kimcang_quyen")`);
check("ONLINE: server accepted the cast intent (cast_result ok in client log)", sawAccept === true);
const mpOnl = await ev("Gameplay.inspectCombat().playerMp");
check("ONLINE: mana charged by server (42 + server regen since)", mpOnl >= 42 && mpOnl <= 45, `mp=${mpOnl}`);
await shot("gd3_xichviem_online.png");

check("no page exceptions", exceptions.length === 0, exceptions.slice(0, 2).join(" | "));
log(failures === 0 ? "ALL XICHVIEM CHECKS PASS" : `${failures} CHECK(S) FAILED`);
server.kill("SIGKILL");
try { process.kill(-chrome.pid, "SIGKILL"); } catch {}
process.exit(failures === 0 ? 0 : 1);
