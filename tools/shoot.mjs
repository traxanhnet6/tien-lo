// Screenshot + clip driver for iso3 (TWO maps: island + hauson).
// Serves the tree on :8983, drives headless Chrome via CDP on :9336.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PROOF = join(ROOT, "proof");
const FRAMES = join(PROOF, "clip_frames");
const FRAMES_HS = join(PROOF, "clip_frames_hs");
const BASE = join(PROOF, "base_raw");
mkdirSync(FRAMES, { recursive: true });
mkdirSync(FRAMES_HS, { recursive: true });
mkdirSync(BASE, { recursive: true });
const PORT = 8983, CDP = 9336;
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
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--no-sandbox", "--disable-dev-shm-usage",
  `--user-data-dir=${join(ROOT, "proof/tmp/chrome-profile")}`,
  `--remote-debugging-port=${CDP}`, "--window-size=500,900", "about:blank"],
  { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: "PUT" })).json();
    ws = new WebSocket(j.webSocketDebuggerUrl);
    break;
  } catch { await sleep(300); }
}
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
const ev = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result?.value;
};
async function shot(path, format = "png") {
  const r = await cdp("Page.captureScreenshot", { format, captureBeyondViewport: false });
  writeFileSync(path, Buffer.from(r.data, "base64"));
  console.log("shot", path.split("/").pop());
}
async function viewport(w, h, dsf, mobile) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dsf, mobile: !!mobile });
}
async function gotoPage(map) {
  const q = map ? `?manual=1&map=${map}` : "?manual=1";
  await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html${q}` });
  for (let i = 0; i < 80; i++) {
    await sleep(300);
    if (await ev("window.TL2 && TL2.ready()")) return;
  }
  throw new Error("page never ready: " + await ev("window.__err || 'no err'"));
}
const stepN = async (n, ms = 100) => { for (let i = 0; i < n; i++) await ev(`TL2.step(${ms})`); };
async function scene(px, py, cx, cy, z) {
  await ev(`TL2.setPlayerPx(${px}, ${py})`);
  await ev(`TL2.setCam(${cx}, ${cy})`);
  await ev(`TL2.setZoom(${z})`);
  await stepN(2, 16);
}
async function baseChecks(mapDir, listFile) {
  const objs = JSON.parse(readFileSync(join(ROOT, `data/${mapDir}/Map_Objects.json`), "utf8")).objects;
  const ids = JSON.parse(readFileSync(join(ROOT, listFile), "utf8"));
  for (const id of ids) {
    const o = objs.find(x => x.id === id);
    if (!o) { console.log("base MISSING", mapDir, id); continue; }
    const [ax, ay] = o.anchor;
    await ev(`TL2.setPlayerPx(${ax + 130}, ${ay + 96})`);
    await ev(`TL2.setCam(${ax}, ${ay - 60})`);
    await ev("TL2.setZoom(5)");
    await stepN(2, 16);
    await shot(join(BASE, `base_${id}.png`));
  }
}
async function walkClip(framesDir, route, outMp4) {
  let frameNo = 0;
  async function captureFrame() {
    const r = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 82, captureBeyondViewport: false });
    writeFileSync(join(framesDir, `f${String(frameNo++).padStart(4, "0")}.jpg`), Buffer.from(r.data, "base64"));
  }
  for (const [x, y] of route) {
    const ok = await ev(`TL2.walkToPx(${x}, ${y})`);
    console.log("leg ->", x, y, "started:", ok);
    let guard = 0;
    while (guard++ < 500) {
      await ev("TL2.step(100)");
      if (guard % 2 === 0) await captureFrame();
      const st = await ev("TL2.state()");
      if (!st.moving && st.path === 0) break;
    }
  }
  console.log("clip frames:", frameNo, "->", outMp4);
  try {
    execFileSync("ffmpeg", ["-y", "-framerate", "10", "-i", join(framesDir, "f%04d.jpg"),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", join(PROOF, outMp4)],
      { stdio: "pipe" });
    console.log("clip mp4 written:", outMp4);
  } catch (e) { console.log("ffmpeg failed:", String(e).slice(0, 160)); }
}

// ================================================================ ISLAND
await viewport(390, 844, 2, true);
await gotoPage();
await scene(2200, 2430, 2200, 2330, 2); await shot(join(PROOF, "shot_phone_son_mon.png"));
await scene(2665, 1680, 2700, 1760, 1); await shot(join(PROOF, "shot_phone_quang_truong.png"));
await scene(2175, 1340, 2175, 1170, 2); await shot(join(PROOF, "shot_phone_dai_dien.png"));
await scene(3700, 1200, 3700, 1120, 2); await shot(join(PROOF, "shot_phone_luyen_vo.png"));
await scene(720, 1900, 720, 1840, 2); await shot(join(PROOF, "shot_phone_truc_lam.png"));
await scene(3620, 460, 3620, 430, 2); await shot(join(PROOF, "shot_phone_linh_tuyen.png"));
await scene(660, 640, 640, 580, 2); await shot(join(PROOF, "shot_phone_van_an.png"));
await scene(1560, 890, 1560, 800, 2); await shot(join(PROOF, "shot_phone_portal.png"));

await viewport(2200, 1320, 1, false);
await gotoPage();
await scene(2200, 2430, 2200, 1320, 0);
await shot(join(PROOF, "shot_desktop_full.png"));

await viewport(780, 760, 1, false);
await gotoPage();
await baseChecks("island", "tools/base_list.json");

await viewport(390, 844, 2, true);
await gotoPage();
await ev("TL2.setPlayerPx(2200, 2400)");
await ev("TL2.setFollow(true)"); await ev("TL2.setZoom(2)");
await walkClip(FRAMES, [
  [2405, 2440],   // Tiên Đồng at the gate
  [2665, 1660],   // Q1 Chấp Sự
  [2820, 1600],   // Q2 Đài Truyền Tống
  [2200, 1300],   // Đại Điện terrace
  [3650, 1180],   // Luyện Võ Trường
  [700, 1900],    // Trúc Linh Lâm
  [3600, 620],    // Linh Tuyền south bank
  [760, 760],     // Vân Ẩn Động forecourt
  [1005, 950],    // Thạch Vệ Tinh Anh
  [1560, 860],    // rear-gate portal platform, west terrace (Q7 departure)
  [2200, 1300],   // Q8 Chưởng Môn
  [2820, 1600],   // Q8 Đài Truyền Tống — xuất môn
], "clip_walk.mp4");

// ================================================================ HẬU SƠN (separate map)
await viewport(390, 844, 2, true);
await gotoPage("hauson");
await scene(1120, 720, 1120, 540, 2); await shot(join(PROOF, "shot_phone_hauson.png"));
await viewport(1500, 900, 1, false);
await gotoPage("hauson");
await scene(1120, 880, 1120, 560, 0);
await shot(join(PROOF, "shot_desktop_hauson.png"));
await viewport(780, 760, 1, false);
await gotoPage("hauson");
await baseChecks("hauson", "tools/base_list_hs.json");
await viewport(390, 844, 2, true);
await gotoPage("hauson");
await ev("TL2.setPlayerPx(1120, 880)");
await ev("TL2.setFollow(true)"); await ev("TL2.setZoom(2)");
await walkClip(FRAMES_HS, [
  [1120, 620],    // up the painted stair into the arena
  [1120, 560],    // boss front
], "clip_hauson.mp4");

chrome.kill();
server.close();
process.exit(0);
