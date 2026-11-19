// HUD2 harness (HUD2 wave 2026-11-10): verifies Phase 2 — the 10-skill
// panel, slot swapping (persisted in the save), casting a swapped skill
// by tap and by hold-drag aim, the aim cancel zone, Thiên Phong Bộ's
// self-dash, and the in-combat swap refusal. REAL input only (CDP touch
// at screen coordinates); game state is only READ via inspection hooks,
// teleportTo is used ONLY to stage scenarios.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync, existsSync, readdirSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";

const ROOT = "/home/hatch/workspace/game-tien-lo-gd3/";
const OUT = "/home/hatch/workspace/game-tien-lo-gd3/proof/hud2-verify";
mkdirSync(OUT, { recursive: true });
const PORT = 12400 + (process.pid % 300), CDP = 12800 + (process.pid % 300);
const VW = 390, VH = 844;

const LOG = [];
try { writeFileSync(join(OUT, "hud2-harness.log"), ""); } catch {}
function log(...a) {
  const line = a.join(" ");
  LOG.push(line);
  console.log(line);
  try { appendFileSync(join(OUT, "hud2-harness.log"), line + "\n"); } catch {}
}
let failures = 0;
function check(name, cond, extra = "") {
  log(cond ? "PASS" : "FAIL", name, extra);
  if (!cond) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
process.on("exit", () => { try { process.kill(-chrome.pid, "SIGKILL"); } catch {} });
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

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
    this._listeners = {};
    this._sendQueue = [];
    this._opened = false;
    this._inner = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("CDP websocket open timeout (10s)")), 10000);
      this._inner.addEventListener("open", () => {
        clearTimeout(to);
        this._opened = true;
        for (const s of this._sendQueue) this._inner.send(s);
        this._sendQueue = [];
        this._emit("open", {});
        resolve();
      }, { once: true });
      this._inner.addEventListener("error", ev2 => {
        clearTimeout(to);
        const err = new Error("CDP websocket error: " + ((ev2 && ev2.message) || "unknown"));
        reject(err);
        this._emit("error", err);
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

const PROFILE = "/home/hatch/workspace/.hud2b-profile-" + process.pid;
rmSync(PROFILE, { recursive: true, force: true });
const chromeErrFd = openSync(join(OUT, "chrome-stderr.log"), "w");
const chrome = spawn(chromeBin(), ["--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--no-sandbox", "--disable-dev-shm-usage",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding", "--force-device-scale-factor=2",
  "--in-process-gpu", "--disable-gpu-sandbox", "--js-flags=--max-old-space-size=3072",
  "--renderer-process-limit=1",
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${CDP}`,
  `--window-size=${VW},${VH}`, "about:blank"], { stdio: ["ignore", chromeErrFd, chromeErrFd] });
log("harness up; server on", PORT, "— connecting CDP…");
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
log("CDP connected");
ws.addEventListener("close", () => { try { log("FATAL: CDP websocket closed"); } catch {} process.exit(2); });
let msgId = 0; const pending = new Map();
const exceptions = [];
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") {
    exceptions.push("exception: " + (m.params.exceptionDetails?.text || "") + " " +
      (m.params.exceptionDetails?.exception?.description || "").split("\n")[0]);
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    exceptions.push("console.error: " + m.params.args.map(a => a.value || a.description || "").join(" ").slice(0, 200));
  }
});
const cdp = (method, params = {}, timeoutMs = 12000) => new Promise((res, rej) => {
  const id = ++msgId;
  const to = setTimeout(() => { pending.delete(id); rej(new Error("CDP call timeout: " + method)); }, timeoutMs);
  pending.set(id, v => { clearTimeout(to); res(v); });
  ws.send(JSON.stringify({ id, method, params }));
});
await cdp("Page.enable");
await cdp("Runtime.enable");
process.on("unhandledRejection", e => {
  log("HARNESS ERROR (unhandled):", String(e && e.message || e));
  try { writeFileSync(join(OUT, "hud2-harness.log"), LOG.join("\n") + "\n"); } catch {}
  try { process.kill(-chrome.pid, "SIGKILL"); } catch { try { chrome.kill("SIGKILL"); } catch {} }
  process.exit(2);
});
const ev = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result?.value;
};
async function shot(name) {
  const dims = await ev("window.innerWidth + 'x' + window.innerHeight");
  if (dims !== `${VW}x${VH}`) {
    await cdp("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
    await sleep(700);
  }
  const r = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 90000);
  const buf = Buffer.from(r.data, "base64");
  for (let i = 0; i < 2; i++) {
    try { writeFileSync(join(OUT, name), buf); log("shot:", name); return; }
    catch (e) { if (i === 1) log("shot FAILED (non-fatal):", name, e.code || e.message); else await sleep(1000); }
  }
}

async function touchTap(x, y) {
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
  await sleep(50);
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(60);
}
async function touchStart(x, y) {
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
}
async function touchMove(x, y) {
  await cdp("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
}
async function touchEnd() {
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function elCenter(selector) {
  const r = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null; const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; })()`);
  if (!r) throw new Error("element not found: " + selector);
  return r;
}
// Panel assign buttons live inside the card's own scroll area: scroll
// the button into the visible middle of the card before tapping, or
// the tap lands outside the viewport and silently does nothing.
async function tapPanelBtn(sel) {
  // wait for the button to exist (panel render is synchronous on open,
  // but under VM load a frame can lag); dump panel state if it never
  // appears so the failure is diagnosable from the log alone
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    found = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
    if (!found) await sleep(200);
  }
  if (!found) {
    const diag = await ev(`JSON.stringify({ open: window.Gameplay && Gameplay.inspectSkills ? Gameplay.inspectSkills().skillPanelOpen : "?", rows: document.querySelectorAll(".skill-row").length, overlay: document.querySelector("#skillPanel") ? getComputedStyle(document.querySelector("#skillPanel")).display : "none" })`).catch(() => "?");
    throw new Error("panel button never appeared: " + sel + " state=" + diag);
  }
  await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center" })`);
  await sleep(350);
  await tapEl(sel);
}
// The panel card scrolls as one piece, so after deep assign scrolls
// the header (and its close button) can sit above the viewport and a
// blind tap misses, leaving the overlay up to swallow later taps.
// Scroll the card back to the top before tapping close.
async function closePanel() {
  await ev(`(() => { const c = document.querySelector(".skill-panel-card"); if (c) c.scrollTop = 0; return "ok"; })()`);
  await sleep(300);
  await tapEl("#skillPanelClose");
  await sleep(300);
}
async function tapEl(selector) { const c = await elCenter(selector); await touchTap(c.x, c.y); }
async function state() { return ev("TL2.state()"); }
async function combat() { return ev("Gameplay.inspectCombat()"); }
async function skills() { return ev("Gameplay.inspectSkills()"); }
async function tapWorld(wx, wy) {
  const s = await state();
  const sx = VW / 2 + (wx - s.cam[0]) * s.zoom;
  const sy = VH / 2 + (wy - s.cam[1]) * s.zoom;
  await touchTap(Math.max(4, Math.min(VW - 4, sx)), Math.max(4, Math.min(VH - 4, sy)));
}
async function waitFor(fn, timeoutMs, label, pollMs = 200) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeoutMs) {
    try { last = await fn(); } catch { last = null; }
    if (last) return last;
    await sleep(pollMs);
  }
  throw new Error("timeout waiting: " + label);
}
async function settled() {
  let prev = null;
  for (let i = 0; i < 30; i++) {
    const s = await state();
    if (!s.moving && s.path === 0 && prev && Math.abs(s.x - prev.x) < 1 && Math.abs(s.y - prev.y) < 1) return s;
    prev = s;
    await sleep(200);
  }
  return state();
}
async function joyDrag(dx, dy, holdMs = 650) {
  const x0 = 60, y0 = 790;
  await touchStart(x0, y0);
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    await touchMove(x0 + dx * i / steps, y0 + dy * i / steps);
    await sleep(45);
  }
  await sleep(holdMs);
  const mid = await state();
  await touchEnd();
  return mid;
}
function monsterById(c, id) { return c.monsters.find(m => m.id === id); }
function freshMonster(c, key, excludeIds = []) {
  return c.monsters.find(m => m.key === key && !m.dead && m.hp === m.maxHp && !excludeIds.includes(m.id));
}
// Casts and aims are refused while the player is dead; combat staging
// can leave the player dead by the time a later step presses a button.
async function ensureAlive(label) {
  const c = await combat();
  if (!c.playerDead) return;
  log("player dead before", label, "- waiting for respawn");
  await waitFor(async () => ((await combat()).playerDead ? null : true), 20000, "respawn before " + label);
  await sleep(400);
}
async function castAndObserve(selector, skillId, shotName) {
  const frames = new Set();
  let castingSeen = false;
  let mpAtCast = null;
  await tapEl(selector);
  const t0 = Date.now();
  let shotTaken = false, recovered = false;
  while (Date.now() - t0 < 15000) {
    const sk = await skills();
    // GD3 load recovery (same adaptation as the HUD harness copy):
    // under heavy VM load a tap's release can stretch past the hold
    // threshold or get lost, leaving the press stuck aiming. Complete
    // the SAME real gesture once — tap the button again (a release
    // completes an aim; a fresh tap casts when nothing is held).
    if (!recovered && !castingSeen && Date.now() - t0 > 4000) {
      recovered = true;
      try { await tapEl(selector); } catch {}
    }
    if (sk.casting && sk.casting.skill === skillId) {
      if (!castingSeen) mpAtCast = (await combat()).playerMp;
      castingSeen = true;
      frames.add(sk.casting.frame);
      if (shotName && !shotTaken && sk.casting.frame >= 4) { await shot(shotName); shotTaken = true; }
    } else if (castingSeen) break;
    await sleep(70);
  }
  await waitFor(async () => {
    const sk = await skills();
    const s = sk.skills.find(x => x.id === skillId);
    return s && s.state === "cooldown" ? s : null;
  }, 8000, "cooldown after " + skillId).catch(() => null);
  return { castingSeen, frames: [...frames].sort((a, b) => a - b), mpAtCast };
}

