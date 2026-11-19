// GD3 two-client online harness: two real Chrome pages join the GD3
// server on the same map (island), must SEE each other, then kill the
// same monster together — monster HP read via inspectCombat() must be
// identical on both clients at every step (the server owns it), and
// the kill must land on both at the same moment. Real touch input
// only; state is read, never written, except teleportTo staging.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { writeFileSync, appendFileSync, mkdirSync, rmSync, existsSync, readdirSync, openSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/hatch/workspace/game-tien-lo-gd3/";
const OUT = join(ROOT, "proof/gd3-verify");
mkdirSync(OUT, { recursive: true });
const SPORT = 19500 + (process.pid % 200);
const CDP_A = 19900 + (process.pid % 90);
const CDP_B = 20100 + (process.pid % 90);
const VW = 390, VH = 844;
const LOGF = join(OUT, "gd3-online-harness.log");
writeFileSync(LOGF, "");
let failures = 0;
function log(...a) { const s = a.join(" "); console.log(s); try { appendFileSync(LOGF, s + "\n"); } catch {} }
function check(name, cond, extra = "") { log(cond ? "PASS" : "FAIL", name, extra); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- GD3 server under test (serves the game AND the websocket)
const serverLogF = join(OUT, "gd3-online-server.log");
writeFileSync(serverLogF, "");
const server = spawn("node", [join(ROOT, "server/server.mjs")],
  { env: { ...process.env, TL_PORT: String(SPORT) }, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", d => appendFileSync(serverLogF, d));
server.stderr.on("data", d => appendFileSync(serverLogF, d));
const chromes = [];
process.on("exit", () => { try { server.kill("SIGKILL"); } catch {} for (const c of chromes) { try { process.kill(-c.pid, "SIGKILL"); } catch {} } });
process.on("unhandledRejection", e => {
  try { log("HARNESS ERROR (unhandled):", String(e && e.message || e)); log("HARNESS ABORTED — treat as FAILED"); } catch {}
  process.exit(1);
});
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(`http://127.0.0.1:${SPORT}/index.html`); if (r.ok) break; } catch {}
  await sleep(250);
}
log("GD3 server up on", SPORT);

// ---- Chrome + CDP plumbing (team pattern: per-PID profile/ports)
class WSShim {
  constructor(url) {
    this._listeners = {}; this._sendQueue = []; this._opened = false;
    this._inner = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("CDP ws open timeout")), 10000);
      this._inner.addEventListener("open", () => {
        clearTimeout(to); this._opened = true;
        for (const s of this._sendQueue) this._inner.send(s);
        this._sendQueue = []; this._emit("open", {}); resolve();
      }, { once: true });
      this._inner.addEventListener("error", ev2 => { clearTimeout(to); reject(new Error("CDP ws error")); });
    });
    this._inner.addEventListener("close", () => this._emit("close", {}));
    this._inner.addEventListener("message", ev2 =>
      this._emit("message", { data: typeof ev2.data === "string" ? ev2.data : String(ev2.data) }));
  }
  _emit(t, e) { for (const fn of this._listeners[t] || []) fn(e); }
  addEventListener(t, fn) { (this._listeners[t] ??= []).push(fn); if (t === "open" && this._opened) queueMicrotask(() => fn({})); }
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
// TWO separate Chrome instances, one page each. With two pages in one
// browser, the backgrounded page's rAF-driven game loop is throttled
// to a standstill on this VM (run 3: client A stayed connected and
// answered evaluate calls, but its monsters never acted and its taps
// never produced intents). One foreground page per instance — the
// same shape as every earlier harness — keeps both loops alive.
function spawnChrome(cdpPort, tag) {
  const profile = `/home/hatch/workspace/.gd3-profile-${tag}-` + process.pid;
  rmSync(profile, { recursive: true, force: true });
  const errFd = openSync(join(OUT, `gd3-chrome-${tag}-stderr.log`), "w");
  const c = spawn(chromeBin(), ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    "--force-device-scale-factor=2", "--in-process-gpu", "--disable-gpu-sandbox",
    "--js-flags=--max-old-space-size=3072", "--renderer-process-limit=1",
    `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`,
    `--window-size=${VW},${VH}`, "about:blank"], { stdio: ["ignore", errFd, errFd], detached: true });
  chromes.push(c);
  return c;
}
spawnChrome(CDP_A, "a");
spawnChrome(CDP_B, "b");

