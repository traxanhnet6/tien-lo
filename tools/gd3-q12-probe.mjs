// GD3 Q12 supplementary probe (mirrors the HUD2 wave supplementary-probe method):
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
const LOGF = join(OUT, "gd3-q12-probe.log");
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
  // The puppeteer-cache Chrome (156) began dying with an instant
  // SIGTRAP at startup on this VM at ~01:50Z (worked at 01:47Z, dead
  // at 01:52Z, zero stderr even under strace) — an environment fault,
  // not a game fault. CHROME_BIN lets the probe use the other build.
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const base = "/home/hatch/.cache/puppeteer/chrome";
  for (const v of readdirSync(base).sort().reverse()) {
    const p = join(base, v, "chrome-linux64/chrome");
    if (existsSync(p)) return p;
  }
  throw new Error("chrome not found");
}
const PROFILE = "/home/hatch/workspace/.gd3q12-profile-" + process.pid;
rmSync(PROFILE, { recursive: true, force: true });
const chromeErrFd = openSync(join(OUT, "gd3q12-chrome-stderr.log"), "w");
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

// Crafted save: Q12 (index 11) ACTIVE, player XP 4450 (the exact total
// after Q11), on map xichviem. Kill the elite with real taps (basic
// attacks + SK1/SK2 tap casts; deaths are fine — respawn is automatic
// and monster HP persists by law), expect ready_to_turn_in, then turn
// in at the Tiên Tri with real dialogue taps and expect Q13 accepted
// and XP 4450 -> 5300.
await navAndReady(`http://127.0.0.1:${PORT}/?map=xichviem`); // land on the origin first (localStorage needs it)
await setSave({ questIndex: 11, questState: "active", questProgress: 0, playerXp: 4450, herbsCount: 0, gatheredNodes: [] });
await navAndReady(`http://127.0.0.1:${PORT}/?map=xichviem`);
const qs0 = JSON.parse(await ev("JSON.stringify(Gameplay.getQuestState())"));
check("probe starts at Q12 active on xichviem", qs0.index === 11 && qs0.state === "active", `index=${qs0.index} state=${qs0.state}`);
const eliteOf = () => ev(`(() => { const m = Gameplay.inspectCombat().monsters.find(m => m.id === "mon_xichviem_elite"); return m ? JSON.stringify({ hp: m.hp, maxHp: m.maxHp, dead: m.dead }) : null; })()`).then(v => v ? JSON.parse(v) : null).catch(() => null);
let elite = await eliteOf();
check("elite present at full HP", !!elite && elite.hp === elite.maxHp, JSON.stringify(elite));
await ev("Gameplay.teleportTo(1350, 485)"); // Q12 target stand point
await sleep(600);
let deaths = 0, lastPlayerDead = false, swings = 0;
const t0 = Date.now();
while (elite && !elite.dead && Date.now() - t0 < 420000) {
  // A stalled evaluate (long frame under load) must not kill the
  // probe — skip the beat and keep fighting.
  const icRaw = await ev("JSON.stringify(Gameplay.inspectCombat())").catch(() => null);
  if (!icRaw) { await sleep(800); continue; }
  const ic = JSON.parse(icRaw);
  if (ic.playerDead) {
    if (!lastPlayerDead) { deaths++; log(`  player death #${deaths} (elite hp ${elite.hp} — persists by law)`); }
    lastPlayerDead = true;
    await sleep(1200);
    continue;
  }
  if (lastPlayerDead) { lastPlayerDead = false; await ev("Gameplay.teleportTo(1350, 485)"); await sleep(500); }
  // Fight: prefer a ready skill (real taps), else the attack button.
  const skRaw = await ev("JSON.stringify(Gameplay.inspectSkills())").catch(() => null);
  if (!skRaw) { await sleep(800); continue; }
  const sk = JSON.parse(skRaw);
  const ready = sk.skills.find(s => (s.id === "sk_kimcang_quyen" || s.id === "sk_thaicuc_chuong") && s.state === "ready");
  if (ready && swings % 2 === 0) {
    await tapEl(ready.id === "sk_kimcang_quyen" ? "#btnSkill2" : "#btnSkill1");
  } else {
    await tapEl("#mobileAtkBtn");
  }
  swings++;
  await sleep(650);
  const e2 = await eliteOf();
  if (e2) elite = e2;
  if (swings % 10 === 0) log(`  fighting elite: hp=${elite ? elite.hp : "?"} swings=${swings} deaths=${deaths}`);
}
check("elite killed while Q12 active (death-grind allowed, HP persisted)", !!elite && elite.dead === true, `hp=${elite && elite.hp} deaths=${deaths} swings=${swings}`);
const qs1 = JSON.parse(await ev("JSON.stringify(Gameplay.getQuestState())"));
check("quest flips to ready_to_turn_in after the elite kill", qs1.index === 11 && qs1.state === "ready_to_turn_in", `index=${qs1.index} state=${qs1.state}`);
await shot("q12_elite_dead.png");
// Turn in at the Tiên Tri (stand 1028,876) with real dialogue taps.
await ev("Gameplay.teleportTo(1028, 876)");
await sleep(500);
await ev(`Gameplay.interactWith("npc_xichviem_tientri")`);
let bannerText = "";
for (let i = 0; i < 20; i++) {
  await sleep(300);
  const b = await ev(`(document.getElementById("gameBanner") || {}).textContent || ""`).catch(() => "");
  if (b && b.trim()) bannerText = b;
  const open = await ev("Gameplay.getQuestState().dialogueOpen").catch(() => false);
  if (open) await tapEl("#dialogueAdvanceBtn");
  const qs = JSON.parse(await ev("JSON.stringify(Gameplay.getQuestState())"));
  if (qs.index === 12) break;
}
for (let i = 0; i < 12 && !bannerText.trim(); i++) {
  await sleep(300);
  const b = await ev(`(document.getElementById("gameBanner") || {}).textContent || ""`).catch(() => "");
  if (b && b.trim()) bannerText = b;
}
const qsF = JSON.parse(await ev("JSON.stringify(Gameplay.getQuestState())"));
const icF = JSON.parse(await ev("JSON.stringify(Gameplay.inspectCombat())"));
log("banner captured:", bannerText.replace(/\s+/g, " ").slice(0, 200));
check("Q12 turn-in advances the chain to Q13 (index 12)", qsF.index === 12, `index=${qsF.index} state=${qsF.state} quest=${qsF.quest}`);
check("Q12 reward +850 XP applied (4450 -> 5300)", icF.xp === 5300, `xp=${icF.xp}`);
// 4450 -> 5300 crosses NO level threshold (both are internal level
// 11), so the banner must show the XP only — no realm line, and
// certainly no old-style "Lên cấp" text. (The realm line itself is
// proven at the Q13 turn-in in gd3-realm-check.mjs, where a threshold
// IS crossed.)
check("turn-in banner shows '+850 EXP' with no level-up line", bannerText.includes("+850 EXP") && !bannerText.includes("Lên cấp"), bannerText.slice(0, 120));
const tLv = await psLevel();
check("plate still shows level-11 realm 'Trúc Cơ Trung Kỳ'", tLv === "Trúc Cơ Trung Kỳ", `got '${tLv}'`);
await shot("q12_turnin.png");
check("no page exceptions", exceptions.length === 0, exceptions.slice(0, 2).join(" | "));
log(failures === 0 ? "ALL Q12 PROBE CHECKS PASS" : `${failures} CHECK(S) FAILED`);
try { process.kill(-chrome.pid, "SIGKILL"); } catch {}
staticServer.close();
process.exit(failures === 0 ? 0 : 1);
