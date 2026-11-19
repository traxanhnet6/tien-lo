// Finisher playtest driver: plays the ENTIRE Q1->Q8 chain in a real browser
// at 390x844 with a normal player driver — synthesized tap/click input only.
// It never calls Gameplay.update, never teleports, never triggers quest
// functions directly. State is only READ via the game's own inspection
// hooks (TL2.state, Gameplay.getQuestState, Gameplay.inspectCombat) to
// decide where a player would tap, exactly like looking at the screen.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";

const ROOT = "/home/hatch/workspace/game-tien-lo-agy2/";
const OUT = "/home/hatch/workspace/game-tien-lo-agy2/proof/finisher-verify2";
mkdirSync(OUT, { recursive: true });
const PORT = 8997, CDP = 9350;
const VW = 390, VH = 844;

const LOG = [];
try { writeFileSync(join(OUT, "playtest-q1-q13.log"), ""); } catch {} // durable from line one; a storage EPERM here must not kill the run before it starts
function log(...a) {
  const line = a.join(" ");
  LOG.push(line);
  console.log(line);
  try { appendFileSync(join(OUT, "playtest-q1-q13.log"), line + "\n"); } catch {}
}
function flushLog() {
  writeFileSync(join(OUT, "playtest-q1-q13.log"), LOG.join("\n") + "\n");
}

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
// Connection layer, repaired 2026-11-09: the previous shim depended on
// the npm "ws" package via import("ws") — that package is NOT installed
// anywhere reachable from this file on this VM, so the import rejected,
// the connect retry loop swallowed the rejection, and the driver then
// hung forever awaiting an "open" event on a socket that was never
// constructed (zero log lines: the first log() call sits after the
// handshake; two full runs stalled exactly there). The Ngũ Hành test
// harnesses on this same VM connect fine via Node's built-in global
// WebSocket, so this adapter wraps the global WebSocket behind the same
// interface the rest of the driver uses. `ready` resolves only once the
// socket is OPEN and rejects on error / 10s timeout, so a failed
// handshake is loud instead of silent.
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
    // If "open" already fired, deliver it (async) so a late subscriber
    // can never hang waiting for an event that already happened.
    if (type === "open" && this._opened) queueMicrotask(() => fn({}));
  }
  send(s) { if (this._opened) this._inner.send(s); else this._sendQueue.push(s); }
}