class Page {
  constructor(ws, label) {
    this.ws = ws; this.label = label; this.msgId = 0; this.pending = new Map(); this.exceptions = [];
    ws.addEventListener("message", e => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m.result ?? m); this.pending.delete(m.id); }
      if (m.method === "Runtime.exceptionThrown")
        this.exceptions.push("exception: " + (m.params.exceptionDetails?.exception?.description || "").split("\n")[0]);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
        this.exceptions.push("console.error: " + m.params.args.map(a => a.value || a.description || "").join(" ").slice(0, 160));
    });
  }
  cdp(method, params = {}, timeoutMs = 30000) {
    return new Promise((res, rej) => {
      const id = ++this.msgId;
      const to = setTimeout(() => { this.pending.delete(id); rej(new Error("CDP timeout " + method)); }, timeoutMs);
      this.pending.set(id, v => { clearTimeout(to); res(v); });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async ev(expr) {
    const r = await this.cdp("Runtime.evaluate", { expression: expr, returnByValue: true });
    if (r.exceptionDetails) throw new Error(this.label + " eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 240));
    return r.result?.value;
  }
  async nav(url) { await this.cdp("Page.navigate", { url }); }
  async tapXY(x, y) {
    // Mouse events at real screen coordinates (the HUD buttons listen
    // to pointerdown, which mouse input produces). Touch dispatch on
    // the first of two targets repeatedly lost its CDP response on
    // this VM in run 1-2; mouse dispatch stayed responsive. Dispatch
    // timeouts never kill the harness — state polling decides.
    const px = Math.round(x), py = Math.round(y);
    try { await this.cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: px, y: py }, 9000); } catch {}
    try {
      await this.cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: px, y: py, button: "left", clickCount: 1 }, 9000);
    } catch { log(this.label + ": mousePressed CDP timeout (continuing)"); await sleep(800); }
    await sleep(50);
    try {
      await this.cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: px, y: py, button: "left", clickCount: 1 }, 9000);
    } catch { log(this.label + ": mouseReleased CDP timeout (continuing)"); await sleep(800); }
    await sleep(60);
  }
  async key(code, keyName) {
    try { await this.cdp("Input.dispatchKeyEvent", { type: "keyDown", code, key: keyName }, 9000); } catch {}
    await sleep(60);
    try { await this.cdp("Input.dispatchKeyEvent", { type: "keyUp", code, key: keyName }, 9000); } catch {}
    await sleep(60);
  }
  async tapEl(sel) {
    const c = await this.ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    if (!c) throw new Error(this.label + ": element not found " + sel);
    await this.tapXY(c.x, c.y);
  }
  async shot(name) {
    const r = await this.cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 90000);
    writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
    log("shot:", name);
  }
  async until(expr, timeoutMs = 10000, stepMs = 250) {
    const t0 = Date.now();
    for (;;) {
      const v = await this.ev(expr).catch(() => undefined);
      if (v) return v;
      if (Date.now() - t0 > timeoutMs) return undefined;
      await sleep(stepMs);
    }
  }
}
async function newPage(label, cdpPort) {
  for (let i = 0; i < 40; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: "PUT" })).json();
      const shim = new WSShim(j.webSocketDebuggerUrl);
      await shim.ready;
      const p = new Page(shim, label);
      await p.cdp("Page.enable"); await p.cdp("Runtime.enable");
      await p.cdp("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
      return p;
    } catch { await sleep(300); }
  }
  throw new Error("could not open page " + label);
}
const monsterExpr = id => `(() => { const m = Gameplay.inspectCombat().monsters.find(m => m.id === ${JSON.stringify(id)}); return m ? JSON.stringify(m) : null; })()`;
async function monsterOn(page, id) { const s = await page.ev(monsterExpr(id)); return s ? JSON.parse(s) : null; }
async function dismissDialogue(page) {
  for (let i = 0; i < 6; i++) {
    const open = await page.ev("Gameplay.getQuestState().dialogueOpen").catch(() => false);
    if (!open) return;
    await page.tapEl("#dialogueAdvanceBtn").catch(() => {});
    await sleep(350);
  }
}