// =============================================================== MAIN FLOW
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
await waitFor(async () => {
  try { return (await ev("window.TL2 && TL2.ready() && window.Gameplay && !!Gameplay.inspectSkills")) || null; }
  catch { return null; }
}, 30000, "game ready");
await cdp("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
await sleep(700);
await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }).catch(() => {});
await waitFor(async () => {
  const sk = await skills();
  return Object.values(sk.packsLoaded).every(Boolean) ? sk : null;
}, 120000, "all ten skill packs loaded");
{
  const sk = await skills();
  log("packs loaded:", JSON.stringify(sk.packsLoaded));
  check("all 10 skill packs loaded", Object.keys(sk.packsLoaded).length === 10);
  check("default slots are the spec §6.1 five",
    JSON.stringify(sk.slots) === JSON.stringify(["sk_thaicuc_chuong", "sk_kimcang_quyen", "sk_philong_cuoc", "sk_batquai_chuong", "ult_nguhanh_quyen"]),
    JSON.stringify(sk.slots));
}

// ---- A. Panel: open, 10 rows, swap Lôi Đình Kích into SK2 (at spawn,
// out of combat)
await settled();
await tapEl("#skillPanelBtn");
await sleep(500);
{
  const sk = await skills();
  check("skill panel opens", sk.skillPanelOpen === true);
  const rows = await ev("document.querySelectorAll('#skillPanelList .skill-row').length");
  check("panel lists all 10 skills", rows === 10, "rows " + rows);
  const names = await ev(`[...document.querySelectorAll('#skillPanelList .skill-row-name')].map(e => e.textContent).join('|')`);
  log("panel skills:", names);
  check("panel shows all ten Vietnamese names",
    ["Thái Cực Chưởng", "Kim Cang Quyền", "Phi Long Cước", "Bát Quái Chưởng", "Ngũ Hành Quyền",
     "Hỏa Vân Toàn", "Băng Phong Chưởng", "Lôi Đình Kích", "Thiên Phong Bộ", "Vô Ảnh Liên Hoàn"]
      .every(n => names.includes(n)));
  await shot("skill_panel_10.png");
}
await tapPanelBtn('.skill-assign-btn[data-skill="sk_loidinh_kich"][data-slot="1"]');
await sleep(400);
{
  const sk = await skills();
  check("Lôi Đình Kích assigned to SK2 slot", sk.slots[1] === "sk_loidinh_kich", JSON.stringify(sk.slots));
  check("Kim Cang Quyền left the slots (no duplicate)", !sk.slots.includes("sk_kimcang_quyen"));
  const icon = await ev("document.querySelector('#btnSkill2 .hb-icon')?.getAttribute('src') || ''");
  check("SK2 button icon swapped to Lôi Đình art", /loidinh/.test(icon), icon);
  const label = await ev("document.querySelector('#btnSkill2 .hb-label')?.textContent || ''");
  check("SK2 button label swapped", label === "Lôi Đình", label);
  await shot("cluster_after_swap.png");
}
await closePanel();
await sleep(300);
check("skill panel closes", (await skills()).skillPanelOpen === false);