const PROFILE = "/home/hatch/workspace/.finisher2-profile";
rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(chromeBin(), ["--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--no-sandbox", "--disable-dev-shm-usage",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding", "--force-device-scale-factor=2",
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${CDP}`,
  `--window-size=${VW},${VH}`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
log("driver up; static server on port", PORT, "— Chrome spawned, connecting CDP…");
let ws = null, lastConnErr = null;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: "PUT" })).json();
    const cand = new WSShim(j.webSocketDebuggerUrl);
    await cand.ready; // resolves only once the socket is OPEN; rejects loudly otherwise
    ws = cand;
  } catch (e) {
    lastConnErr = e;
    if (i % 10 === 0) log("CDP connect attempt", i + 1, "failed:", String((e && e.message) || e).slice(0, 140));
    await sleep(300);
  }
}
if (!ws) throw new Error("could not connect to Chrome CDP: " + ((lastConnErr && lastConnErr.message) || lastConnErr));
log("CDP connected");
// Watchdog: if the browser dies (OOM etc.), fail loudly instead of hanging
// forever on CDP promises that will never resolve.
ws.addEventListener("close", () => { try { log("FATAL: CDP websocket closed — browser died"); } catch {} process.exit(2); });
ws.addEventListener("error", () => { try { log("FATAL: CDP websocket error"); } catch {} process.exit(2); });
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
// Every CDP call carries a timeout: a call whose reply never arrives now
// rejects loudly (crashing the run with a durable log) instead of
// hanging silently forever, which is how the pre-fix runs died.
const cdp = (method, params = {}, timeoutMs = 45000) => new Promise((res, rej) => {
  const id = ++msgId;
  const to = setTimeout(() => { pending.delete(id); rej(new Error("CDP call timeout (" + timeoutMs + "ms): " + method)); }, timeoutMs);
  pending.set(id, v => { clearTimeout(to); res(v); });
  ws.send(JSON.stringify({ id, method, params }));
});
await cdp("Page.enable");
await cdp("Runtime.enable");
const ev = async expr => {
  // Retry transient navigation-window failures (verify2 run 4 died in
  // the Q7 boss fight when a flee crossed the return portal and one
  // evaluate landed mid-navigation: "Gameplay is not defined"). A page
  // that is loading a new map resolves within a few seconds.
  let lastErr = null;
  for (let i = 0; i < 6; i++) {
    const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true });
    if (!r.exceptionDetails) return r.result?.value;
    lastErr = new Error("eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
    const transient = /not defined|Cannot read|context/i.test(JSON.stringify(r.exceptionDetails));
    if (!transient) throw lastErr;
    await sleep(900);
  }
  throw lastErr;
};
async function pinViewport() {
  // All proof screenshots must be true 390x844. The emulation override can
  // be dropped by the headless shell, so re-assert it before every capture.
  let dims = await ev("window.innerWidth + 'x' + window.innerHeight");
  if (dims !== `${VW}x${VH}`) {
    await cdp("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
    await sleep(800);
    dims = await ev("window.innerWidth + 'x' + window.innerHeight");
    log("viewport re-pinned:", dims);
  }
  return dims;
}
async function shot(name) {
  await pinViewport();
  const r = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 90000);
  // A transient storage-layer EPERM killed a full run at this write
  // (2026-11-09); a screenshot must never be fatal — retry once, then
  // log the failure and continue without the image.
  const buf = Buffer.from(r.data, "base64");
  for (let i = 0; i < 2; i++) {
    try { writeFileSync(join(OUT, name), buf); log("shot:", name); return; }
    catch (e) { if (i === 1) log("shot FAILED (non-fatal):", name, e.code || e.message); else await sleep(1000); }
  }
}

// ------------------------------------------------------------- input (taps only)
let useTouch = false;
async function tap(x, y) {
  x = Math.round(x); y = Math.round(y);
  if (useTouch) {
    await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await sleep(45);
    await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await sleep(45);
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
  await sleep(60);
}
async function tapEl(selector) {
  const r = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null; const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  if (!r) throw new Error("element not found: " + selector);
  await tap(r.x, r.y);
}
async function state() { return ev("TL2.state()"); }
async function qs() { return ev("Gameplay.getQuestState()"); }
async function combat() { return ev("Gameplay.inspectCombat()"); }
// Rewards-wave addition (logging only): snapshot of the player's
// EXP/level/stat state, used after every quest turn-in.
async function statsLog(tag) {
  const c = await combat();
  log("STATS", tag, "xp", c.xp, "level", c.playerLevel,
      "hp", c.playerHp + "/" + c.playerMaxHp, "atk", c.playerAtk,
      "def", c.playerDef, "inv", JSON.stringify(c.inventory));
}
// Screen->world tap mapping: the exact inverse of the game's viewToPaint.
// The live viewport size is read from the page on EVERY tap — the headless
// shell can drop the 390x844 emulation mid-run, and the game sizes itself
// from innerWidth/innerHeight, so live values always match the game.
const MAP = { cx: VW / 2, cy: VH / 2, z: 0.75 };
async function tapWorld(wx, wy) {
  const s = await state();
  const dims = await ev("window.innerWidth + 'x' + window.innerHeight");
  const [iw, ih] = dims.split("x").map(Number);
  const sx = iw / 2 + (wx - s.cam[0]) * s.zoom;
  const sy = ih / 2 + (wy - s.cam[1]) * s.zoom;
  await tap(Math.max(4, Math.min(iw - 4, sx)), Math.max(4, Math.min(ih - 4, sy)));
}
async function settledState() {
  // wait until the player is idle and the camera has converged
  let prev = null;
  for (let i = 0; i < 40; i++) {
    const s = await state();
    if (!s.moving && s.path === 0 && prev &&
        Math.abs(s.cam[0] - prev.cam[0]) < 0.6 && Math.abs(s.cam[1] - prev.cam[1]) < 0.6) return s;
    prev = s;
    await sleep(200);
  }
  return state();
}
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

async function waitFor(fn, timeoutMs, label, pollMs = 200) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(pollMs);
  }
  throw new Error("timeout waiting: " + label);
}
async function waitArrive(hardCapMs = 900000) {
  // Arrived = player idle (or a dialogue popped open mid-way). The VM is CPU
  // throttled so game time runs several times slower than wall time: keep
  // waiting while the player is MOVING (progress), fail only on a genuine
  // stall (no position change for 30s) or the hard cap.
  await sleep(350);
  const t0 = Date.now();
  let lastX = null, lastY = null, lastMoveAt = Date.now(), lastBeat = Date.now();
  while (Date.now() - t0 < hardCapMs) {
    const s = await state(); const q = await qs();
    if (Date.now() - lastBeat > 30000) { // heartbeat: proves the run is alive during long walks
      lastBeat = Date.now();
      log("  …walking, at", Math.round(s.x) + "," + Math.round(s.y), "elapsed", Math.round((Date.now() - t0) / 1000) + "s");
    }
    if (q.dialogueOpen) return true;
    if (!s.moving && s.path === 0) return true;
    if (lastX === null || Math.hypot(s.x - lastX, s.y - lastY) > 4) {
      lastX = s.x; lastY = s.y; lastMoveAt = Date.now();
    } else if (Date.now() - lastMoveAt > 30000) {
      throw new Error("walk stalled (no progress for 30s) at " + Math.round(s.x) + "," + Math.round(s.y));
    }
    await sleep(250);
  }
  throw new Error("timeout waiting: arrival (hard cap)");
}
async function walkViaTracker(label) {
  log("walk via tracker ->", label || "");
  await tapEl("#questTracker");
  await waitArrive();
}
async function advanceDialogue(maxTaps = 16) {
  for (let i = 0; i < maxTaps; i++) {
    const q = await qs();
    if (!q.dialogueOpen) return;
    await tapEl("#dialogueAdvanceBtn");
    await sleep(240);
  }
  const q = await qs();
  if (q.dialogueOpen) throw new Error("dialogue did not finish");
}
async function talkAt(wx, wy, label) {
  log("talk at", label, wx, wy);
  for (let attempt = 0; attempt < 4; attempt++) {
    await tapWorld(wx, wy);
    const opened = await waitFor(async () => (await qs()).dialogueOpen || null, 4500, "dialogue open " + label, 200)
      .catch(() => null);
    if (opened) { await advanceDialogue(); return; }
    await waitArrive(120000).catch(() => {});
    // Interact-button fallback (verify2): on the 390x844 layout some NPC
    // anchors project UNDER the combat cluster (the Xích Viêm guardian's
    // anchor lands on btnUlt/btnDefend from several stand points, so the
    // canvas tap never happens). The game's own context Interact button
    // is the designed path for exactly this: it is real input, shown
    // when a context target is near, and routes through the same
    // handlePointerClick logic without screen projection.
    if (attempt >= 1) {
      const vis = await ev(`(() => { const b = document.querySelector('#btnInteract');
        return b && b.style.display !== 'none'; })()`).catch(() => false);
      if (vis) {
        await tapEl("#btnInteract");
        const opened2 = await waitFor(async () => (await qs()).dialogueOpen || null, 5000, "interact dialogue " + label, 200)
          .catch(() => null);
        if (opened2) { await advanceDialogue(); return; }
      }
    }
    // If the walk stopped just outside interaction range, step closer and
    // tap again — the pending-interact fires on arrival inside 115px.
    const s = await state();
    const d = dist(s.x, s.y, wx, wy);
    if (d > 100) {
      const ux = (wx - s.x) / d, uy = (wy - s.y) / d;
      await tapWorld(s.x + ux * (d - 55), s.y + uy * (d - 55));
      await waitArrive(60000).catch(() => {});
    }
  }
  throw new Error("could not open dialogue: " + label);
}
// Long-haul variant (verify2 run 7 lesson): after a portal round-trip the
// player may be ~2000px from the NPC and a single talkAt's step-closer
// taps cannot cover that. Each round first rides the quest tracker
// (tap #questTracker = the game's own guidance auto-walk, real input)
// toward the current target, then tries talkAt; repeat until it opens.
async function talkAtFar(wx, wy, label) {
  for (let round = 0; round < 6; round++) {
    try { await talkAt(wx, wy, label); return; }
    catch (e) { log("talkAtFar round", round, "failed:", e.message); }
    await walkViaTracker(label + " (round " + round + ")").catch(() => {});
    await waitArrive(120000).catch(() => {});
  }
  await talkAt(wx, wy, label); // final attempt — throws if it still fails
}

// Camp clearing (verify2 runs 7/9 root cause): the Xích Viêm guardian
// and the map spawn stand ~200px from the Hỏa Tinh Thử pack, whose
// aggro radius reaches both. Rats converge on a player who lingers to
// talk, and handlePointerClick checks monsters BEFORE NPCs — a rat
// chewing the player stands within the 45px tap-steal radius of the
// guardian's anchor, so every NPC tap becomes an attack command and
// the turn-in dialogue can never open (probe-verified: HP drained
// 383->43 at the stand, progress auto-incremented 5->9 from
// retaliation kills, dialogue never opened). A human player fights
// the camp off first, then talks. Do exactly that: kill every live
// monster inside the tap-steal zone of the guardian anchor, then talk at once
// (rats only respawn on map re-entry, so the window stays open).
async function clearCamp() {
  for (let i = 0; i < 10; i++) {
    const s = await state();
    if (s.map !== "xichviem") return;
    const c = await combat();
    const near = c.monsters.filter(m => !m.dead &&
        (dist(m.x, m.y, 1020, 840) <= 150 ||
         (m.state !== "IDLE" && dist(m.x, m.y, c.px, c.py) <= 170)))
      .sort((a, b) => dist(a.x, a.y, 1020, 840) - dist(b.x, b.y, 1020, 840))[0];
    if (!near) { log("camp clear around guardian"); return; }
    log("clearing camp monster", near.key, near.id, "at", near.x, near.y);
    await fightMonster(near.key, { timeoutMs: 240000 });
  }
}

async function tapPortal(wx, wy, expectHauson, label) {
  const hopDone = async () => {
    try {
      return (await ev(`location.search.includes('map=hauson') === ${expectHauson} && window.TL2 && TL2.ready()`)) || null;
    } catch { return null; }
  };
  // Attempt 0: tap the portal anchor directly.
  await tapWorld(wx, wy);
  if (await waitFor(hopDone, 25000, label, 300).catch(() => null)) { await sleep(1500); return; }
  // The anchor can project UNDER the quest-tracker HUD card when approached
  // from the quest stand (measured: elementFromPoint at the anchor's screen
  // point returns #questTracker, so the tap never reaches the canvas and
  // the player idles at the stand, 186px short of the r=85 trigger). A real
  // player would tap from the side: stage beside the portal, then tap the
  // anchor — the straight walk crosses the trigger circle.
  for (const side of [1, -1]) {
    await tapWorld(wx + side * 290, wy);
    await waitArrive(90000).catch(() => {});
    if (await hopDone()) { await sleep(1500); return; }
    await tapWorld(wx, wy);
    if (await waitFor(hopDone, 25000, label, 300).catch(() => null)) { await sleep(1500); return; }
    await waitArrive(60000).catch(() => {});
    if (await hopDone()) { await sleep(1500); return; }
  }
  throw new Error("portal hop failed: " + label);
}

// ------------------------------------------------------------- combat driver
const MON_H = { trucyeu: 190, linhlang: 92, thachve: 130, thachve_elite: 178,
                hoatinh: 95, hoanhamlang: 110, viemnham: 145, xichviem_elite: 185 };

// ---- finisher-verify2 assertion bookkeeping (honest PASS/FAIL lines) ----
let ASSERT_FAILS = 0;
function assert(name, cond, extra = "") {
  log(cond ? "ASSERT PASS" : "ASSERT FAIL", name, extra);
  if (!cond) ASSERT_FAILS++;
  return cond;
}
async function skills() { return ev("Gameplay.inspectSkills()"); }
async function dialogueText() {
  return ev(`(() => { const el = document.querySelector('#dialogueBox'); return el ? el.innerText : ''; })()`).catch(() => "");
}
// Walk toward a far world point in viewport-sized legs (real taps only).
async function walkToward(wx, wy, arriveDist = 280, maxLegs = 60) {
  for (let leg = 0; leg < maxLegs; leg++) {
    const s = await state();
    const d = dist(s.x, s.y, wx, wy);
    if (d <= arriveDist) return true;
    const ux = (wx - s.x) / d, uy = (wy - s.y) / d;
    const stepLen = Math.min(400, d - arriveDist + 120);
    await tapWorld(s.x + ux * stepLen, s.y + uy * stepLen);
    await waitArrive(120000).catch(() => {});
    const q = await qs();
    if (q.dialogueOpen) return true; // pending interact fired en route
  }
  return dist((await state()).x, (await state()).y, wx, wy) <= arriveDist + 80;
}
async function waitMap(expectMap, timeoutMs = 30000) {
  return waitFor(async () => {
    try { const s = await state(); return (s && s.map === expectMap && (await ev("window.TL2 && TL2.ready()"))) ? s : null; }
    catch { return null; }
  }, timeoutMs, "map change to " + expectMap, 300).catch(() => null);
}
// Wait until Gameplay (not just TL2) has finished init after a page
// load/hop: getQuestState().ready is G.initialized, which flips only
// after the save has been loaded. Reading quest state before this races
// the loader and shows a phantom fresh save (seen in verify2 run 1).
async function waitGameplayReady(timeoutMs = 60000) {
  return waitFor(async () => {
    try { const q = await qs(); return q && q.ready ? q : null; } catch { return null; }
  }, timeoutMs, "gameplay ready", 300).catch(() => null);
}
// Walk INTO a portal trigger circle (real movement only). Verify2 run 1
// diagnosis: tapping the portal's exact anchor from due north projects
// onto the HUD Defend/ULT buttons (390x844), so the tap never reaches
// the canvas. Staging EAST of the portal and tapping it from there puts
// the projection on the joystick pad, whose no-drag replay routes the
// tap through the game's own tapAt — the walk then crosses the trigger.
async function walkIntoPortal(wx, wy, expectMap, label) {
  log("walk into portal ->", label, wx, wy);
  for (let attempt = 0; attempt < 5; attempt++) {
    const s = await state();
    if (s.map === expectMap) { await waitGameplayReady(); return true; }
    const d = dist(s.x, s.y, wx, wy);
    if (attempt === 0 && d > 200) {
      // stage east of the portal first
      await walkToward(wx + 270, wy, 130);
    } else if (d < 150) {
      // step out of the arm band (east) so the portal can arm
      await walkToward(wx + 270, wy, 130);
    } else if (d > 500) {
      await walkToward(wx, wy, 300);
    }
    await tapWorld(wx, wy);
    const arrived = await waitMap(expectMap, 25000);
    if (arrived) { await sleep(800); await waitGameplayReady(); return true; }
    await waitArrive(60000).catch(() => {});
    if (await waitMap(expectMap, 5000)) { await waitGameplayReady(); return true; }
  }
  return (await state()).map === expectMap;
}
async function fightMonster(matchKey, { fleeDist = 300, timeoutMs = 900000, shotName = null } = {}) {
  const t0 = Date.now();
  let shotTaken = false;
  let lastApproachTap = 0, lastFleeKey = "", lastBeat = Date.now();
  let deadAtStart = null; // one-kill-per-call contract (see target selection note)
  // Persistent-HP ruling check (rewards wave, logging only): remember the
  // target's last HP seen while the player was alive; after a death +
  // respawn, verify the target did NOT refill to full.
  let lastTargetHp = null, lastTargetMax = null, hpAtDeath = null, wasDeadFM = false;
  while (Date.now() - t0 < timeoutMs) {
    const c = await combat(); const q = await qs();
    // Return as soon as THIS call has secured one kill (repaired
    // 2026-11-09: nearest-target selection alone turned the call into
    // "kill every monster of this kind on the map" — and the game
    // counts each Trúc Yêu kill twice, so Q3 turned ready_to_turn_in
    // mid-call, the tracker flipped to the turn-in, and the far-branch
    // below spun forever. The original design was one kill per call,
    // with the caller re-checking quest progress between calls.)
    const deadNow = c.monsters.filter(x => x.key === matchKey && x.dead).length;
    if (deadAtStart === null) deadAtStart = deadNow;
    else if (deadNow > deadAtStart) { log("  target dead:", matchKey); return true; }
    if (c.playerDead) {
      if (!wasDeadFM) {
        wasDeadFM = true;
        if (lastTargetHp !== null && lastTargetMax !== null && lastTargetHp < lastTargetMax) hpAtDeath = lastTargetHp;
      }
      log("  player dead, waiting respawn"); await sleep(900); continue;
    }
    if (wasDeadFM) {
      wasDeadFM = false;
      if (hpAtDeath !== null) {
        const tNow = c.monsters.find(x => x.key === matchKey && !x.dead);
        if (tNow) {
          log("  HP PERSISTENCE [" + matchKey + "]: hp at death", hpAtDeath, "-> after respawn", tNow.hp, "(max " + tNow.maxHp + ")",
            tNow.hp < tNow.maxHp ? "PASS — not refilled to full" : "FAIL — refilled to full",
            tNow.hp > hpAtDeath ? "(note: above death value — the pre-existing leash +20 regen can add a little; still not a refill)" : "");
        } else {
          log("  HP PERSISTENCE [" + matchKey + "]: target not found alive after respawn (hp at death was", hpAtDeath + ")");
        }
        hpAtDeath = null;
      }
    }
    // Engage the NEAREST live monster of the target kind (repaired
    // 2026-11-09: the original took the first-listed match, which
    // deadlocked Q3 — a read-only probe showed the player standing at a
    // Trúc Yêu's feet (dist 1, state TELEGRAPH) being beaten to death
    // repeatedly while this helper fixated on an IDLE namesake 829px
    // away: it never attacked, never fled, and its far-branch only
    // re-tapped the quest tracker. A player attacks the monster in
    // front of them. Selection only — no quest step, tap pattern,
    // assertion or screenshot point changed.)
    let m = null;
    for (const x of c.monsters) {
      if (x.key !== matchKey || x.dead) continue;
      if (!m || dist(c.px, c.py, x.x, x.y) < dist(c.px, c.py, m.x, m.y)) m = x;
    }
    if (!m) { log("  target dead:", matchKey); return true; }
    lastTargetHp = m.hp; lastTargetMax = m.maxHp;
    const d = dist(c.px, c.py, m.x, m.y);
    if (Date.now() - lastBeat > 30000) { // heartbeat during long fights
      lastBeat = Date.now();
      log("  …fighting", matchKey, "hp", m.hp, "playerHp", c.playerHp, "dist", Math.round(d), "elapsed", Math.round((Date.now() - t0) / 1000) + "s");
    }
    if (d > 520) {
      // Far away (e.g. after a death respawn): re-tapping the monster every
      // 700ms re-rolls the cross-map BFS each time and the player flip-flops
      // at river/bridge seams without ever committing. Use the game's own
      // guidance walk (one committed path to the target's stand) instead.
      await tapEl("#questTracker");
      await waitArrive(180000).catch(() => {});
      continue;
    }
    if (shotName && !shotTaken && d < 320) { await shot(shotName); shotTaken = true; }
    if (m.state === "TELEGRAPH" || m.state === "ATTACK") {
      const key = m.state + "@" + Math.round(m.x / 40) + "," + Math.round(m.y / 40);
      if (key !== lastFleeKey || d < 190) {
        lastFleeKey = key;
        const ux = (c.px - m.x) / (d || 1), uy = (c.py - m.y) / (d || 1);
        await tapWorld(c.px + ux * fleeDist, c.py + uy * fleeDist);
      }
      await sleep(120);
      continue;
    }
    if (d > 100) {
      if (Date.now() - lastApproachTap > 700) {
        lastApproachTap = Date.now();
        await tapWorld(m.x, m.y - MON_H[matchKey] * 0.4);
      }
    } else {
      await tapEl("#mobileAtkBtn");
      // Kite: when the monster presses in, step back out of its basic reach
      // between swings instead of facetanking every hit.
      if (m.state === "MOVE" && d < 78) {
        const ux = (c.px - m.x) / (d || 1), uy = (c.py - m.y) / (d || 1);
        await tapWorld(c.px + ux * 130, c.py + uy * 130);
      }
    }
    await sleep(130);
  }
  throw new Error("fight timeout: " + matchKey);
}

// =============================================================== MAIN FLOW
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
await waitFor(async () => {
  try { return (await ev("window.TL2 && TL2.ready() && window.Gameplay && !!Gameplay.getQuestState()")) || null; }
  catch { return null; }
}, 30000, "game ready");
log("game ready; quest:", JSON.stringify(await qs()));
await statsLog("START");

// The HUD proof and all tap math require the page to REALLY be 390x844 CSS
// pixels. The launch flags pin it; verify, and repair via emulation if the
// window size did not take.
{
  let dims = await ev("window.innerWidth + 'x' + window.innerHeight");
  if (dims !== `${VW}x${VH}`) {
    log("viewport is", dims, "— applying device metrics override");
    await cdp("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
    await sleep(600);
    dims = await ev("window.innerWidth + 'x' + window.innerHeight");
  }
  log("viewport:", dims, "dpr:", await ev("window.devicePixelRatio"));
  if (dims !== `${VW}x${VH}`) throw new Error("could not pin viewport to " + VW + "x" + VH + " (got " + dims + ")");
  const s = await state();
  MAP.cx = VW / 2; MAP.cy = VH / 2; MAP.z = s.zoom;
}
// Liveness probe: a plain ground tap must move the player toward the aim
// point under the natural rAF loop (nobody pumps update in this driver).
// Rest positions are nav-cell centres, so direction is asserted, not pixels.
{
  const s0 = await settledState();
  await tapWorld(s0.x + 170, s0.y + 60);
  const s1 = await settledState();
  const dx = s1.x - s0.x, dy = s1.y - s0.y;
  const moved = Math.hypot(dx, dy);
  const dot = (dx * 170 + dy * 60) / (moved * Math.hypot(170, 60) || 1);
  log("liveness probe: moved", Math.round(moved), "px; direction cos", dot.toFixed(2));
  if (moved < 50 || dot < 0.8) throw new Error("tap-to-move not tracking aim");
}
await shot("hud_island_top.png");

// ---------- (a) SEAL TEST: pre-Q8, the dais portal must refuse ----------
// Fresh save, quest index 0. Walk to the dais and interact: the seal
// dialogue must open, the map must NOT change, the quest must NOT move.
{
  await walkToward(2820, 1572, 320);
  await talkAt(2820, 1572, "dais_qt (seal test, pre-Q8)");
  // talkAt already advanced the dialogue to completion; re-open once to
  // capture the seal text if the first pass closed too fast is not
  // possible — instead judge from a fresh interaction below.
  const sAfter = await state();
  const qAfter = await qs();
  assert("(a) seal: map unchanged after pre-Q8 dais interaction", sAfter.map === "island", "map=" + sAfter.map);
  assert("(a) seal: quest still at index 0", qAfter.index === 0, JSON.stringify(qAfter));
  // Second interaction purely to photograph + read the refusal text:
  await tapWorld(2820, 1572);
  const opened = await waitFor(async () => (await qs()).dialogueOpen || null, 6000, "seal dialogue reopen", 200).catch(() => null);
  if (opened) {
    const txt = await dialogueText();
    log("seal dialogue text:", txt.replace(/\s+/g, " ").slice(0, 220));
    assert("(a) seal: refusal text mentions the seal (phong ấn)", /phong ấn/i.test(txt), txt.slice(0, 80));
    await shot("00_sealed_gate.png");
    await advanceDialogue();
  } else {
    assert("(a) seal: refusal dialogue opens on interaction", false, "dialogue did not open on second tap");
  }
  assert("(a) seal: still on island after refusal dialogue", (await state()).map === "island");
}

// ---------- Q1: accept from Tiên Đồng, turn in at Chấp Sự
await walkViaTracker("Q1 giver tiendong");
await talkAt(2405, 2425, "npc_tiendong");
log("Q1 after accept:", JSON.stringify(await qs()));
await walkViaTracker("Q1 target chapsu");
await talkAt(2665, 1615, "npc_chapsu (Q1 turn-in)");
log("Q1 done ->", JSON.stringify(await qs()));
await statsLog("after Q1 turn-in");
await shot("q1_turnin.png");

// ---------- Q2: accept from Chấp Sự, activate the dais
await talkAt(2665, 1615, "npc_chapsu (Q2 accept)");
await walkViaTracker("Q2 dais stand");
await talkAt(2820, 1572, "dais_qt (Q2)");
log("Q2 done ->", JSON.stringify(await qs()));
await statsLog("after Q2 turn-in");
await shot("q2_turnin.png");

// ---------- Q3: accept from Trưởng Lão Võ, kill 5 Trúc Yêu, turn in
await walkViaTracker("Q3 giver truonglao");
await talkAt(3380, 985, "npc_truonglao (Q3 accept)");
{
  let guard = 0;
  while ((await qs()).progress < 5) {
    if (++guard > 14) throw new Error("Q3 kill loop stuck");
    // re-target via tracker if far from any trucyeu
    const c = await combat();
    const alive = c.monsters.filter(m => m.key === "trucyeu" && !m.dead);
    if (!alive.length) throw new Error("no trucyeu left but progress < 5");
    const near = alive.some(m => dist(c.px, c.py, m.x, m.y) < 700);
    if (!near) await walkViaTracker("Q3 next trucyeu");
    await fightMonster("trucyeu", { fleeDist: 300, shotName: guard === 1 ? "q3_combat.png" : null });
    log("Q3 progress:", (await qs()).progress, "/5");
  }
}
await walkViaTracker("Q3 turn-in");
await talkAt(3380, 985, "npc_truonglao (Q3 turn-in)");
log("Q3 done ->", JSON.stringify(await qs()));
await statsLog("after Q3 turn-in");
await shot("q3_turnin.png");

// ---------- Q4: accept from Đan Dược Sư, gather 5 herbs, turn in
await walkViaTracker("Q4 giver dansu");
await talkAt(1560, 1795, "npc_dansu (Q4 accept)");
{
  const quests = JSON.parse(readFileSync(join(ROOT, "data/Map_Quests.json"), "utf8"));
  const herbs = quests.quests.find(q => q.id === "q4_thu_thap_linh_thao").targets;
  let guard = 0;
  while ((await qs()).herbs < 5) {
    if (++guard > 12) throw new Error("Q4 herb loop stuck");
    const c = await combat();
    const next = herbs.find(h => !c.gathered.includes(h.object));
    if (!next) break;
    // Gather one herb, with retries (repaired 2026-11-09: the original
    // single-shot step died at herb_node_2 — the player, on 64 HP after
    // Q3, was killed by a Trúc Yêu during the tracker walk; death reads
    // as "arrived" to waitArrive, the follow-up tapWorld from the
    // respawn point is clamped to the visible edge, and the 90s herb
    // wait expired with the player standing 1,224px from the node,
    // HP restored to full by the respawn. A player who dies walks back
    // and tries again: re-approach via the game's own tracker until
    // actually standing at the node, then tap it.)
    let gathered = false;
    for (let attempt = 0; attempt < 4 && !gathered; attempt++) {
      await walkViaTracker("Q4 herb " + next.object + (attempt ? " (retry " + attempt + ")" : ""));
      for (let leg = 0; leg < 5; leg++) {
        const cc = await combat();
        if (dist(cc.px, cc.py, next.anchor_px[0], next.anchor_px[1]) <= 160) break;
        await tapEl("#questTracker");
        await waitArrive(180000).catch(() => {});
      }
      // tap the herb node itself: starts the channel in range, else walks and
      // the pending-interact callback starts it on arrival
      await tapWorld(next.anchor_px[0], next.anchor_px[1]);
      const before = (await qs()).herbs;
      gathered = await waitFor(async () => ((await qs()).herbs > before) || null, 120000, "herb gathered " + next.object, 250)
        .then(() => true).catch(() => false);
      if (!gathered) log("Q4 herb attempt", attempt + 1, "failed for", next.object, "— walking back");
    }
    if (!gathered) throw new Error("herb step failed after retries: " + next.object);
    log("Q4 herbs:", (await qs()).herbs, "/5");
    if (guard === 1) await shot("q4_gather.png");
  }
}
await walkViaTracker("Q4 turn-in");
await talkAt(1560, 1795, "npc_dansu (Q4 turn-in)");
log("Q4 done ->", JSON.stringify(await qs()));
await statsLog("after Q4 turn-in");
await shot("q4_turnin.png");

// ---------- Q5: accept, talk to Thủ Vệ, cave-mouth dialogue (auto-open)
// Design note (verified by a seeded diagnostic): the guard's stand (728,610)
// is INSIDE the cave trigger radius (dist to (655,600) is ~74px <= 80), so
// the cave dialogue chains immediately after the guard dialogue inside the
// same talk: one talkAt advances guard dialogue -> progress 1 -> cave
// dialogue -> quest complete. Success is therefore judged on quest INDEX,
// not on progress==1 (which is only visible mid-chain).
await walkViaTracker("Q5 giver chapsu");
await talkAt(2665, 1615, "npc_chapsu (Q5 accept)");
await walkViaTracker("Q5 guard thuve");
{
  let caveShot = false;
  const advanceWatching = async () => {
    for (let i = 0; i < 20; i++) {
      const q = await qs();
      if (!q.dialogueOpen) break;
      if (!caveShot) {
        const spk = await ev(`(() => { const el = document.querySelector('#dialogueBox'); return el ? el.innerText.slice(0, 80) : ''; })()`);
        if (spk && spk.includes("Miệng Vân Ẩn Động")) { await shot("q5_cave.png"); caveShot = true; }
      }
      await tapEl("#dialogueAdvanceBtn");
      await sleep(240);
    }
  };
  let done = false;
  for (let attempt = 0; attempt < 3 && !done; attempt++) {
    if (!(await qs()).dialogueOpen) await tapWorld(720, 645);
    const opened = await waitFor(async () => (await qs()).dialogueOpen || null, 8000, "guard/cave dialogue", 200).catch(() => null);
    if (opened) await advanceWatching();
    else await waitArrive(60000).catch(() => {});
    const q = await qs();
    log("Q5 state after attempt", attempt + 1, JSON.stringify(q));
    if (q.index > 4) done = true;
    else if (q.index === 4 && q.progress === 1) {
      // Cave step still separate: walk to the mouth; it auto-opens once.
      let opened2 = null;
      for (let a = 0; a < 3 && !opened2; a++) {
        await tapWorld(655, 600);
        opened2 = await waitFor(async () => (await qs()).dialogueOpen || null, 20000, "cave dialogue", 250).catch(() => null);
      }
      if (!opened2) throw new Error("cave dialogue never opened");
      if (!caveShot) { await shot("q5_cave.png"); caveShot = true; }
      await advanceWatching();
      done = (await qs()).index > 4;
    }
  }
  if (!done) throw new Error("Q5 did not complete");
}
log("Q5 done ->", JSON.stringify(await qs()));
await statsLog("after Q5 turn-in (= stats entering Q6)");
await shot("q5_turnin.png");

// ---------- Q6: accept from Thủ Vệ, kill the elite, turn in
if ((await qs()).dialogueOpen) await advanceDialogue(); // stray-dialogue guard
await talkAt(720, 645, "npc_thuve (Q6 accept)");
await fightMonster("thachve_elite", { fleeDist: 330, timeoutMs: 900000, shotName: "q6_elite.png" });
log("Q6 after elite kill:", JSON.stringify(await qs()));
await statsLog("after Q6 elite kill (pre turn-in)");
await walkViaTracker("Q6 turn-in");
await talkAt(720, 645, "npc_thuve (Q6 turn-in)");
log("Q6 done ->", JSON.stringify(await qs()));
await statsLog("after Q6 turn-in (= stats entering boss)");
await shot("q6_turnin.png");

// ---------- Q7: accept from Chưởng Môn, portal to Hậu Sơn, boss 3 phases
await walkViaTracker("Q7 giver chuongmon");
if ((await qs()).dialogueOpen) await advanceDialogue(); // stray-dialogue guard
await talkAt(2200, 1215, "npc_chuongmon (Q7 accept)");
await walkViaTracker("Q7 portal stand");
await tapPortal(1560, 746, true, "map hop to hauson"); // tap the portal itself
log("on hauson; quest:", JSON.stringify(await qs()));
await statsLog("on hauson (boss entry)");
await shot("q7_hauson_arrival.png");

// Boss fight — honest tactics: close in, swing, flee every telegraph.
{
  const t0 = Date.now();
  let deaths = 0, wasDead = false;
  let shotP1 = false, shotP2 = false, shotP3 = false, hudShot = false;
  let lastTap = 0, lastFleeKey = "", lastBeat = Date.now();
  // Persistent-HP ruling checks (rewards wave, logging + one deliberate
  // death): track the boss's HP/phase while the player is alive so a
  // death -> respawn cycle can be audited for the forbidden full refill.
  let prevBossHp = null, prevBossPhase = null, bossHpAtDeath = null;
  let deliberateDone = false, deliberateActive = false, deliberateT0 = 0;
  while (Date.now() - t0 < 45 * 60 * 1000) {
    const c = await combat(); const q = await qs();
    if (!c.boss) {
      // Verify2 run 5: a flee/knockback carried the player through the
      // return portal mid-fight. Walk back through and keep fighting —
      // the boss keeps its HP (persistence law), so nothing is lost.
      const sm = (await state()).map;
      log("  boss loop: boss not present (map=" + sm + ") — returning to the arena");
      if (sm === "island") {
        await walkToward(1560, 890, 220).catch(() => {});
        await tapPortal(1560, 746, true, "re-enter hauson mid-fight").catch(() => {});
      }
      await sleep(1000);
      continue;
    }
    if (c.boss && Date.now() - lastBeat > 30000) { // heartbeat during the boss fight
      lastBeat = Date.now();
      log("  …boss fight: phase", c.boss.phase, "bossHp", c.boss.hp, "state", c.boss.state, "playerHp", c.playerHp, "deaths", deaths, "elapsed", Math.round((Date.now() - t0) / 1000) + "s");
    }
    if (c.boss.dead) { log("BOSS DEAD after", Math.round((Date.now() - t0) / 1000), "s, deaths:", deaths); break; }
    if (c.playerDead) {
      if (!wasDead) {
        deaths++; log("  player died in boss fight, death #", deaths);
        if (prevBossHp !== null && c.boss && prevBossHp < c.boss.maxHp) {
          bossHpAtDeath = prevBossHp;
          log("  boss hp at moment of death:", prevBossHp, "phase", prevBossPhase);
        }
      }
      wasDead = true;
      await sleep(800);
      continue;
    }
    if (wasDead && bossHpAtDeath !== null && c.boss) {
      log("BOSS HP PERSISTENCE: hp at death", bossHpAtDeath, "-> after respawn", c.boss.hp, "(max " + c.boss.maxHp + "), phase now", c.boss.phase,
        c.boss.hp < c.boss.maxHp ? "PASS — boss did not refill" : "FAIL — boss refilled to full");
      if (deliberateActive) { deliberateActive = false; deliberateDone = true; log("DELIBERATE DEATH CHECK: complete"); }
      bossHpAtDeath = null;
    }
    wasDead = false;
    const b = c.boss;
    prevBossHp = b.hp; prevBossPhase = b.phase;
    const d = dist(c.px, c.py, b.x, b.y);
    if (!shotP1 && b.engaged) { await shot("q7_boss_phase1.png"); shotP1 = true; }
    if (!hudShot && b.engaged) { await shot("hud_hauson_boss.png"); hudShot = true; }
    if (b.phase === 2 && !shotP2) { await shot("q7_boss_phase2.png"); shotP2 = true; log("phase 2 reached, boss hp", b.hp); }
    if (b.phase === 3 && !shotP3) { await shot("q7_boss_phase3.png"); shotP3 = true; log("phase 3 reached, boss hp", b.hp); }
    if (!b.engaged) {
      if (Date.now() - lastTap > 800) { lastTap = Date.now(); await tapWorld(b.x, b.y - 100); }
      await sleep(150);
      continue;
    }
    // Deliberate-death probe (rewards wave): with the boss genuinely
    // damaged, die ONCE on purpose — walk into range, then no attacks and
    // no fleeing — so the BOSS HP PERSISTENCE line above can prove the
    // boss keeps its HP/phase across a player death. One attempt only;
    // afterwards the fight continues honestly to the kill.
    if (!deliberateDone && b.hp < b.maxHp && b.hp > 250) {
      if (!deliberateActive) {
        deliberateActive = true; deliberateT0 = Date.now();
        log("DELIBERATE DEATH CHECK: boss at", b.hp, "hp, phase", b.phase, "— standing in range to die once (no attack, no flee)");
      }
      if (Date.now() - deliberateT0 > 300000) {
        log("DELIBERATE DEATH CHECK: player did not die within 300s — continuing honest fight");
        deliberateActive = false; deliberateDone = true;
      } else {
        if (d > 110) {
          if (Date.now() - lastTap > 700) { lastTap = Date.now(); await tapWorld(b.x, b.y - 100); }
        }
        await sleep(150);
        continue;
      }
    }
    const st = b.state;
    if (st.startsWith("TELEGRAPH")) {
      const ux = (c.px - b.x) / (d || 1), uy = (c.py - b.y) / (d || 1);
      let fx, fy, key;
      if (st === "TELEGRAPH_ROAR") { fx = c.px + ux * 680; fy = c.py + uy * 680; key = "roar"; }
      else if (st === "TELEGRAPH_DASH") {
        const px2 = -uy, py2 = ux; // perpendicular sidestep + slight away
        fx = c.px + px2 * 270 + ux * 90; fy = c.py + py2 * 270 + uy * 90; key = "dash";
      } else { fx = c.px + ux * 300; fy = c.py + uy * 300; key = "swipe"; }
      const fk = key + "@" + Math.round(b.x / 50) + "," + Math.round(b.y / 50) + "@" + b.hp;
      if (fk !== lastFleeKey) { lastFleeKey = fk; await tapWorld(fx, fy); }
      await sleep(110);
      continue;
    }
    if (st.startsWith("ATTACK")) { await sleep(120); continue; }
    if (st === "PHASE_TRANSITION") { await sleep(200); continue; }
    // MOVE / IDLE / HIT: engage
    if (d > 150) {
      if (Date.now() - lastTap > 700) { lastTap = Date.now(); await tapWorld(b.x, b.y - 130); }
    } else {
      await tapEl("#mobileAtkBtn");
    }
    await sleep(120);
  }
  const cEnd = await combat();
  if (!cEnd.boss || !cEnd.boss.dead) {
    throw new Error("BOSS WALL: boss not beaten in honest play. boss=" + JSON.stringify(cEnd.boss) +
      " playerHp=" + cEnd.playerHp + " deaths reached phase " + (cEnd.boss ? cEnd.boss.phase : "?"));
  }
  await shot("q7_boss_death.png");
}
// Victory dialogue opens by itself on the kill
await waitFor(async () => (await qs()).dialogueOpen || null, 8000, "victory dialogue");
await advanceDialogue();
log("Q7 after boss:", JSON.stringify(await qs()));
// Back through the return portal
await walkViaTracker("Q7 return portal");
await tapPortal(1120, 1015, false, "map hop back to island");
await walkViaTracker("Q7 turn-in");
await talkAt(2200, 1215, "npc_chuongmon (Q7 turn-in)");
log("Q7 done ->", JSON.stringify(await qs()));
await statsLog("after Q7 turn-in");
await shot("q7_turnin.png");

// ---------- Q8: accept, step on the dais, ending
if ((await qs()).dialogueOpen) await advanceDialogue(); // stray-dialogue guard
await talkAt(2200, 1215, "npc_chuongmon (Q8 accept)");
await walkViaTracker("Q8 dais stand");
await talkAt(2820, 1572, "dais_qt (Q8 ending)");
{
  const q = await qs(); const c = await combat();
  log("After Q8 quest state:", JSON.stringify(q));
  await statsLog("after Q8 turn-in");
  // (b) Q8's rewritten ending block must still land its 600 XP through
  // applyQuestRewards: cumulative 60+90+200+200+250+350+500+600 = 2250,
  // which the appended levels table reads as level 8 (row xpNeed 2000).
  assert("(b) XP after Q8 turn-in == 2250", c.xp === 2250, "xp=" + c.xp);
  assert("(b) level after Q8 == 8", c.playerLevel === 8, "level=" + c.playerLevel);
  assert("(b) chain advances to Q9 (index 8, not_accepted)", q.index === 8 && q.state === "not_accepted" && q.quest === "q9_pha_an_nhap_coc", JSON.stringify(q));
}
await shot("q8_ending.png");

// ---------- Q9 accept at the dais (dialogue hop into Xích Viêm Cốc) ----
assert("guidance Q9 not_accepted points at the dais giver",
  ((await qs()).activeTarget || "").includes("Đài Truyền Tống"), (await qs()).activeTarget || "");
{
  // Q9 accept: tap the dais, then advance the intro dialogue line by
  // line with navigation-tolerant polling — its completion reloads the
  // page into xichviem, which would make a rigid advance loop throw.
  log("talk at dais_qt (Q9 accept) 2820 1572");
  await tapWorld(2820, 1572);
  const opened = await waitFor(async () => {
    try { return (await qs()).dialogueOpen || null; } catch { return null; }
  }, 8000, "Q9 intro dialogue", 200).catch(() => null);
  if (!opened) throw new Error("Q9 intro dialogue never opened at the dais");
  for (let i = 0; i < 16; i++) {
    let open = false;
    try { open = (await qs()).dialogueOpen; } catch { break; } // navigating
    if (!open) break;
    await tapEl("#dialogueAdvanceBtn").catch(() => {});
    await sleep(300);
    let m = null;
    try { m = (await state()).map; } catch { /* mid-navigation */ }
    if (m === "xichviem") break;
  }
}
// The Q9 acceptance dialogue teleports the page to ?map=xichviem.
{
  const onXv = await waitMap("xichviem", 30000);
  assert("Q9 accept dialogue transports player to xichviem", !!onXv);
  await waitGameplayReady();
  const q = await qs();
  assert("Q9 state active after accept", q.index === 8 && q.state === "active", JSON.stringify(q));
  assert("guidance Q9 active resolves to the Xích Viêm guardian on xichviem",
    (q.activeTarget || "").includes("Thủ Hộ Giả"), q.activeTarget || "");
  await statsLog("on xichviem (Q9 active)");
  await shot("q9_arrival_xichviem.png");
  await shot("xichviem_south_edge.png"); // camera-clamp proof at the spawn (south edge)
}

// ---------- (c) PORTAL tests: return hop, RELOAD, portal still works ---
{
  const back = await walkIntoPortal(1120, 1015, "island", "xichviem return portal");
  assert("(c) walking into xichviem portal returns to island", back);
  const qBack = await qs();
  assert("(c) cross-map guidance on island points at the dais portal toward xichviem",
    (qBack.activeTarget || "").includes("Xích Viêm"), qBack.activeTarget || "");
  await shot("portal_back_on_island.png");
  // Reload the page with the post-Q8 save (questIndex 8): main.js must
  // re-inject the portal from the save and it must still fire.
  await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?map=island` });
  const ready = await waitGameplayReady(45000);
  assert("(c) game reloads with post-Q8 save", !!ready && ready.index === 8, JSON.stringify(ready));
  const fwd = await walkIntoPortal(2820, 1572, "xichviem", "island dais portal after RELOAD");
  assert("(c) after RELOAD, walking into dais portal travels to xichviem", fwd);
  await shot("portal_entry_after_reload.png");
}