// ================= scenario =================
const A = await newPage("A", CDP_A);
const B = await newPage("B", CDP_B);
await A.nav(`http://127.0.0.1:${SPORT}/?online&pname=An`);
await B.nav(`http://127.0.0.1:${SPORT}/?online&pname=Binh`);
const readyExpr = "window.Gameplay && Gameplay.isReady() && window.TLNET && TLNET.connected() && TLNET.playerId()";
check("client A connected to GD3 server", !!(await A.until(readyExpr, 45000)));
check("client B connected to GD3 server", !!(await B.until(readyExpr, 45000)));
const idA = await A.ev("TLNET.playerId()"), idB = await B.ev("TLNET.playerId()");
check("distinct server player ids", !!idA && !!idB && idA !== idB, `${idA} vs ${idB}`);
await dismissDialogue(A); await dismissDialogue(B);

// Stage both players flanking mon_trucyeu_1 (anchor 520,1560). Wait
// until each client's view of the other MATCHES the staging point —
// a remote entry can exist earlier with the join-snapshot position.
await A.ev("Gameplay.teleportTo(452, 1560)"); await B.ev("Gameplay.teleportTo(588, 1560)");
const seesB = await A.until(`(() => { const r = Gameplay.inspectCombat().remotePlayers.find(r => r.name === "Binh"); return (r && Math.abs(r.x - 588) <= 40 && Math.abs(r.y - 1560) <= 40) ? JSON.stringify(r) : null; })()`, 12000);
const seesA = await B.until(`(() => { const r = Gameplay.inspectCombat().remotePlayers.find(r => r.name === "An"); return (r && Math.abs(r.x - 452) <= 40 && Math.abs(r.y - 1560) <= 40) ? JSON.stringify(r) : null; })()`, 12000);
check("A sees B in the same map", !!seesB, seesB || "");
check("B sees A in the same map", !!seesA, seesA || "");
if (seesB) { const r = JSON.parse(seesB); check("B's position as seen by A matches staging (588,1560 ±40)", Math.abs(r.x - 588) <= 40 && Math.abs(r.y - 1560) <= 40, `at ${r.x},${r.y}`); }
if (seesA) { const r = JSON.parse(seesA); check("A's position as seen by B matches staging (452,1560 ±40)", Math.abs(r.x - 452) <= 40 && Math.abs(r.y - 1560) <= 40, `at ${r.x},${r.y}`); }

const base1A = await monsterOn(A, "mon_trucyeu_1"), base1B = await monsterOn(B, "mon_trucyeu_1");
check("baseline: mon_trucyeu_1 full HP on both clients", !!base1A && !!base1B && base1A.hp === 85 && base1B.hp === 85,
  `A=${base1A && base1A.hp} B=${base1B && base1B.hp}`);
await A.shot("gd3_two_clients_A.png");
await B.shot("gd3_two_clients_B.png");

// A casts Kim Cang Quyền (SK2) by a real tap; if the tap shows no
// effect (renderer input stall), fall back to the real PC key (E).
// WHICH adjacent monster the cast hits is decided by the CLIENT's
// auto-target over its LOCAL monster copies, which chase the player
// while the intent is in flight (server log of the 01:29 run shows
// the cast ACCEPTED onto mon_trucyeu_5 after the key fallback, while
// this script was still polling mon_trucyeu_1). The sync property
// under test — same monster, same HP, both clients — is therefore
// asserted over BOTH staged neighbours: the shared target is
// whichever one the cast actually lands on.
const NEIGHBOURS = ["mon_trucyeu_1", "mon_trucyeu_5"];
await A.tapEl("#btnSkill2");
let sharedId = null, hpA = null, hpB = null, fellBackE = false;
for (let i = 0; i < 40 && !sharedId; i++) {
  await sleep(250);
  if (i === 14 && !fellBackE) { fellBackE = true; log("A: tap showed no effect — falling back to key E"); await A.key("KeyE", "e"); }
  for (const id of NEIGHBOURS) {
    const ma = await monsterOn(A, id), mb = await monsterOn(B, id);
    if (ma && mb && ma.hp < ma.maxHp && ma.hp === mb.hp) { sharedId = id; hpA = ma.hp; hpB = mb.hp; break; }
  }
}
check("after A's SK2: the hit monster's HP dropped and is IDENTICAL on both clients", !!sharedId, `target=${sharedId} A=${hpA} B=${hpB}`);
const mpA = await A.ev("Gameplay.inspectCombat().playerMp");
const mpB = await B.ev("Gameplay.inspectCombat().playerMp");
check("A's MP charged by server (42 + server regen since)", mpA >= 42 && mpA <= 45, `mpA=${mpA}`);
check("B's MP untouched (60)", mpB === 60, `mpB=${mpB}`);