// ---- B. Persistence: reload, slots survive via the save
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
await waitFor(async () => {
  try { return (await ev("window.TL2 && TL2.ready() && window.Gameplay && !!Gameplay.inspectSkills")) || null; }
  catch { return null; }
}, 30000, "game ready after reload");
await cdp("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
await sleep(700);
await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }).catch(() => {});
await waitFor(async () => {
  const sk = await skills();
  return Object.values(sk.packsLoaded).every(Boolean) ? sk : null;
}, 120000, "packs after reload");
{
  const sk = await skills();
  check("slot swap persists across reload (saved)", sk.slots[1] === "sk_loidinh_kich", JSON.stringify(sk.slots));
}

// ---- C. Cast the swapped skill by TAP (auto-target nearest)
const usedMonsters = [];
let monA = freshMonster(await combat(), "trucyeu");
usedMonsters.push(monA.id);
await ev(`Gameplay.teleportTo(${monA.x - 150}, ${monA.y})`);
await sleep(600);
{
  const c0 = await combat();
  const hp0 = monsterById(c0, monA.id).hp;
  const mp0 = c0.playerMp;
  const r = await castAndObserve("#btnSkill2", "sk_loidinh_kich", "cast_loidinh.png");
  const c2 = await combat();
  check("swapped SK2 casts Lôi Đình Kích by tap", r.castingSeen);
  check("Lôi Đình pack frames progress", r.frames.length >= 2 && Math.max(...r.frames) >= 3, "frames: " + r.frames.join(","));
  check("Lôi Đình damages the auto-targeted nearest monster", monsterById(c2, monA.id).hp < hp0,
    `${hp0} -> ${monsterById(c2, monA.id).hp}`);
  check("Lôi Đình consumes 19 MP", r.mpAtCast !== null && Math.abs((mp0 - r.mpAtCast) - 19) <= 3,
    `${mp0} -> ${r.mpAtCast}`);
  const sk = await skills();
  const s = sk.skills.find(x => x.id === "sk_loidinh_kich");
  check("Lôi Đình enters its own cooldown (per-skill, not per-slot)", s.state === "cooldown" && s.cdLeft > 3, "cdLeft " + s.cdLeft);
}