// ---------- Q9 turn-in at the guardian ----------------------------------
await clearCamp(); await talkAtFar(1020, 840, "npc_xichviem_tientri (Q9 turn-in)");
{
  const q = await qs(); const c = await combat();
  await statsLog("after Q9 turn-in");
  assert("(d) Q9 turn-in +650 -> XP 2900", c.xp === 2900, "xp=" + c.xp);
  assert("(d) chain advances to Q10", q.index === 9 && q.quest === "q10_tru_diet_hoa_tinh", JSON.stringify(q));
}
await shot("q9_turnin.png");

// ---------- Skill visibility on xichviem (post-expansion regression) ---
// SK1 directional + SK2 single-target must actually fire pack frames and
// damage a monster on THIS map (the expansion's helpers originally
// gated skills to island/hauson only). The dummy is a Hỏa Nham Lang —
// deliberately NOT a quest monster: verify2 run 3 killed the staged
// Hỏa Tinh Thử here, and a kill made before Q10 is accepted does not
// count toward Q10, which stranded the chain at 4/5 with no rats left.
// Run 7 lesson: judging ONLY the staged lang's HP is unsound — the lang
// leashes/telegraphs (it can step out of the wedge before the hit
// lands) and SK2's auto-target legitimately picks the NEAREST enemy,
// which may be a rat standing closer than the lang. So: face the dummy
// with an overshoot ground tap, cast immediately, and judge damage on
// the WHOLE monster HP map (any drop = the skill dealt damage on this
// map; the log records exactly which monster took it).
{
  const hpMap = async () => Object.fromEntries((await combat()).monsters.map(m => [m.id, m.hp]));
  const drops = (before, after) => Object.keys(before)
    .filter(id => after[id] !== undefined && after[id] < before[id])
    .map(id => id + " " + before[id] + "->" + after[id]);
  const c0 = await combat();
  const rat = c0.monsters.filter(m => m.key === "hoanhamlang" && !m.dead)
    .sort((a, b) => dist(c0.px, c0.py, a.x, a.y) - dist(c0.px, c0.py, b.x, b.y))[0];
  assert("skill check: a live Hỏa Nham Lang is staged", !!rat, rat ? rat.id : "none");
  if (rat) {
    await walkToward(rat.x, rat.y, 130);
    // Overshoot facing tap: ground point 55px past the dummy's CURRENT
    // position — sets cast facing through the dummy without a tap on
    // the actor itself (no basic-attack contamination).
    {
      const c = await combat(); const t = c.monsters.find(m => m.id === rat.id);
      if (t) {
        const d = Math.max(1, Math.hypot(t.x - c.px, t.y - c.py));
        await tapWorld(t.x + (t.x - c.px) / d * 55, t.y + (t.y - c.py) / d * 55);
      }
    }
    await sleep(300);
    let before = await hpMap();
    // SK1
    const frames = new Set(); let castSeen = false;
    await tapEl("#btnSkill1");
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) {
      const sk = await skills();
      if (sk.casting && sk.casting.skill === "sk_thaicuc_chuong") {
        castSeen = true; frames.add(sk.casting.frame);
        if (frames.size >= 2 && castSeen) { await shot("skill_sk1_xichviem.png"); break; }
      } else if (castSeen) break;
      await sleep(60);
    }
    await waitFor(async () => ((await skills()).casting ? null : true), 12000, "SK1 cast end").catch(() => null);
    await sleep(2500);
    let after = await hpMap();
    let d1 = drops(before, after);
    log("SK1 on xichviem: castSeen", castSeen, "frames", [...frames].join(","), "damage:", d1.join(" | ") || "none");
    assert("skill SK1 casts on xichviem (pack frames progress)", castSeen && frames.size >= 1);
    assert("skill SK1 damages a xichviem monster", d1.length > 0, d1.join(" | ") || "no hp drop");
    // SK2 (single, auto-target nearest)
    if ((await combat()).playerMp >= 18) {
      before = await hpMap();
      let cast2 = false; const frames2 = new Set();
      await tapEl("#btnSkill2");
      const t1 = Date.now();
      while (Date.now() - t1 < 12000) {
        const sk = await skills();
        if (sk.casting && sk.casting.skill === "sk_kimcang_quyen") { cast2 = true; frames2.add(sk.casting.frame); if (frames2.size >= 2) break; }
        else if (cast2) break;
        await sleep(60);
      }
      await waitFor(async () => ((await skills()).casting ? null : true), 12000, "SK2 cast end").catch(() => null);
      await sleep(2500);
      after = await hpMap();
      const d2 = drops(before, after);
      log("SK2 on xichviem: castSeen", cast2, "frames", [...frames2].join(","), "damage:", d2.join(" | ") || "none");
      assert("skill SK2 casts on xichviem (auto-target works)", cast2);
      assert("skill SK2 damages its xichviem target", d2.length > 0, d2.join(" | ") || "no hp drop");
    } else {
      log("SK2 check skipped: MP low (SK1 evidence stands)");
    }
  }
}