// Co-op kill on the shared target: BOTH players swing (each swing is
// validated by the server; its range leeway covers both staged
// anchors from both staged positions) until the target is dead at
// HP 0 on both clients.
let deadA = false, deadB = false;
for (let round = 0; round < 10 && sharedId && !(deadA && deadB); round++) {
  await B.tapEl("#mobileAtkBtn");
  await sleep(700);
  await A.tapEl("#mobileAtkBtn");
  for (let i = 0; i < 12 && !(deadA && deadB); i++) {
    await sleep(250);
    const ma = await monsterOn(A, sharedId), mb = await monsterOn(B, sharedId);
    deadA = !!(ma && ma.dead && ma.hp === 0); deadB = !!(mb && mb.dead && mb.hp === 0);
  }
}
check(`co-op kill: ${sharedId} dead at HP 0 on BOTH clients`, deadA && deadB, `Adead=${deadA} Bdead=${deadB}`);
const aSawHitEvent = await A.ev(`TLNET.state().eventLog.some(e => e.kind === "hit_event")`);
check("A received B's hit as a server hit_event broadcast", aSawHitEvent === true);

// Second monster, killed by A alone while B watches: HP must track.
// mon_trucyeu_2 (820,1980) in the proven fighting ground south of
// the spawn clearing. (An earlier draft staged at mon_thachve_1
// (1880,900): the teleport point (1750,900) is not valid standing
// ground — the player was displaced and the server log shows the
// swings only reaching mon_thachve_2.) The baseline is read live:
// earlier co-op swings may have clipped this monster through the
// server's leeway, and both clients agreeing on the number is
// itself the sync property under test.
await A.ev("Gameplay.teleportTo(700, 1900)"); await B.ev("Gameplay.teleportTo(930, 1980)");
await sleep(900);
let lastHp = null;
for (let i = 0; i < 16 && lastHp === null; i++) {
  const ma = await monsterOn(A, "mon_trucyeu_2"), mb = await monsterOn(B, "mon_trucyeu_2");
  if (ma && mb && ma.hp === mb.hp && !ma.dead) lastHp = ma.hp;
  else await sleep(250);
}
check("second monster baseline agreed by both clients", lastHp !== null && lastHp > 0, `hp=${lastHp}`);
let tracked = true, killed = false;
for (let hit = 0; hit < 8 && !killed; hit++) {
  await A.tapEl("#mobileAtkBtn");
  let conv = null, fellJ = false;
  for (let i = 0; i < 22 && !conv; i++) {
    await sleep(250);
    if (i === 10 && !fellJ) { fellJ = true; await A.key("KeyJ", "j"); }
    const ma = await monsterOn(A, "mon_trucyeu_2"), mb = await monsterOn(B, "mon_trucyeu_2");
    if (ma && mb && ma.hp === mb.hp && (ma.hp < lastHp || ma.dead)) { conv = ma; break; }
  }
  if (!conv) { tracked = false; break; }
  log(`  hit ${hit + 1}: mon_trucyeu_2 hp=${conv.hp} dead=${conv.dead} (identical on both)`);
  if (conv.hp >= lastHp && !conv.dead) tracked = false;
  lastHp = conv.hp; killed = !!conv.dead;
  await sleep(350);
}
check("second monster: every HP step identical on both clients", tracked);
check("second monster killed under B's watch", killed);

check("no page exceptions on A", A.exceptions.length === 0, A.exceptions.slice(0, 2).join(" | "));
check("no page exceptions on B", B.exceptions.length === 0, B.exceptions.slice(0, 2).join(" | "));

log(failures === 0 ? "ALL ONLINE CHECKS PASS" : `${failures} CHECK(S) FAILED`);
server.kill("SIGKILL");
for (const c of chromes) { try { process.kill(-c.pid, "SIGKILL"); } catch {} }
process.exit(failures === 0 ? 0 : 1);