// ---- D. Hold-drag aim with the swapped skill, toward NE
{
  await waitFor(async () => {
    const sk = await skills();
    const s = sk.skills.find(x => x.id === "sk_loidinh_kich");
    return s.cdLeft <= 0 && (await combat()).playerMp >= 19 ? true : null;
  }, 60000, "loidinh ready for aim test");
  // Re-stage: the step C monster must stand NE of the player, so the
  // dragged aim point lands on it (see note above).
  {
    const cN = await combat();
    const mN = cN.monsters.find(m => !m.dead) || null;
    if (mN) {
      await ev(`Gameplay.teleportTo(${mN.x - 106}, ${mN.y + 106})`);
      await sleep(500);
    }
  }
  const btn = await elCenter("#btnSkill2");
  await touchStart(btn.x, btn.y);
  await sleep(600);
  const aim1 = await skills();
  check("hold enters AIMING for the swapped skill", !!(aim1.aiming && aim1.aiming.skill === "sk_loidinh_kich"),
    JSON.stringify(aim1.aiming));
  await touchMove(btn.x + 42, btn.y - 42);
  await sleep(250);
  const aim2 = await skills();
  log("aim after NE drag:", JSON.stringify(aim2.aiming));
  await shot("aim_loidinh_ne.png");
  await touchEnd();
  await sleep(400);
  const sk = await skills();
  check("release casts Lôi Đình toward NE (row 1)",
    !!(sk.casting && sk.casting.skill === "sk_loidinh_kich" && sk.casting.row === 1),
    JSON.stringify(sk.casting));
  await waitFor(async () => (!(await skills()).casting ? true : null), 8000, "aim cast finishes");
}

// ---- E. Cancel zone: drag out, slide back to centre, release = no cost
{
  await waitFor(async () => {
    const sk = await skills();
    const s = sk.skills.find(x => x.id === "sk_loidinh_kich");
    return s.cdLeft <= 0 ? true : null;
  }, 60000, "loidinh ready for cancel test");
  await ensureAlive("cancel-zone aim");
  const mpBefore = (await combat()).playerMp;
  const btn = await elCenter("#btnSkill2");
  await touchStart(btn.x, btn.y);
  await sleep(600);
  await touchMove(btn.x + 44, btn.y - 10);
  await sleep(200);
  await touchMove(btn.x + 3, btn.y + 2);
  await sleep(250);
  const aimC = await skills();
  check("sliding back to centre arms the cancel zone", !!(aimC.aiming && aimC.aiming.cancel === true),
    JSON.stringify(aimC.aiming));
  await shot("aim_cancel_zone.png");
  await touchEnd();
  await sleep(500);
  const sk = await skills();
  const mpAfter = (await combat()).playerMp;
  const s = sk.skills.find(x => x.id === "sk_loidinh_kich");
  check("cancelled aim does NOT cast", !sk.casting);
  check("cancelled aim costs no MP", Math.abs(mpAfter - mpBefore) <= 2, `${mpBefore} -> ${mpAfter}`);
  check("cancelled aim triggers no cooldown", s.cdLeft <= 0.05, "cdLeft " + s.cdLeft);
}