// ---------- Q10: kill 5 Hỏa Tinh Thử, turn in ---------------------------
await clearCamp(); await talkAtFar(1020, 840, "npc_xichviem_tientri (Q10 accept)");
{
  const q = await qs();
  assert("Q10 accepted (active)", q.index === 9 && q.state === "active", JSON.stringify(q));
  assert("guidance Q10 active resolves to Hỏa Tinh Thử on xichviem",
    (q.activeTarget || "").includes("Hỏa Tinh"), q.activeTarget || "");
}
{
  let guard = 0;
  while ((await qs()).progress < 5) {
    if (++guard > 14) throw new Error("Q10 kill loop stuck at progress " + (await qs()).progress);
    const c = await combat();
    const alive = c.monsters.filter(m => m.key === "hoatinh" && !m.dead);
    if (!alive.length) {
      // Recovery (honest inputs only): monsters re-init on every map
      // load, so a portal round-trip respawns the pack. Needed only if
      // a rat died before Q10 was accepted (kills outside the active
      // quest do not count toward it).
      log("Q10 recovery: no live hoatinh — portal round-trip to respawn the pack");
      await walkIntoPortal(1120, 1015, "island", "Q10 recovery exit");
      await walkIntoPortal(2820, 1572, "xichviem", "Q10 recovery re-entry");
      const c2 = await combat();
      if (!c2.monsters.some(m => m.key === "hoatinh" && !m.dead)) throw new Error("no hoatinh even after map re-entry");
      continue;
    }
    const near = alive.some(m => dist(c.px, c.py, m.x, m.y) < 700);
    if (!near) await walkViaTracker("Q10 next hoatinh");
    await fightMonster("hoatinh", { fleeDist: 300, shotName: guard === 1 ? "q10_combat.png" : null });
    log("Q10 progress:", (await qs()).progress, "/5");
  }
}
await walkViaTracker("Q10 turn-in");
await clearCamp(); await talkAtFar(1020, 840, "npc_xichviem_tientri (Q10 turn-in)");
{
  const q = await qs(); const c = await combat();
  await statsLog("after Q10 turn-in");
  assert("(e) Q10 turn-in +750 -> XP 3650", c.xp === 3650, "xp=" + c.xp);
  assert("(e) chain advances to Q11", q.index === 10 && q.quest === "q11_thu_thap_viem_tinh", JSON.stringify(q));
}
await shot("q10_turnin.png");

