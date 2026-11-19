// GD3 evidence shot: two online clients in ONE wide desktop frame —
// both player figures flanking the same monster, taken from client A
// after A lands a server-validated SK2 (monster HP bar already down).
// Run after tools/gd3-online-harness.mjs passes; this script only
// produces the parent-facing picture, the harness carries the proof.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, openSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/hatch/workspace/game-tien-lo-gd3/";
const OUT = join(ROOT, "proof/gd3-verify");
mkdirSync(OUT, { recursive: true });
const VW = 1180, VH = 760;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Start the GD3 server
const sportTry = 19700 + (process.pid % 150);
const srvOut = openSync(join(OUT, "gd3-evidence-server.log"), "w");
const server = spawn(process.execPath, ["server/server.mjs"], {
  cwd: ROOT, env: { ...process.env, TL_PORT: String(sportTry) }, stdio: ["ignore", srvOut, srvOut], detached: true,
});
let SPORT = null;
for (let i = 0; i < 40 && !SPORT; i++) {
  try { const r = await fetch(`http://127.0.0.1:${sportTry}/index.html`); if (r.ok) SPORT = sportTry; } catch {}
  if (!SPORT) await sleep(250);
}
if (!SPORT) throw new Error("GD3 server did not come up");
console.log("server on", SPORT);

const chromes = [];
process.on("exit", () => { try { server.kill("SIGKILL"); } catch {} for (const c of chromes) { try { process.kill(-c.pid, "SIGKILL"); } catch {} } });
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
function spawnChrome(cdpPort, tag) {
  const profile = `/home/hatch/workspace/.gd3shot-profile-${tag}-` + process.pid;
  rmSync(profile, { recursive: true, force: true });
  const errFd = openSync(join(OUT, `gd3-shot-chrome-${tag}.log`), "w");
  const c = spawn(chromeBin(), ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    "--in-process-gpu", "--disable-gpu-sandbox", "--js-flags=--max-old-space-size=3072",
    "--renderer-process-limit=1",
    `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`,
    `--window-size=${VW},${VH}`, "about:blank"], { stdio: ["ignore", errFd, errFd], detached: true });
  chromes.push(c);
}
const CDP_A = 20250 + (process.pid % 90), CDP_B = 20350 + (process.pid % 90);
spawnChrome(CDP_A, "a"); spawnChrome(CDP_B, "b");

async function makePage(label, cdpPort) {
  let ws = null;
  for (let i = 0; i < 50 && !ws; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: "PUT" })).json();
      const cand = new WSShim(j.webSocketDebuggerUrl);
      await cand.ready; ws = cand;
    } catch { await sleep(300); }
  }
  if (!ws) throw new Error("CDP connect failed " + label);
  let msgId = 0; const pending = new Map();
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
  });
  const cdp = (method, params = {}, timeoutMs = 30000) => new Promise((res, rej) => {
    const id = ++msgId;
    const to = setTimeout(() => { pending.delete(id); rej(new Error("CDP timeout " + method)); }, timeoutMs);
    pending.set(id, v => { clearTimeout(to); res(v); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await cdp("Page.enable"); await cdp("Runtime.enable");
  const ev = async expr => {
    const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval failed " + label);
    return r.result?.value;
  };
  const until = async (expr, timeoutMs = 15000) => {
    const t0 = Date.now();
    for (;;) { const v = await ev(expr).catch(() => undefined); if (v) return v; if (Date.now() - t0 > timeoutMs) return undefined; await sleep(250); }
  };
  const tapEl = async sel => {
    const c = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    if (!c) return false;
    try { await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: Math.round(c.x), y: Math.round(c.y), button: "left", clickCount: 1 }, 9000); } catch {}
    await sleep(50);
    try { await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: Math.round(c.x), y: Math.round(c.y), button: "left", clickCount: 1 }, 9000); } catch {}
    return true;
  };
  return { label, cdp, ev, until, tapEl };
}
const A = await makePage("A", CDP_A);
const B = await makePage("B", CDP_B);
await A.cdp("Page.navigate", { url: `http://127.0.0.1:${SPORT}/?online&pname=An` });
await B.cdp("Page.navigate", { url: `http://127.0.0.1:${SPORT}/?online&pname=Binh` });
await A.until("window.Gameplay && Gameplay.isReady() && window.TLNET && TLNET.connected()", 45000);
await B.until("window.Gameplay && Gameplay.isReady() && window.TLNET && TLNET.connected()", 45000);
// Open ground south of the monster anchor (520,1560): A west, B east.
await A.ev("Gameplay.teleportTo(430, 1620)");
await B.ev("Gameplay.teleportTo(610, 1620)");
await A.until(`(() => { const r = Gameplay.inspectCombat().remotePlayers.find(r => r.name === "Binh"); return r && Math.abs(r.x - 610) <= 45 ? true : null; })()`, 12000);
await sleep(600);
// A lands a server-validated SK2 so the shared monster's HP bar is down.
await A.tapEl("#btnSkill2");
for (let i = 0; i < 24; i++) {
  await sleep(250);
  const m = await A.ev(`(() => { const m = Gameplay.inspectCombat().monsters.find(m => m.id === "mon_trucyeu_1"); return m ? m.hp : null; })()`).catch(() => null);
  if (m !== null && m < 85) break;
}
await sleep(400);
const shotRes = await A.cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 90000);
writeFileSync(join(OUT, "gd3_two_clients_wide.png"), Buffer.from(shotRes.data, "base64"));
console.log("shot: gd3_two_clients_wide.png");
try { server.kill("SIGKILL"); } catch {}
for (const c of chromes) { try { process.kill(-c.pid, "SIGKILL"); } catch {} }
process.exit(0);
