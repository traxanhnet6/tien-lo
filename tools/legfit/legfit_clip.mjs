// MOVE1 before/after movement clip driver.
// Serves MOVE1_ROOT (default: this tree), drives the real game in manual
// step mode at a fixed 50 ms simulation step, and captures one JPEG per
// simulated frame. The same deterministic route is used for both trees:
// idle, eight true-direction walks from one open plaza point, one run leg,
// and one long eastbound walk.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { join, extname } from "node:path";

const TREE = new URL("..", import.meta.url).pathname;
const ROOT = process.env.MOVE1_ROOT || TREE;
const OUT = process.env.MOVE1_OUT || join(TREE, "proof/move1-clips/after.mp4");
const FRAMES = process.env.MOVE1_FRAMES || join(TREE, "proof/move1-clips/.frames-after");
const PORT = Number(process.env.MOVE1_PORT || 8992);
const CDP = Number(process.env.MOVE1_CDP || 9342);
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
mkdirSync(join(OUT, ".."), { recursive: true });

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

const CHROME = process.env.CHROME_BIN || "/home/hatch/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome";
const profile = process.env.MOVE1_PROFILE || join(TREE, "proof/move1-clips/.chrome-profile");
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--no-sandbox", "--disable-dev-shm-usage", `--user-data-dir=${profile}`,
  `--remote-debugging-port=${CDP}`, "--window-size=500,900", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: "PUT" })).json();
    ws = new WebSocket(j.webSocketDebuggerUrl);
    break;
  } catch { await sleep(300); }
}
if (!ws) throw new Error("Chrome CDP did not start");
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let msgId = 0; const pending = new Map();
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
});
const cdp = (method, params = {}) => new Promise(res => {
  const id = ++msgId; pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const ev = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result?.value;
};
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?manual=1` });
for (let i = 0; i < 100; i++) {
  await sleep(300);
  if (await ev("window.TL2 && TL2.ready()")) break;
  if (i === 99) throw new Error("page never ready: " + await ev("window.__err || 'no err'"));
}

let frameNo = 0;
const segments = [];
async function capture() {
  const r = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 84, captureBeyondViewport: false });
  writeFileSync(join(FRAMES, `f${String(frameNo++).padStart(4, "0")}.jpg`), Buffer.from(r.data, "base64"));
}
async function place(x, y, face) {
  await ev("TL2.setManualInput(null)");
  await ev(`TL2.setPlayerPx(${x}, ${y})`);
  await ev("TL2.setZoom(2)");
  // NOTE: TL2.setCam switches follow OFF, so setCam must come first.
  await ev(`TL2.setCam(${x}, ${y + 40})`);
  await ev("TL2.setFollow(true)");
  if (face) await ev(`TL2.setFacing('${face}')`);
  await ev("TL2.step(16)");
}
async function segment(name, setup, steps, drive) {
  const start = frameNo;
  await setup();
  for (let i = 0; i < steps; i++) {
    if (drive) await ev(`TL2.setManualInput(${drive[0]}, ${drive[1]}, ${drive[2]})`);
    await ev("TL2.step(50)");
    await capture();
  }
  await ev("TL2.setManualInput(null)");
  const state = await ev("TL2.state()");
  segments.push({ name, startFrame: start, endFrame: frameNo - 1, frames: frameNo - start, endState: state });
  console.log(name, frameNo - start, "frames", state);
}

const CENTER = [2706, 2013];
async function seg2(name, setup, steps, drive) {
  await setup();
  const s0 = await ev("TL2.state()");
  await segment(name, async () => {}, steps, drive);
  const s1 = segments[segments.length - 1].endState;
  const dt = steps * 0.05;
  const dx = s1.x - s0.x, dy = s1.y - s0.y;
  const sp = Math.hypot(dx, dy) / dt;
  segments[segments.length - 1].displacement = { dx: +dx.toFixed(1), dy: +dy.toFixed(1), simSeconds: dt, speedPxS: +sp.toFixed(1) };
  console.log("SPEED", name, "dx", dx.toFixed(1), "dy", dy.toFixed(1), "->", sp.toFixed(1), "px/s");
}
await seg2("idle_e", () => place(...CENTER, "east"), 10, null);
await seg2("walk_e", () => place(...CENTER, "east"), 24, [1, 0, 90]);
await seg2("walk_w", () => place(...CENTER, "west"), 24, [-1, 0, 90]);
await seg2("run_e", () => place(...CENTER, "east"), 30, [1, 0, 218]);
await seg2("run_w", () => place(...CENTER, "west"), 30, [-1, 0, 218]);

writeFileSync(join(OUT, "..", `${OUT.split("/").pop().replace(/\.mp4$/, "")}-segments.json`),
              JSON.stringify({ root: ROOT, fps: 20, segments }, null, 2));
execFileSync("ffmpeg", ["-y", "-framerate", "20", "-i", join(FRAMES, "f%04d.jpg"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", OUT], { stdio: "pipe" });
console.log("clip written", OUT, "frames", frameNo);
chrome.kill();
server.close();
process.exit(0);