// ---------- Q11: gather 5 Viêm Tinh nodes, turn in ----------------------
await clearCamp(); await talkAtFar(1020, 840, "npc_xichviem_tientri (Q11 accept)");
{
  const q = await qs();
  assert("Q11 accepted (active)", q.index === 10 && q.state === "active", JSON.stringify(q));
  assert("guidance Q11 active resolves to a Viêm Tinh node",
    (q.activeTarget || "").includes("Viêm Tinh"), q.activeTarget || "");
}
{
  const quests = JSON.parse(readFileSync(join(ROOT, "data/Map_Quests.json"), "utf8"));
  const nodes = quests.quests.find(q => q.id === "q11_thu_thap_viem_tinh").targets;
  let guard = 0;
  while ((await qs()).progress < 5) {
    if (++guard > 12) throw new Error("Q11 gather loop stuck at " + (await qs()).progress);
    const c = await combat();
    const next = nodes.find(n => !c.gathered.includes(n.object));
    if (!next) break;
    let gathered = false;
    for (let attempt = 0; attempt < 4 && !gathered; attempt++) {
      await walkViaTracker("Q11 node " + next.object + (attempt ? " (retry " + attempt + ")" : ""));
      for (let leg = 0; leg < 5; leg++) {
        const cc = await combat();
        if (dist(cc.px, cc.py, next.anchor_px[0], next.anchor_px[1]) <= 160) break;
        await tapEl("#questTracker");
        await waitArrive(180000).catch(() => {});
      }
      await tapWorld(next.anchor_px[0], next.anchor_px[1]);
      const before = (await qs()).progress;
      gathered = await waitFor(async () => ((await qs()).progress > before) || null, 90000, "node gathered " + next.object, 250)
        .then(() => true).catch(() => false);
      if (!gathered) log("Q11 node attempt", attempt + 1, "failed for", next.object, "— walking back");
    }
    if (!gathered) throw new Error("Q11 node step failed after retries: " + next.object);
    log("Q11 progress:", (await qs()).progress, "/5");
    if (guard === 1) await shot("q11_gather.png");
  }
}
await walkViaTracker("Q11 turn-in");
await clearCamp(); await talkAtFar(1020, 840, "npc_xichviem_tientri (Q11 turn-in)");
{
  const q = await qs(); const c = await combat();
  await statsLog("after Q11 turn-in");
  assert("(f) Q11 turn-in +800 -> XP 4450", c.xp === 4450, "xp=" + c.xp);
  assert("(f) chain advances to Q12", q.index === 11 && q.quest === "q12_viem_tinh_thuc_tinh", JSON.stringify(q));
}
await shot("q11_turnin.png");

