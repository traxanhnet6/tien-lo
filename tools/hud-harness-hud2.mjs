// HUD harness (HUD wave 2026-11-09): verifies the combat HUD Phase 1 with
// REAL input only — CDP touch/mouse/key events at screen coordinates.
// Game state is only READ via the game's inspection hooks to decide where
// a player would tap. teleportTo is used ONLY to stage scenarios (place
// the player next to a fresh monster); every measured action — joystick
// drags, button taps, holds, keys — is genuine input.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync, existsSync, readdirSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";

const ROOT = "/home/hatch/workspace/game-tien-lo-gd3/";
const OUT = "/home/hatch/workspace/game-tien-lo-gd3/proof/hud-verify";
mkdirSync(OUT, { recursive: true });
const PORT = 9100 + (process.pid % 300), CDP = 9500 + (process.pid % 300);
const VW = 390, VH = 844;

const LOG = [];
try { writeFileSync(join(OUT, "hud-harness.log"), ""); } catch {}
function log(...a) {
  const line = a.join(" ");
  LOG.push(line);
  console.log(line);
  try { appendFileSync(join(OUT, "hud-harness.log"), line + "\n"); } catch {}
}
let failures = 0;
function check(name, cond, extra = "") {
  log(cond ? "PASS" : "FAIL", name, extra);
  if (!cond) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
process.on("exit", () => { try { process.kill(-chrome.pid, "SIGKILL"); } catch {} });
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ------------------------------------------------------------- static server
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

// ------------------------------------------------------------- chrome via CDP
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

const PROFILE = "/home/hatch/workspace/.hud2-profile-" + process.pid;
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
// Touch input must be REAL: without touch emulation the headless shell
// silently drops CDP touch events (the finisher driver never noticed —
// it drives with the mouse). NOTE: enabling it BEFORE navigation does
// not survive the navigation in this shell; it is enabled after the
// page is ready, below (the order the working probe used).
process.on("unhandledRejection", e => {
  log("HARNESS ERROR (unhandled):", String(e && e.message || e));
  try { writeFileSync(join(OUT, "hud-harness.log"), LOG.join("\n") + "\n"); } catch {}
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

// ------------------------------------------------------------- real input
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
async function mouseTap(x, y) {
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 });
  await sleep(50);
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 });
  await sleep(60);
}
async function mouseDown(x, y) {
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 });
}
async function mouseUp(x, y) {
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 });
}
async function key(code, type) {
  await cdp("Input.dispatchKeyEvent", { type, code, key: code.replace("Key", "").replace("Arrow", "") });
}
const keyDown = code => key(code, "keyDown");
const keyUp = code => key(code, "keyUp");