// ---- F. Leave combat (kill the staged target with basic attacks),
// then swap Thiên Phong Bộ into SK3 and dash with it
{
  let guard = 0;
  while (guard++ < 40) {
    const cc = await combat();
    const mNow = monsterById(cc, monA.id);
    if (!mNow || mNow.dead) break;
    if (cc.playerDead) { await sleep(1200); continue; }
    if (dist(cc.px, cc.py, mNow.x, mNow.y) > 120) {
      await ev(`Gameplay.teleportTo(${mNow.x - 75}, ${mNow.y})`);
      await sleep(400);
      continue;
    }
    await tapEl("#mobileAtkBtn");
    await sleep(1050);
  }
  const cc = await combat();
  const mNow = monsterById(cc, monA.id);
  check("staged target killed to leave combat", !mNow || mNow.dead);
  // the selection clears once the target is dead; wait for a clean state
  await waitFor(async () => {
    const sk = await skills();
    return !sk.target ? true : null;
  }, 15000, "target cleared after kill").catch(() => null);
  await ev("Gameplay.teleportTo(2200, 2470)"); // open plaza: room for the 260px dash east
  await sleep(600);
}
await tapEl("#skillPanelBtn");
await sleep(500);
await tapPanelBtn('.skill-assign-btn[data-skill="sk_thienphong_bo"][data-slot="2"]');
await sleep(400);
{
  const sk = await skills();
  check("Thiên Phong Bộ assigned to SK3", sk.slots[2] === "sk_thienphong_bo", JSON.stringify(sk.slots));
}
await closePanel();
await sleep(300);
{
  // face east, then tap SK3: the cast must dash the player ~260px east
  await joyDrag(55, 0, 60);
  await settled();
  const before = await state();
  const mpB = (await combat()).playerMp;
  const r = await castAndObserve("#btnSkill3", "sk_thienphong_bo", "cast_thienphong.png");
  const after = await state();
  const moved = dist(before.x, before.y, after.x, after.y);
  check("Thiên Phong Bộ casts from its pack", r.castingSeen && r.frames.length >= 2, "frames: " + r.frames.join(","));
  check("Thiên Phong Bộ dashes the player forward (~260px)", moved > 120 && after.x > before.x + 90,
    `moved ${Math.round(moved)}px dx ${Math.round(after.x - before.x)}`);
  check("Thiên Phong Bộ consumes 14 MP", r.mpAtCast !== null && Math.abs((mpB - r.mpAtCast) - 14) <= 3,
    `${mpB} -> ${r.mpAtCast}`);
}

// ---- G. In-combat swap refusal: select a live monster, try to swap
{
  const monZ = freshMonster(await combat(), "trucyeu", [...usedMonsters]) || freshMonster(await combat(), "trucyeu");
  await ev(`Gameplay.teleportTo(${monZ.x - 70}, ${monZ.y})`);
  await sleep(500);
  const s = await state();
  await sleep(300);
  const s2 = await state();
  await tapWorld(monZ.x, monZ.y - 40);
  await sleep(800);
  const skSel = await skills();
  log("target after tap:", JSON.stringify(skSel.target));
  await tapEl("#skillPanelBtn");
  await sleep(500);
  const slotsBefore = (await skills()).slots;
  await tapPanelBtn('.skill-assign-btn[data-skill="sk_voanh_lienhoan"][data-slot="0"]');
  await sleep(400);
  const slotsAfter = (await skills()).slots;
  check("swap refused while a target is locked (in combat)",
    JSON.stringify(slotsBefore) === JSON.stringify(slotsAfter),
    `before ${JSON.stringify(slotsBefore)} after ${JSON.stringify(slotsAfter)}`);
  await closePanel();
  await sleep(300);
}

log("exceptions during run:", exceptions.length);
for (const e of exceptions.slice(0, 8)) log("  ", e);
check("no page exceptions", exceptions.length === 0, exceptions.length + " exceptions");
log(failures === 0 ? "HUD2 HARNESS RESULT: ALL CHECKS PASS" : `HUD2 HARNESS RESULT: ${failures} FAILURE(S)`);
try { writeFileSync(join(OUT, "hud2-harness.log"), LOG.join("\n") + "\n"); } catch {}
try { process.kill(-chrome.pid, "SIGKILL"); } catch { try { chrome.kill("SIGKILL"); } catch {} }
server.close();
process.exit(failures === 0 ? 0 : 1);