// ---------- Q12: kill Xích Viêm Tinh Anh elite, turn in -----------------
await clearCamp(); await talkAtFar(1020, 840, "npc_xichviem_tientri (Q12 accept)");
{
  const q = await qs();
  assert("Q12 accepted (active)", q.index === 11 && q.state === "active", JSON.stringify(q));
  assert("guidance Q12 active resolves to Xích Viêm Tinh Anh",
    (q.activeTarget || "").includes("Tinh Anh"), q.activeTarget || "");
  await shot("guidance_q12.png"); // off-screen edge arrow toward the elite (north)
}
await fightMonster("xichviem_elite", { fleeDist: 330, timeoutMs: 1200000, shotName: "q12_elite.png" });
log("Q12 after elite kill:", JSON.stringify(await qs()));
await walkViaTracker("Q12 turn-in");
await clearCamp(); await talkAtFar(1020, 840, "npc_xichviem_tientri (Q12 turn-in)");
{
  const q = await qs(); const c = await combat();
  await statsLog("after Q12 turn-in");
  assert("(g) Q12 turn-in +850 -> XP 5300", c.xp === 5300, "xp=" + c.xp);
  assert("(g) chain advances to Q13", q.index === 12 && q.quest === "q13_ma_quan_giang_the", JSON.stringify(q));
}
await shot("q12_turnin.png");