async function elCenter(selector) {
  const r = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null; const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; })()`);
  if (!r) throw new Error("element not found: " + selector);
  return r;
}
// The panel refuses swaps while a LIVE target is selected, wherever it
// is (inCombatNow has no range limit on the target check). Clear it the
// way the game itself allows: finish the selected monster with basic
// attacks, then cycle targets (Tab) at a quiet spot where the cycle
// list is empty, which sets the target to null.
async function clearTargetForPanel() {
  // cycleTarget (Tab) canNOT clear the target — its list is every live
  // monster on the map — so the selected monster must actually die.
  // The player may die mid-kill (low HP after the skill tests): wait
  // out the respawn (full HP) and keep going.
  const tgt = (await skills()).target;
  if (tgt && tgt.id) {
    for (let i = 0; i < 60; i++) {
      const c = await combat();
      const m = c.monsters.find(x => x.id === tgt.id);
      if (!m || m.dead) break;
      if (c.playerDead) { await sleep(1500); continue; }
      await ev(`Gameplay.teleportTo(${m.x - 60}, ${m.y})`);
      await sleep(250);
      await tapEl("#mobileAtkBtn");
      await sleep(650);
    }
  }
  await ev("Gameplay.teleportTo(2405, 2425)");
  await sleep(600);
  const sk = await skills();
  log("target after clear:", JSON.stringify(sk.target), "casting:", JSON.stringify(sk.casting), "pending:", JSON.stringify(sk.pendingSkill));
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
async function qs() { return ev("Gameplay.getQuestState()"); }
async function tapWorld(wx, wy) {
  const s = await state();
  const dims = await ev("window.innerWidth + 'x' + window.innerHeight");
  const [iw, ih] = dims.split("x").map(Number);
  const sx = iw / 2 + (wx - s.cam[0]) * s.zoom;
  const sy = ih / 2 + (wy - s.cam[1]) * s.zoom;
  await touchTap(Math.max(4, Math.min(iw - 4, sx)), Math.max(4, Math.min(ih - 4, sy)));
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
// After a staging teleport the camera lerps behind the player; a
// tapWorld computed against a still-moving camera lands off-screen.
// Wait until the camera has converged on the player before tapping.
async function camSettled() {
  let prev = null;
  for (let i = 0; i < 40; i++) {
    const s = await state();
    if (prev && Math.abs(s.cam[0] - prev.cam[0]) < 0.8 && Math.abs(s.cam[1] - prev.cam[1]) < 0.8 &&
        Math.hypot(s.cam[0] - s.x, s.cam[1] - s.y) < 110) return s;
    prev = s;
    await sleep(180);
  }
  return state();
}
// Joystick drag: start in the pad zone, drag out by (dx,dy), hold, release.
// Origin (60,790) sits below the zone-chip row — the chips are real
// tappable buttons inside the pad's rectangle and legitimately win the
// touches that land exactly on them.
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
// Tap a skill button and record the cast: frame progression + a mid-cast
// screenshot when the apex phase shows.
// Skill taps are refused while the player is dead, and the combat
// sections can leave the player dead or dying (trucyeu fight back
// during staging). Before every measured cast, make sure the player
// is alive; a death mid-section used to fail every cast check in the
// run (run 18: player at 4/220 HP, all casts refused).
async function ensureAlive(label) {
  const c = await combat();
  if (!c.playerDead) return;
  log("player dead before", label, "- waiting for respawn");
  await waitFor(async () => ((await combat()).playerDead ? null : true), 20000, "respawn before " + label);
  await sleep(400);
}
async function castAndObserve(selector, skillId, shotName) {
  // Page-side recorder (HUD2 load fix): on this shared VM a CDP
  // round-trip can take longer than a whole 0.5s cast, so polling
  // from Node misses the casting window and reports empty frames for
  // casts that really happened. A 30ms sampler inside the page records
  // skill/frame/target/MP in real time; the assertions are unchanged.
  await ev(`window.__castRec = []; window.__castRecGen = (window.__castRecGen || 0) + 1; window.__castRecOn = true;
    (function rec(gen){ if (!window.__castRecOn || gen !== window.__castRecGen) return;
      try { const s = Gameplay.inspectSkills();
        if (s && s.casting) window.__castRec.push({ skill: s.casting.skill, frame: s.casting.frame, tgt: s.target ? s.target.id : null, mp: Gameplay.inspectCombat().playerMp });
      } catch (e) {}
      setTimeout(() => rec(gen), 30); })(window.__castRecGen); "ok"`);
  await tapEl(selector);
  const t0 = Date.now();
  let rec = [], shotTaken = false, stillPolls = 0, recovered = false;
  while (Date.now() - t0 < 15000) {
    const prevLen = rec.length;
    rec = await ev("window.__castRec");
    const mine = rec.filter(r => r.skill === skillId);
    // GD3 load recovery (same spirit as the page-side recorder above):
    // under heavy VM load a tap's release event can be stretched past
    // the hold threshold or lost, leaving the press stuck in the aim
    // state. Complete the SAME real gesture once — release at the
    // button if aiming, otherwise tap once more — then keep sampling.
    if (!recovered && mine.length === 0 && Date.now() - t0 > 4000) {
      recovered = true;
      try {
        const aiming = await ev(`(() => { const s = Gameplay.inspectSkills(); return !!(s && s.aiming); })()`);
        if (aiming) {
          const c = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
          if (c) await tapXY(c.x, c.y);
        } else {
          await tapEl(selector);
        }
      } catch {}
    }
    if (shotName && !shotTaken && mine.some(r => r.frame >= 4)) { await shot(shotName); shotTaken = true; }
    if (mine.length && rec.length === prevLen) { if (++stillPolls >= 2) break; }
    else stillPolls = 0;
    await sleep(300);
  }
  await ev("window.__castRecOn = false; 'ok'").catch(() => {});
  const mine = rec.filter(r => r.skill === skillId);
  const frames = new Set(mine.map(r => r.frame));
  const castingSeen = mine.length > 0;
  const targetAtCast = castingSeen ? mine[0].tgt : undefined;
  const mpAtCast = castingSeen ? mine[0].mp : null;
  // wait for the cooldown to be registered (cast fully finished)
  await waitFor(async () => {
    const sk = await skills();
    const s = sk.skills.find(x => x.id === skillId);
    return s && s.state === "cooldown" ? s : null;
  }, 8000, "cooldown after " + skillId).catch(() => null);
  return { castingSeen, frames: [...frames].sort((a, b) => a - b), targetAtCast, mpAtCast };
}
function monsterById(c, id) { return c.monsters.find(m => m.id === id); }
function freshMonster(c, key, excludeIds = []) {
  return c.monsters.find(m => m.key === key && !m.dead && m.hp === m.maxHp && !excludeIds.includes(m.id));
}

// The harness runs in two parts (HUD_PART=a|b|all) because this VM is
// shared and memory-tight: two shorter Chrome lifetimes survive the
// external pressure that killed two long runs mid-flight. Part A covers
// boot/plate/joystick/WASD/SK1–SK4/refusals; part B covers the energy
// farm, ULT cast, dodge, defend, hold-aim, PC keys and the NPC law.
const PART = process.env.HUD_PART || "all";
const usedMonsters = [];
log("harness part:", PART);

// =============================================================== MAIN FLOW
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
await waitFor(async () => {
  try { return (await ev("window.TL2 && TL2.ready() && window.Gameplay && !!Gameplay.inspectSkills")) || null; }
  catch { return null; }
}, 30000, "game ready");
{
  let dims = await ev("window.innerWidth + 'x' + window.innerHeight");
  // Always pin with mobile:true — the media-query phone layout (and the
  // touch pipeline) must match a real 390x844 phone.
  await cdp("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
  await sleep(700);
  dims = await ev("window.innerWidth + 'x' + window.innerHeight");
  log("viewport:", dims);
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }).catch(() => {});
  log("raw inspectCombat at boot:", JSON.stringify(await combat()).slice(0, 320));
  check("viewport pinned to 390x844", dims === `${VW}x${VH}`, dims);
}
await waitFor(async () => {
  const sk = await skills();
  return Object.values(sk.packsLoaded).every(Boolean) ? sk : null;
}, 90000, "all five skill packs loaded");
log("packs loaded:", JSON.stringify((await skills()).packsLoaded));
check("all 5 skill packs loaded", true);

if (PART !== "b") {
// ---- character plate
{
  const mpText = await ev("document.getElementById('psMpText')?.textContent || ''");
  const lvText = await ev("document.getElementById('psLevel')?.textContent || ''");
  const hpText = await ev("document.getElementById('psHpText')?.textContent || ''");
  log("plate:", lvText, "|", hpText, "|", mpText);
  // GD3 adaptation (Bui's realm-name order 2026-11-10): the plate must
  // show the realm name for internal level 1 — the old assertion pinned
  // the literal "Cấp 1" text the order abolished.
  check("plate shows level from xp model", lvText === "Luyện Khí tầng 1", lvText);
  check("plate shows HP with %", /HP · \d+%/.test(hpText), hpText);
  check("plate shows MP with %", /60 \/ 60 MP · 100%/.test(mpText), mpText);
}
await shot("hud_phone_idle.png");

// ---- joystick: 8 directions from spawn (real touch drags)
{
  const s0 = await settled();
  log("joystick test origin:", Math.round(s0.x), Math.round(s0.y));
  const dirs = [
    ["E", 55, 0], ["SE", 39, 39], ["S", 0, 55], ["SW", -39, 39],
    ["W", -55, 0], ["NW", -39, -39], ["N", 0, -55], ["NE", 39, -39],
  ];
  for (const [name, dx, dy] of dirs) {
    const before = await state();
    await joyDrag(dx, dy, 620);
    const after = await settled();
    const mx = after.x - before.x, my = after.y - before.y;
    const moved = Math.hypot(mx, my);
    const cos = moved > 0 ? (mx * dx + my * dy) / (moved * Math.hypot(dx, dy)) : -1;
    check(`joystick ${name}: moves with input direction`, moved > 22 && cos > 0.62,
      `moved ${Math.round(moved)}px cos ${cos.toFixed(2)}`);
    // walk back near the origin for the next direction
    await tapWorld(s0.x, s0.y);
    await settled();
  }
}

// ---- tap inside the joystick zone replays as a normal canvas tap
{
  const s0 = await settled();
  // screen point (160, 560) is inside the pad zone (left 44%, bottom 37%)
  // and maps to a world point ~190px south of the player; compute that
  // target and assert the player walks toward it.
  const s = await state();
  const wx = s.cam[0] + (160 - VW / 2) / s.zoom;
  const wy = s.cam[1] + (560 - VH / 2) / s.zoom;
  await touchTap(160, 560);
  const s1 = await settled();
  const mx = s1.x - s0.x, my = s1.y - s0.y;
  const moved = Math.hypot(mx, my);
  const cos = moved > 0 ? (mx * (wx - s0.x) + my * (wy - s0.y)) / (moved * Math.hypot(wx - s0.x, wy - s0.y)) : -1;
  check("tap in joystick zone still tap-to-moves (replay)", moved > 20 && cos > 0.55,
    `moved ${Math.round(moved)}px cos ${cos.toFixed(2)}`);
  await tapWorld(s0.x, s0.y);
  await settled();
}

// ---- WASD movement
{
  const before = await state();
  await keyDown("KeyD");
  await sleep(1150);
  await keyUp("KeyD");
  const afterD = await settled();
  check("WASD D moves east", afterD.x - before.x > 18, `dx ${Math.round(afterD.x - before.x)}`);
  await keyDown("KeyW");
  await sleep(1150);
  await keyUp("KeyW");
  const afterW = await settled();
  check("WASD W moves north", afterD.y - afterW.y > 15,
    `dy ${Math.round(afterD.y - afterW.y)}`);
}

// ---- stage next to a fresh Trúc Yêu for skill casts
let c = await combat();
let monA = freshMonster(c, "trucyeu");
check("found a fresh trucyeu for skill tests", !!monA, monA ? monA.id : "none");
usedMonsters.push(monA.id);
log("staging next to", monA.id, "at", monA.x, monA.y, "map:", await ev("location.search"));
await ev(`Gameplay.teleportTo(${monA.x - 170}, ${monA.y})`);
await sleep(150);
c = await combat();
log("post-teleport monsters:", c.monsters.map(m => m.id).join(","), "player at", c.px, c.py);
const mp0 = c.playerMp;
const hpA0 = monsterById(c, monA.id).hp;

// SK1 Thái Cực (directional — spec §3.3: casts along FACING, so face the
// monster first with a short joystick flick east, like a player would.
// Tight staging: at 170px the monster is still closing in when the hit
// lands ~0.3s after the tap, so the wedge geometry is stable.)
{
  await joyDrag(55, 0, 60);
  const mpBefore = (await combat()).playerMp;
  await ensureAlive("SK1");
  const r = await castAndObserve("#btnSkill1", "sk_thaicuc_chuong", "cast_thaicuc.png");
  const c2 = await combat();
  const hpA1 = monsterById(c2, monA.id).hp;
  check("SK1 casts (state machine entered CASTING)", r.castingSeen);
  check("SK1 pack frames actually progress on screen", r.frames.length >= 2 && Math.max(...r.frames) >= 3,
    "frames seen: " + r.frames.join(","));
  check("SK1 damages the monster in the facing wedge", hpA1 < hpA0, `${hpA0} -> ${hpA1}`);
  check("SK1 consumes 12 MP", r.mpAtCast !== null && r.mpAtCast <= mpBefore - 12 + 3 && r.mpAtCast >= mpBefore - 12 - 2,
    `${mpBefore} -> ${r.mpAtCast} (at cast)`);
  const sk = await skills();
  const s1 = sk.skills.find(x => x.id === "sk_thaicuc_chuong");
  check("SK1 enters cooldown after cast", s1.state === "cooldown" && s1.cdLeft > 0, "cdLeft " + s1.cdLeft);
}

// SK2 Kim Cang (single) + auto-target = nearest. Nothing has been
// selected yet in this run (SK1 is directional and never selects), so
// the cast must auto-pick the nearest live monster. Stage EAST of monB:
// the pack wolf that converges from the south-west then stays ~230px
// behind monB, far outside any movement race. The expectation is also
// recomputed from a snapshot taken immediately before the tap.
let monB = freshMonster(await combat(), "trucyeu", [...usedMonsters]);
usedMonsters.push(monB.id);
await ev(`Gameplay.teleportTo(${monB.x + 60}, ${monB.y})`);
await sleep(500);
{
  const cB = await combat();
  const hpB0 = monsterById(cB, monB.id).hp;
  const mpB0 = cB.playerMp;
  const expectedNearest = cB.monsters.filter(m => !m.dead)
    .sort((a, b) => dist(cB.px, cB.py, a.x, a.y) - dist(cB.px, cB.py, b.x, b.y))[0];
  await ensureAlive("SK2");
  const r = await castAndObserve("#btnSkill2", "sk_kimcang_quyen", "cast_kimcang.png");
  const c2 = await combat();
  check("SK2 casts", r.castingSeen);
  check("SK2 pack frames progress", r.frames.length >= 2 && Math.max(...r.frames) >= 3, "frames: " + r.frames.join(","));
  check("auto-target picks the NEAREST monster", r.targetAtCast === expectedNearest.id && expectedNearest.id === monB.id,
    `target at cast ${r.targetAtCast} vs nearest ${expectedNearest.id} (staged ${monB.id})`);
  const hpTarget = r.targetAtCast ? monsterById(c2, r.targetAtCast) : null;
  check("SK2 damages its target", !!hpTarget && hpTarget.hp < hpB0,
    `${hpB0} -> ${hpTarget ? hpTarget.hp : "?"}`);
  check("SK2 consumes 18 MP", r.mpAtCast !== null && r.mpAtCast <= mpB0 - 18 + 3 && r.mpAtCast >= mpB0 - 18 - 2,
    `${mpB0} -> ${r.mpAtCast} (at cast)`);
}

// SK3 Phi Long (single, dash-to-target from ~260px). Select monC first
// by tapping it (the player's way: tap = select), then stage back at
// 260px — the selection persists, so the dash has a locked target.
let monC = freshMonster(await combat(), "trucyeu", [...usedMonsters]);
usedMonsters.push(monC.id);
await ev(`Gameplay.teleportTo(${monC.x - 70}, ${monC.y})`);
await camSettled();
await tapWorld(monC.x, monC.y - 40);
await sleep(900);
{
  const skSel = await skills();
  check("tapping a monster selects it as target", skSel.target && skSel.target.id === monC.id,
    `target ${skSel.target && skSel.target.id}`);
}
await ev(`Gameplay.teleportTo(${monC.x - 260}, ${monC.y})`);
await sleep(120);
{
  const cC = await combat();
  const monCNow = monsterById(cC, monC.id);
  const hpC0 = monCNow.hp;
  const d0 = dist(cC.px, cC.py, monCNow.x, monCNow.y);
  await ensureAlive("SK3");
  const r = await castAndObserve("#btnSkill3", "sk_philong_cuoc", "cast_philong.png");
  const c2 = await combat();
  const monCAfter = monsterById(c2, monC.id);
  const d1 = dist(c2.px, c2.py, monCAfter.x, monCAfter.y);
  check("SK3 casts from ~260px (in its 330 range)", r.castingSeen && r.targetAtCast === monC.id,
    `dist was ${Math.round(d0)}, target ${r.targetAtCast}`);
  check("SK3 pack frames progress", r.frames.length >= 2, "frames: " + r.frames.join(","));
  check("SK3 dashes the player to the target", d1 < d0 - 110, `dist ${Math.round(d0)} -> ${Math.round(d1)}`);
  check("SK3 damages the target", monCAfter.hp < hpC0, `${hpC0} -> ${monCAfter.hp}`);
}

// ---- MP refusal: spend MP with SK1/SK2/SK3 (never SK4 — its own
// cooldown must stay 0 so the mana refusal is what fires) until MP
// drops under SK4's cost of 22; then SK4 must refuse BLOCKED-MANA.
// Two lessons baked in: (1) a wait for "cast ended" must first wait
// for the cast to BEGIN — tap latency means casting can still be null
// on the first poll, and a second tap fired into a live cast is
// ignored by design; (2) regen races any slow drain, so the loop
// re-reads state and re-stages targets until the number is really < 22.
async function castOnce(sel, id, beginMs = 9000, endMs = 15000) {
  await tapEl(sel);
  const began = await waitFor(async () => {
    const sk = await skills();
    return sk.casting && sk.casting.skill === id ? true : null;
  }, beginMs, "cast begin " + id, 120).catch(() => null);
  if (!began) return false;
  await waitFor(async () => {
    const sk = await skills();
    return !sk.casting ? true : null;
  }, endMs, "cast end " + id, 120).catch(() => null);
  return true;
}
{
  // HUD2 staging fix v2 (the GĐ1 lesson, applied strictly): MP regen
  // (3.5/s at level 1) out-races any drain whose casts take seconds to
  // begin — and single-target skills begin as pendingSkill walk-ins
  // whenever the staged monster has drifted, which is exactly what
  // pinned run 9's MP at 60. So the burst uses three INSTANT cast
  // types that never need a target and never walk: Hỏa Vân Toàn
  // (area-self, 24) + Thái Cực Chưởng (directional, 12) + Thiên Phong
  // Bộ (self dash, 14) = 50 MP spent in about 2s at a monster-free
  // spot, against ~7 MP of regen. Slots are borrowed through the
  // panel (out of combat only) and the default loadout is restored
  // right after the refusal is measured. SK4 itself is never cast
  // here, so its cooldown stays 0 for the refusal.
  await clearTargetForPanel();
  await tapEl("#skillPanelBtn");
  await sleep(500);
  await tapPanelBtn('.skill-assign-btn[data-skill="sk_hoavan_toan"][data-slot="0"]');
  await sleep(350);
  await tapPanelBtn('.skill-assign-btn[data-skill="sk_thaicuc_chuong"][data-slot="1"]');
  await sleep(350);
  await tapPanelBtn('.skill-assign-btn[data-skill="sk_thienphong_bo"][data-slot="2"]');
  await sleep(350);
  log("slots for burst drain:", JSON.stringify((await skills()).slots));
  await closePanel();
  await sleep(300);
  // start the burst from a full gauge so the arithmetic is stable
  await waitFor(async () => { const c = await combat(); return c.playerMp >= c.playerMaxMp - 1 ? true : null; }, 30000, "MP full before burst");
  const plan = [["#btnSkill1", "sk_hoavan_toan"], ["#btnSkill2", "sk_thaicuc_chuong"], ["#btnSkill3", "sk_thienphong_bo"]];
  let mpBefore = (await combat()).playerMp;
  let guard = 0;
  while (mpBefore >= 22 && guard++ < 8) {
    let spent = false;
    for (const [sel, id] of plan) {
      if (mpBefore < 22) break;
      const sk = await skills();
      const s = sk.skills.find(x => x.id === id);
      if (!s || s.cdLeft > 0 || mpBefore < s.manaCost) continue;
      const okCast = await castOnce(sel, id, 3000, 6000);
      if (okCast) spent = true;
      const cc2 = await combat();
      mpBefore = cc2.playerMp;
      log("  burst spend via", id, "ok", okCast, "-> MP", mpBefore, "HP", cc2.playerHp, "dead", cc2.playerDead, "at", cc2.px + "," + cc2.py);
    }
    if (!spent) { await sleep(1200); mpBefore = (await combat()).playerMp; }
  }
  log("burst drained; slots during refusal test:", JSON.stringify((await skills()).slots));
  log("MP burst-spent to", mpBefore, "— attempting SK4 (cost 22, its cooldown is 0)");
  check("MP is below SK4 cost before refusal test", mpBefore < 22, "mp " + mpBefore);
  await ensureAlive("SK4 refusal");
  await tapEl("#btnSkill4");
  let flashSeen = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 1500) {
    const cls = await ev("document.querySelector('#btnSkill4')?.className || ''");
    if (/no-mana/.test(cls)) { flashSeen = true; break; }
    const sk = await skills();
    if (sk.casting) break;
    await sleep(60);
  }
  const sk = await skills();
  const mpAfter = (await combat()).playerMp;
  check("SK4 refused when MP insufficient (no cast)", !sk.casting && !sk.skills.find(x => x.id === "sk_batquai_chuong" && x.state === "casting"));
  check("SK4 refusal shows the BLOCKED-MANA warning state", flashSeen);
  check("SK4 refusal spends no MP", Math.abs(mpAfter - mpBefore) <= 2, `${mpBefore} -> ${mpAfter}`);
  // restore the default loadout now that the refusal is measured.
  // A slotted skill has no assign buttons of its own (only unslotted
  // skills can be assigned), so the restore routes through Vô Ảnh as
  // a scratch tenant of slot 1 to free Thái Cực first:
  // [hoavan,thaicuc,thienphong] -> voanh takes slot 1 (thaicuc free)
  // -> thaicuc takes slot 0 (hoavan free) -> kimcang takes slot 1
  // (voanh free) -> philong takes slot 2 (thienphong free).
  await clearTargetForPanel();
  await tapEl("#skillPanelBtn");
  await sleep(500);
  await tapPanelBtn('.skill-assign-btn[data-skill="sk_voanh_lienhoan"][data-slot="1"]');
  await sleep(350);
  await tapPanelBtn('.skill-assign-btn[data-skill="sk_thaicuc_chuong"][data-slot="0"]');
  await sleep(350);
  await tapPanelBtn('.skill-assign-btn[data-skill="sk_kimcang_quyen"][data-slot="1"]');
  await sleep(350);
  await tapPanelBtn('.skill-assign-btn[data-skill="sk_philong_cuoc"][data-slot="2"]');
  await sleep(350);
  await closePanel();
  await sleep(300);
  log("slots restored:", JSON.stringify((await skills()).slots));
}

// SK4 Bát Quái (area around self) for real, once MP has regenerated
let monD = freshMonster(await combat(), "trucyeu", [...usedMonsters]);
usedMonsters.push(monD.id);
await waitFor(async () => ((await combat()).playerMp >= 24 ? true : null), 120000, "MP regen to 24+");
await ev(`Gameplay.teleportTo(${monD.x - 70}, ${monD.y})`);
await sleep(500);
{
  const cD = await combat();
  const hpD0 = monsterById(cD, monD.id).hp;
  const skD = await skills();
  const diagD = await ev(`(() => { const e = document.querySelector("#btnSkill4"); const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return { cls: e.className, top: top ? (top.id || String(top.className)) : "none" }; })()`);
  log("SK4-real pre-cast diag:", JSON.stringify({ mp: cD.playerMp, dead: cD.playerDead, hp: cD.playerHp, batquai: skD.skills.find(x => x.id === "sk_batquai_chuong"), casting: skD.casting, pending: skD.pendingSkill, aiming: skD.aiming, panelOpen: skD.skillPanelOpen, btn: diagD }));
  await ensureAlive("SK4-real");
  const r = await castAndObserve("#btnSkill4", "sk_batquai_chuong", "cast_batquai.png");
  const c2 = await combat();
  check("SK4 casts", r.castingSeen);
  check("SK4 pack frames progress", r.frames.length >= 2 && Math.max(...r.frames) >= 3, "frames: " + r.frames.join(","));
  check("SK4 damages monsters around the player", monsterById(c2, monD.id).hp < hpD0,
    `${hpD0} -> ${monsterById(c2, monD.id).hp}`);
  // cooldown overlay: seconds text visible on the button right after
  const cdUi = await ev(`(() => { const b = document.querySelector('#btnSkill4');
    const cd = b.querySelector('.hb-cd'); const tx = b.querySelector('.hb-cd-text');
    return { display: cd.style.display, text: tx.textContent }; })()`);
  log("SK4 cooldown UI:", JSON.stringify(cdUi));
  check("cooldown overlay shows the seconds number", cdUi.display === "flex" && /^\d+(\.\d)?$/.test(cdUi.text),
    JSON.stringify(cdUi));
  await shot("cooldown_state.png");
}

// ---- ULT refusal before full energy
{
  const cU = await combat();
  log("energy before ULT refusal test:", cU.energy);
  if (cU.energy < 100) {
    await tapEl("#btnUlt");
    let flashSeen = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 1500) {
      const cls = await ev("document.querySelector('#btnUlt')?.className || ''");
      if (/no-energy/.test(cls)) { flashSeen = true; break; }
      await sleep(60);
    }
    const sk = await skills();
    check("ULT refused before full energy (no cast)", !sk.casting);
    check("ULT refusal shows BLOCKED-ENERGY warning", flashSeen);
  } else {
    log("NOTE: energy already full — refusal branch skipped");
  }
}
} // end PART !== "b"

if (PART !== "a") {
// ---- farm energy: facetank + swing at a Trúc Yêu until the gauge is full
{
  let monE = freshMonster(await combat(), "trucyeu", [...usedMonsters]) || freshMonster(await combat(), "trucyeu");
  await ev(`Gameplay.teleportTo(${monE.x - 75}, ${monE.y})`);
  await sleep(600);
  const t0 = Date.now();
  let combatShot = false;
  while (Date.now() - t0 < 360000) {
    const cc = await combat();
    if (cc.energy >= 100) break;
    if (cc.playerDead) { await sleep(1200); continue; }
    const mNow = monsterById(cc, monE.id);
    if (!mNow || mNow.dead) {
      monE = freshMonster(cc, "trucyeu") || cc.monsters.find(m => !m.dead);
      if (!monE) break;
      await ev(`Gameplay.teleportTo(${monE.x - 75}, ${monE.y})`);
      await sleep(500);
      continue;
    }
    if (dist(cc.px, cc.py, mNow.x, mNow.y) > 130) {
      // e.g. after a death respawn across the map: restage beside it.
      await ev(`Gameplay.teleportTo(${mNow.x - 75}, ${mNow.y})`);
      await sleep(500);
      continue;
    }
    if (!combatShot && cc.energy > 40) { await shot("hud_combat.png"); combatShot = true; }
    if (cc.playerHp > 95) await tapEl("#mobileAtkBtn");
    await sleep(1100);
  }
  const cF = await combat();
  log("energy after farming:", cF.energy, "playerHp:", cF.playerHp);
  check("energy gauge filled to 100 by dealing + receiving damage", cF.energy >= 100, "energy " + cF.energy);
  const ultCls = await ev("document.querySelector('#btnUlt')?.className || ''");
  check("ULT button shows the full-energy GLOW state", /ult-ready/.test(ultCls), ultCls);
  if (!combatShot) await shot("hud_combat.png");
}

// ---- ULT cast at full energy
let monF = freshMonster(await combat(), "trucyeu") || (await combat()).monsters.find(m => !m.dead);
await ev(`Gameplay.teleportTo(${monF.x - 110}, ${monF.y})`);
await sleep(500);
{
  const cF = await combat();
  const target = monsterById(cF, monF.id);
  const hpF0 = target.hp;
  const r = await castAndObserve("#btnUlt", "ult_nguhanh_quyen", "cast_nguhanh.png");
  const c2 = await combat();
  const after = monsterById(c2, monF.id);
  check("ULT casts at full energy", r.castingSeen);
  check("ULT pack frames progress", r.frames.length >= 2 && Math.max(...r.frames) >= 3, "frames: " + r.frames.join(","));
  check("ULT spends the whole energy gauge", c2.energy < 25, "energy -> " + c2.energy);
  check("ULT hits hard (target dead or heavily damaged)", !after || after.dead || after.hp <= hpF0 - 50,
    `${hpF0} -> ${after ? after.hp : "dead"}`);
}

// ---- dodge: button, then Space key
{
  // Stage on the open Sơn Môn plaza: in the trucyeu forest the 150px
  // dash runs straight into a tree trunk and reads as 0px moved.
  await ev("Gameplay.teleportTo(2200, 2470)");
  await camSettled();
  // face east with a short joystick flick
  await joyDrag(55, 0, 60);
  await settled();
  const before = await state();
  await tapEl("#btnDodge");
  await sleep(650);
  const after = await state();
  const moved = dist(before.x, before.y, after.x, after.y);
  check("dodge button dashes the player", moved > 55, `moved ${Math.round(moved)}px`);
  const sk = await skills();
  check("dodge enters cooldown", sk.dodgeCdLeft > 0.5, "cdLeft " + sk.dodgeCdLeft);
  await waitFor(async () => ((await skills()).dodgeCdLeft <= 0 ? true : null), 60000, "dodge cooldown ends");
  const b2 = await state();
  await keyDown("Space");
  await keyUp("Space");
  await sleep(650);
  const a2 = await state();
  const moved2 = dist(b2.x, b2.y, a2.x, a2.y);
  check("Space key dodges too", moved2 > 55, `moved ${Math.round(moved2)}px`);
}

// ---- defend: button hold roots + state; Shift key hold too
{
  const btn = await elCenter("#btnDefend");
  await mouseDown(btn.x, btn.y);
  await sleep(600);
  const sk = await skills();
  check("defend button hold enters the defend stance", sk.defending === true);
  const p0 = await state();
  await joyDrag(55, 0, 500);
  const p1 = await state();
  check("defending roots the player (joystick cannot move)", dist(p0.x, p0.y, p1.x, p1.y) < 8,
    `moved ${Math.round(dist(p0.x, p0.y, p1.x, p1.y))}px`);
  await mouseUp(btn.x, btn.y);
  await sleep(300);
  check("releasing defend ends the stance", (await skills()).defending === false);
  await keyDown("ShiftLeft");
  await sleep(500);
  check("Shift hold defends (PC)", (await skills()).defending === true);
  await keyUp("ShiftLeft");
  await sleep(300);
  check("Shift release ends defend", (await skills()).defending === false);
}

// ---- hold-aim: SK1 held, indicator shown, drag NE, release casts NE
{
  const btn = await elCenter("#btnSkill1");
  // wait for SK1 to be ready + affordable again
  await waitFor(async () => {
    const sk = await skills();
    const s1 = sk.skills.find(x => x.id === "sk_thaicuc_chuong");
    const cc = await combat();
    return s1.cdLeft <= 0 && cc.playerMp >= 12 ? true : null;
  }, 120000, "SK1 ready for aim test");
  await touchStart(btn.x, btn.y);
  await sleep(600);
  const aimState = await skills();
  check("hold >= 180ms enters AIMING", !!(aimState.aiming && aimState.aiming.skill === "sk_thaicuc_chuong"),
    JSON.stringify(aimState.aiming));
  await shot("aim_state.png");
  await touchMove(btn.x + 42, btn.y - 42);
  await sleep(250);
  const aim2 = await skills();
  log("aim angle after NE drag:", JSON.stringify(aim2.aiming));
  await touchEnd();
  await sleep(400);
  const sk = await skills();
  check("release casts toward the dragged direction (NE)",
    !!(sk.casting && sk.casting.skill === "sk_thaicuc_chuong" && sk.casting.row === 1),
    JSON.stringify(sk.casting));
  await waitFor(async () => (!(await skills()).casting ? true : null), 8000, "aim cast finishes");
}

// ---- PC keys: Q casts SK1, J basic attack, Tab selects nearest
{
  await waitFor(async () => {
    const sk = await skills();
    const s1 = sk.skills.find(x => x.id === "sk_thaicuc_chuong");
    return s1.cdLeft <= 0 && (await combat()).playerMp >= 12 ? true : null;
  }, 120000, "SK1 ready for Q test");
  await keyDown("KeyQ");
  await keyUp("KeyQ");
  const t0 = Date.now();
  let castSeen = false;
  while (Date.now() - t0 < 6000) {
    const sk = await skills();
    if (sk.casting && sk.casting.skill === "sk_thaicuc_chuong") { castSeen = true; break; }
    await sleep(80);
  }
  check("Q key casts SK1", castSeen);
  await waitFor(async () => (!(await skills()).casting ? true : null), 8000, "Q cast finishes");

  // J next to a live monster
  let monG = freshMonster(await combat(), "trucyeu") || (await combat()).monsters.find(m => !m.dead);
  await ev(`Gameplay.teleportTo(${monG.x - 70}, ${monG.y})`);
  await sleep(500);
  const cG = await combat();
  const hpG0 = monsterById(cG, monG.id).hp;
  await keyDown("KeyJ");
  await keyUp("KeyJ");
  await sleep(1200);
  const cG2 = await combat();
  check("J key performs the basic attack", monsterById(cG2, monG.id).hp < hpG0,
    `${hpG0} -> ${monsterById(cG2, monG.id).hp}`);

  // Tab selects the nearest target
  await ev("Gameplay.teleportTo(" + (monG.x - 200) + "," + monG.y + ")");
  await sleep(400);
  await keyDown("Tab");
  await keyUp("Tab");
  await sleep(400);
  const skT = await skills();
  const cT = await combat();
  const nearest = cT.monsters.filter(m => !m.dead)
    .sort((a, b) => dist(cT.px, cT.py, a.x, a.y) - dist(cT.px, cT.py, b.x, b.y))[0];
  check("Tab selects the nearest monster", !!(skT.target && skT.target.id === nearest.id),
    `target ${skT.target && skT.target.id} vs nearest ${nearest.id}`);
}

// ---- NPC-touch law: far tap walks + opens once; interact button near
{
  // Far: stage 200px west of Tiên Đồng, tap his anchor — dialogue must
  // open on arrival, exactly like the standing law requires. 200px is
  // beyond the 115px near radius (so the walk branch is what runs) yet
  // still on-screen: at phone zoom a 420px offset lands outside the
  // 390px viewport and the tap gets clamped to the screen edge,
  // hitting plain ground instead of the NPC.
  await ev("Gameplay.teleportTo(2205, 2425)");
  await camSettled();
  await tapWorld(2405, 2425);
  const opened = await waitFor(async () => ((await qs()).dialogueOpen ? true : null), 120000, "far NPC dialogue", 300)
    .catch(() => null);
  check("NPC-touch law: far tap walks over and opens dialogue on arrival", !!opened);
  // advance to the end
  for (let i = 0; i < 14; i++) {
    if (!(await qs()).dialogueOpen) break;
    await tapEl("#dialogueAdvanceBtn");
    await sleep(260);
  }
  check("dialogue closed after advancing", !(await qs()).dialogueOpen);

  // Near: the context Interact button must be visible and open at once.
  await ev("Gameplay.teleportTo(2330, 2425)");
  await sleep(600);
  const vis = await ev(`(() => { const b = document.querySelector('#btnInteract');
    return b && b.style.display !== 'none'; })()`);
  check("interact button appears near an NPC", !!vis);
  const p0 = await state();
  await tapEl("#btnInteract");
  const opened2 = await waitFor(async () => ((await qs()).dialogueOpen ? true : null), 6000, "interact dialogue", 200)
    .catch(() => null);
  const p1 = await state();
  check("interact button opens dialogue at once when near", !!opened2);
  check("interact-near did not need a walk", dist(p0.x, p0.y, p1.x, p1.y) < 30,
    `moved ${Math.round(dist(p0.x, p0.y, p1.x, p1.y))}px`);
  for (let i = 0; i < 14; i++) {
    if (!(await qs()).dialogueOpen) break;
    await tapEl("#dialogueAdvanceBtn");
    await sleep(260);
  }
}
} // end PART !== "a"

log("exceptions during run:", exceptions.length);
for (const e of exceptions.slice(0, 8)) log("  ", e);
check("no page exceptions", exceptions.length === 0, exceptions.length + " exceptions");
log(failures === 0 ? "HUD HARNESS RESULT: ALL CHECKS PASS" : `HUD HARNESS RESULT: ${failures} FAILURE(S)`);
try { writeFileSync(join(OUT, "hud-harness.log"), LOG.join("\n") + "\n"); } catch {}
try { process.kill(-chrome.pid, "SIGKILL"); } catch { try { chrome.kill("SIGKILL"); } catch {} }
server.close();
process.exit(failures === 0 ? 0 : 1);