// ---------- Q13: Boss 002 — phases, telegraphs, deliberate death --------
await clearCamp(); await talkAtFar(1020, 840, "npc_xichviem_tientri (Q13 accept)");
{
  const q = await qs();
  assert("Q13 accepted (active)", q.index === 12 && q.state === "active", JSON.stringify(q));
  assert("guidance Q13 active resolves to Boss 002",
    (q.activeTarget || "").includes("Ma Quân"), q.activeTarget || "");
  await shot("guidance_q13.png"); // edge arrow toward the boss arena (north)
}
{
  const t0 = Date.now();
  let deaths = 0, wasDead = false;
  let shotP1T = false, shotP2T = false, shotP3T = false, shotP2 = false, shotP3 = false;
  let lastTap = 0, lastFleeKey = "", lastBeat = Date.now();
  let prevBossHp = null, prevBossPhase = null, bossHpAtDeath = null, bossPhaseAtDeath = null;
  let deliberateDone = false, deliberateActive = false, deliberateT0 = 0;
  const phaseSeen = new Set();
  while (Date.now() - t0 < 45 * 60 * 1000) {
    const c = await combat(); const q = await qs();
    if (!c.boss) {
      const sm = (await state()).map;
      log("  boss002 loop: boss not present (map=" + sm + ") — returning to the arena");
      if (sm === "island") await walkIntoPortal(2820, 1572, "xichviem", "re-enter xichviem mid-fight").catch(() => {});
      await sleep(1000);
      continue;
    }
    phaseSeen.add(c.boss.phase);
    if (Date.now() - lastBeat > 30000) {
      lastBeat = Date.now();
      log("  …boss002 fight: phase", c.boss.phase, "bossHp", c.boss.hp, "state", c.boss.state, "playerHp", c.playerHp, "deaths", deaths, "elapsed", Math.round((Date.now() - t0) / 1000) + "s");
    }
    if (c.boss.dead) { log("BOSS 002 DEAD after", Math.round((Date.now() - t0) / 1000), "s, deaths:", deaths); break; }
    if (c.playerDead) {
      if (!wasDead) {
        deaths++; log("  player died in boss002 fight, death #", deaths);
        if (prevBossHp !== null && prevBossHp < c.boss.maxHp) {
          bossHpAtDeath = prevBossHp; bossPhaseAtDeath = prevBossPhase;
          log("  boss002 hp at moment of death:", prevBossHp, "phase", prevBossPhase);
        }
      }
      wasDead = true;
      await sleep(800);
      continue;
    }
    if (wasDead && bossHpAtDeath !== null && c.boss) {
      const sameHp = c.boss.hp === bossHpAtDeath;
      const samePhase = c.boss.phase === bossPhaseAtDeath;
      log("BOSS002 HP PERSISTENCE: hp at death", bossHpAtDeath, "-> after respawn", c.boss.hp,
        "phase", bossPhaseAtDeath, "->", c.boss.phase,
        (sameHp && samePhase) ? "PASS — hp and phase unchanged" : "CHECK — see values");
      if (deliberateActive) {
        assert("(i) BOSS PERSISTENCE: boss HP unchanged across deliberate death in Phase 2", sameHp,
          bossHpAtDeath + " -> " + c.boss.hp);
        assert("(i) BOSS PERSISTENCE: boss phase unchanged across deliberate death in Phase 2", samePhase,
          bossPhaseAtDeath + " -> " + c.boss.phase);
        deliberateActive = false; deliberateDone = true;
        log("DELIBERATE DEATH CHECK (boss002): complete");
      }
      bossHpAtDeath = null; bossPhaseAtDeath = null;
    }
    wasDead = false;
    const b = c.boss;
    prevBossHp = b.hp; prevBossPhase = b.phase;
    const d = dist(c.px, c.py, b.x, b.y);
    // Telegraph photography: capture the warning state the moment it is seen.
    if (b.state === "TELEGRAPH_SWIPE" && b.phase === 1 && !shotP1T) {
      shotP1T = true; log("PHASE1 TELEGRAPH seen (TELEGRAPH_SWIPE, hp", b.hp + ") — photographing");
      await shot("q13_boss_phase1_telegraph.png");
    }
    if (b.state === "TELEGRAPH_ROAR" && b.phase === 2 && !shotP2T) {
      shotP2T = true; log("PHASE2 TELEGRAPH seen (TELEGRAPH_ROAR red circle, hp", b.hp + ") — photographing");
      await shot("q13_boss_phase2_telegraph.png");
    }
    if (b.state === "TELEGRAPH_DASH" && b.phase === 3 && !shotP3T) {
      shotP3T = true; log("PHASE3 TELEGRAPH seen (TELEGRAPH_DASH lane, hp", b.hp + ") — photographing");
      await shot("q13_boss_phase3_telegraph.png");
    }
    if (b.state === "PHASE_TRANSITION" && b.phase === 2 && !shotP2) { shotP2 = true; await shot("q13_boss_phase2.png"); log("phase 2 reached, boss hp", b.hp); }
    if (b.state === "PHASE_TRANSITION" && b.phase === 3 && !shotP3) { shotP3 = true; await shot("q13_boss_phase3.png"); log("phase 3 reached, boss hp", b.hp); }
    if (!b.engaged) {
      if (Date.now() - lastTap > 800) { lastTap = Date.now(); await tapWorld(b.x, b.y - 100); }
      await sleep(150);
      continue;
    }
    // Deliberate-death probe in Phase 2 (mission i): stand in range, no
    // attacks, no fleeing, until one death is recorded.
    if (!deliberateDone && b.phase === 2 && b.hp < b.maxHp) {
      if (!deliberateActive) {
        deliberateActive = true; deliberateT0 = Date.now();
        log("DELIBERATE DEATH CHECK (boss002): phase 2, boss at", b.hp, "hp — standing in range to die once");
      }
      if (Date.now() - deliberateT0 > 300000) {
        log("DELIBERATE DEATH CHECK (boss002): player did not die within 300s — flagging and continuing");
        assert("(i) BOSS PERSISTENCE deliberate death occurred in Phase 2", false, "no death within 300s");
        deliberateActive = false; deliberateDone = true;
      } else {
        if (d > 110) {
          if (Date.now() - lastTap > 700) { lastTap = Date.now(); await tapWorld(b.x, b.y - 100); }
        }
        await sleep(150);
        continue;
      }
    }
    const st = b.state;
    if (st.startsWith("TELEGRAPH")) {
      const ux = (c.px - b.x) / (d || 1), uy = (c.py - b.y) / (d || 1);
      let fx, fy, key;
      if (st === "TELEGRAPH_ROAR") { fx = c.px + ux * 680; fy = c.py + uy * 680; key = "roar"; }
      else if (st === "TELEGRAPH_DASH") {
        const px2 = -uy, py2 = ux;
        fx = c.px + px2 * 270 + ux * 90; fy = c.py + py2 * 270 + uy * 90; key = "dash";
      } else { fx = c.px + ux * 300; fy = c.py + uy * 300; key = "swipe"; }
      const fk = key + "@" + Math.round(b.x / 50) + "," + Math.round(b.y / 50) + "@" + b.hp;
      if (fk !== lastFleeKey) { lastFleeKey = fk; await tapWorld(fx, fy); }
      await sleep(110);
      continue;
    }
    if (st.startsWith("ATTACK")) { await sleep(120); continue; }
    if (st === "PHASE_TRANSITION") { await sleep(200); continue; }
    if (d > 150) {
      if (Date.now() - lastTap > 700) { lastTap = Date.now(); await tapWorld(b.x, b.y - 130); }
    } else {
      await tapEl("#mobileAtkBtn");
    }
    await sleep(120);
  }
  const cEnd = await combat();
  assert("(h) Boss 002 killed in honest play", !!(cEnd.boss && cEnd.boss.dead),
    "boss=" + JSON.stringify(cEnd.boss));
  assert("(h) boss phases 1, 2 and 3 were all entered", phaseSeen.has(1) && phaseSeen.has(2) && phaseSeen.has(3),
    "phases seen: " + [...phaseSeen].join(","));
  log("telegraph shots captured: P1", shotP1T, "P2", shotP2T, "P3", shotP3T);
  if (!(cEnd.boss && cEnd.boss.dead)) throw new Error("BOSS002 WALL: not beaten. boss=" + JSON.stringify(cEnd.boss));
  await shot("q13_boss_death.png");
}
await waitFor(async () => (await qs()).dialogueOpen || null, 8000, "boss002 victory dialogue");
await advanceDialogue();
log("Q13 after boss:", JSON.stringify(await qs()));
await walkViaTracker("Q13 turn-in");
await clearCamp(); await talkAtFar(1020, 840, "npc_xichviem_tientri (Q13 turn-in)");
{
  const q = await qs(); const c = await combat();
  await statsLog("FINAL (after Q13 turn-in)");
  assert("(h) Q13 turn-in +950 -> final XP 6250", c.xp === 6250, "xp=" + c.xp);
  // Levels table semantics (levelRowForXp): highest xpNeed <= xp wins.
  // 6250 >= 5400 (level 12 row) but < 6500 (level 13 row) -> level 12.
  assert("(h) final level for 6250 cumulative XP == 12", c.playerLevel === 12, "level=" + c.playerLevel);
  assert("(h) chain completed (index 13, state completed)", q.index === 13 && q.state === "completed", JSON.stringify(q));
}
await shot("q13_final_turnin.png");
log("ASSERT FAILURES SO FAR:", ASSERT_FAILS);

log("exceptions during run:", exceptions.length);
for (const e of exceptions.slice(0, 10)) log("  ", e);
log("PLAYTEST RESULT: FULL CHAIN Q1->Q13 COMPLETED, assert failures:", ASSERT_FAILS);
flushLog();
try { chrome.kill("SIGKILL"); } catch {}
server.close();
process.exit(0);
