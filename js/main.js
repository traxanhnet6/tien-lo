"use strict";
/* Tiên Lộ iso3 — FULL Thanh Vân Tiên Môn island, isometric 2:1.
   Eight zones, each ground a painted scene, stitched into one island image.
   The isometric lattice, collision and navigation are data laid over the
   paintings. Every solid is a separate painted object whose collision
   footprint is exactly its visible base; NPCs / monsters / the boss are
   actors in the same sorted render pass. Buildings split roof/body so the
   character passes behind correctly.
   Character: MOVE1 workflow atlases (merged from the stride4 tree after
   Bui's approval 2026-11-10) — stage A/B atlas for idle, STRIDE4 round-5
   walk/run atlases for movement. Every direction reads its own
   measured-pivot frame; no direction is mirrored. See WORKFLOW below
   and docs/merge-stride4-report.md. */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const PARAMS = new URLSearchParams(location.search);
const MANUAL = PARAMS.has("manual");
const MAP_ID = PARAMS.get("map") === "hauson" ? "hauson" : (PARAMS.get("map") === "xichviem" ? "xichviem" : "island");
const DATA = `data/${MAP_ID}/`;

const PLAYER_H = 118;                       // drawn height, painting px
const DIR_NAMES = ["east", "SE", "front", "SW", "west", "NW", "back", "NE"];
const ZOOMS = [0.5, 0.62, 0.75, 0.9, 1.05, 1.25, 1.5, 1.8];
/* Ha Nhan workflow stage A/B atlas (384x384 master cells) for idle, plus
   the STRIDE4 round-5 walk/run atlases (hanhan_stride4_walk/run): fully
   drawn generated strips re-anchored on the approved stage A-D set.
   Bui's speed ruling (2026-11-10) sets normal movement to WALKING
   only: walk speed is 90 paint px/s (Bui, 2026-11-10 22:40: "chậm tý
   nữa" — trimmed from the 100 merged an hour earlier), and fast
   movement comes only from the run function at 218 paint px/s (run
   is 2.42x walk). Cycle travel is walk 56, run 84 paint px/cycle
   (steps of 28 / 42). Covering every gait phase of both feet
   (contact, stance, passing, toe-off, swing) needs 4 drawn poses
   per step = 8 frames per cycle, so travel per frame is 56/8 = 7.0
   walking and 84/8 = 10.5 running. Frame advance is distance-driven
   (frame = dist / travel-per-frame), so at 90 px/s the walk cycle
   lasts 0.62 s — a relaxed ~3.2 steps/s (the run cycle lasts
   0.39 s, ~5.2 steps/s) — and the drawn stance
   foot keeps sweeping back at exactly the ground rate at any speed.
   See docs/stride4-report.md (source tree) and
   docs/merge-stride4-report.md. */
const WORKFLOW = { charH: 352, walkStride: 7.0, runStride: 10.5, idleFps: 8 };
const WORKFLOW_DIR = { front: "S", SE: "SE", east: "E", NE: "NE",
                       back: "N", NW: "NW", west: "W", SW: "SW" };
const WORKFLOW_FRAMES = new Map();

const S = {
  ready: false, t: 0, map: MAP_ID,
  ground: null, sprites: {}, idx: {},
  cells: new Map(), objects: [], actors: [], nav: null,
  portals: [], graceT: 0,
  cam: { x: 2200, y: 2400 }, zoomIdx: 2, follow: true,
  target: null, ripple: 0,
};
const P = { u: 0, v: 0, x: 0, y: 0, path: [], moving: false, running: false,
            dir: "front", dist: 0, idleT: 0, zone: "son_mon" };
// Loading progress (see init): total files counted up front, done counts
// each resolved load. Module scope so setLoad/tracked inside init close over it.
let LOAD_TOTAL = 0, LOAD_DONE = 0;

// ------------------------------------------------------------ loading
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}
async function loadJSON(src) { return (await fetch(src)).json(); }

async function init() {
  // Loading overlay: the game used to sit on a flat blank screen for the
  // whole 55 MB asset load (up to ~1 min on a phone), so Bui read it as
  // broken. Show progress from the first frame, and parallelise the
  // sprite loads (they used to be sequential awaits, one file at a time).
  const setLoad = (label) => {
    const st = document.getElementById("loadStatus");
    const fill = document.getElementById("loadFill");
    if (st && label) st.textContent = label;
    if (fill && LOAD_TOTAL > 0)
      fill.style.width = Math.round(LOAD_DONE / LOAD_TOTAL * 100) + "%";
  };
  const tracked = (p) => p.then(v => { LOAD_DONE++; setLoad(); return v; });
  setLoad("Đang tải bản đồ…");
  const nav = await tracked(loadJSON(DATA + "Map_Navigation.json"));
  const obj = await tracked(loadJSON(DATA + "Map_Objects.json"));
  // Count every sprite file up front so the bar is exact from the start.
  const names = new Set(obj.objects.filter(o => o.kind !== "split" && !o.actor).map(o => o.sprite));
  let spriteTotal = names.size;
  for (const o of obj.objects) {
    if (o.kind === "split") spriteTotal += 3;
    if (o.actor) spriteTotal += 1;
  }
  LOAD_TOTAL = 2 + 9 + spriteTotal;
  setLoad("Đang tải đảo và nhân vật…");
  const [ground, workflowAtlas, workflowData, stride4WalkAtlas, stride4WalkData,
         stride4RunAtlas, stride4RunData, col, idx] = await Promise.all([
    tracked(loadImage(nav.ground)),
    tracked(loadImage("assets/char_workflow/hanhan_stage_ab.png")),
    tracked(loadJSON("assets/char_workflow/hanhan_stage_ab.json")),
    tracked(loadImage("assets/char_workflow/hanhan_stride4_walk.png")),
    tracked(loadJSON("assets/char_workflow/hanhan_stride4_walk.json")),
    tracked(loadImage("assets/char_workflow/hanhan_stride4_run.png")),
    tracked(loadJSON("assets/char_workflow/hanhan_stride4_run.json")),
    tracked(loadJSON(DATA + "Map_Collision.json")),
    tracked(loadJSON("assets/objects_index.json")),
  ]);
  S.ground = ground; S.idx = idx; S.nav = nav;
  S.sprites.workflow = workflowAtlas;
  S.sprites.stride4_walk = stride4WalkAtlas;
  S.sprites.stride4_run = stride4RunAtlas;
  const ingest = (data, page) => {
    for (const f of data.frames) {
      // walk/run come from the stride4 atlases, not stage A/B
      if (!page && (f.animation === "walk" || f.animation === "run")) continue;
      if (page) f.page = page;
      const key = `${f.animation}|${f.direction}`;
      if (!WORKFLOW_FRAMES.has(key)) WORKFLOW_FRAMES.set(key, []);
      WORKFLOW_FRAMES.get(key).push(f);
    }
  };
  ingest(workflowData, null);
  ingest(stride4WalkData, "stride4_walk");
  ingest(stride4RunData, "stride4_run");
  for (const frames of WORKFLOW_FRAMES.values())
    frames.sort((a, b) => a.name.localeCompare(b.name));
  for (const c of Object.values(col.cells)) S.cells.set(c.u + "," + c.v, c);
  // All object/actor images in parallel (was: one sequential await each —
  // ~47 files × per-file latency on a phone). Actor order is preserved by
  // pushing to S.actors in object order after all images resolve.
  setLoad("Đang tải vật thể trên đảo…");
  await Promise.all([...names].map(n =>
    tracked(loadImage(`assets/objects/${n}.png`)).then(im => { S.sprites[n] = im; })));
  await Promise.all(obj.objects.map(async (o) => {
    if (o.kind === "split") {
      const [body, roof, full] = await Promise.all([
        tracked(loadImage(`assets/objects/${o.sprite}_body.png`)),
        tracked(loadImage(`assets/objects/${o.sprite}_roof.png`)),
        tracked(loadImage(`assets/objects/${o.sprite}_full.png`)),
      ]);
      S.sprites[o.sprite + "_body"] = body;
      S.sprites[o.sprite + "_roof"] = roof;
      S.sprites[o.sprite + "_full"] = full;
    }
    if (o.actor) o.img = await tracked(loadImage(o.actor.img));
  }));
  for (const o of obj.objects) if (o.actor) S.actors.push(o);
  S.objects = obj.objects;
  // map-hop arrival: a stored spawn point wins over the map default, and a
  // grace window + arm-on-exit discipline keep portals from bouncing the
  // player straight back (the trigger only arms after the player has left
  // its radius once, and never fires during the grace window)
  let spawnPx = nav.spawn_px;
  try {
    const hop = JSON.parse(sessionStorage.getItem("tl3_spawn") || "null");
    if (hop && hop.map === MAP_ID) { spawnPx = hop.px; sessionStorage.removeItem("tl3_spawn"); }
  } catch { /* no hop */ }
  S.portals = (nav.portals || []).map(p => ({ ...p, armed: false }));
  if (MAP_ID === "island") {
    let q8Done = false;
    try {
      const saved = JSON.parse(localStorage.getItem("tl3_save_v1") || "{}");
      if (saved && typeof saved.questIndex === "number" && saved.questIndex >= 8) q8Done = true;
    } catch {}
    if (q8Done) {
      S.portals.push({
        id: "portal_to_xichviem",
        px: [2820, 1572],
        r: 85,
        to_map: "xichviem",
        to_px: [1120, 880],
        label: "Cổng Xích Viêm",
        armed: false
      });
    }
  }
  S.graceT = 1.2;
  setPlayerPx(spawnPx[0], spawnPx[1]);
  const spawnCell = cellAt(P.u, P.v);
  if (spawnCell) P.zone = spawnCell.zone;
  S.cam.x = P.x; S.cam.y = P.y + 60;
  buildChips();
  const savedZoom = parseInt(localStorage.getItem("tl3_zoom") || "2", 10);
  if (savedZoom >= 0 && savedZoom < ZOOMS.length) setZoom(savedZoom);
  S.ready = true;
  resize();
  if (window.Gameplay) await Gameplay.init();
  const loadingEl = document.getElementById("loading");
  if (loadingEl) loadingEl.style.display = "none";
  if (!MANUAL) requestAnimationFrame(frame);
}

// ------------------------------------------------------------ projection
function proj(u, v) {
  const { origin, ex, ey } = S.nav;
  return [origin[0] + u * ex[0] + v * ey[0], origin[1] + u * ex[1] + v * ey[1]];
}
function invProj(px, py) {
  const { origin, ex, ey } = S.nav;
  const dx = px - origin[0], dy = py - origin[1];
  const det = ex[0] * ey[1] - ey[0] * ex[1];
  return [(dx * ey[1] - ey[0] * dy) / det, (ex[0] * dy - dx * ex[1]) / det];
}
function cellAt(u, v) { return S.cells.get(Math.round(u) + "," + Math.round(v)); }

// ------------------------------------------------------------ pathfinding (A*)
/* tiers: 0/1/3 are levels, 2 marks stair cells — a level change is only
   possible through a stair cell (authored exactly where a stair is painted) */
function tierStepOk(a, b) { return a === b || a === 2 || b === 2; }
function findPath(su, sv, tu, tv) {
  const key = (u, v) => u + "," + v;
  const start = S.cells.get(key(su, sv)), goal = S.cells.get(key(tu, tv));
  if (!start || !goal || !start.walk || !goal.walk) return null;
  const open = new Map(), came = new Map(), gScore = new Map();
  gScore.set(key(su, sv), 0);
  open.set(key(su, sv), { u: su, v: sv, f: 0 });
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
                [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (open.size) {
    let cur = null;
    for (const n of open.values()) if (!cur || n.f < cur.f) cur = n;
    open.delete(key(cur.u, cur.v));
    if (cur.u === tu && cur.v === tv) {
      const path = [];
      let k = key(tu, tv);
      while (k) { const [u, v] = k.split(",").map(Number); path.push([u, v]); k = came.get(k); }
      return path.reverse();
    }
    const cc = S.cells.get(key(cur.u, cur.v));
    for (const [du, dv, cost] of DIRS) {
      const nu = cur.u + du, nv = cur.v + dv, nk = key(nu, nv);
      const n = S.cells.get(nk);
      if (!n || !n.walk || !tierStepOk(cc.tier, n.tier)) continue;
      if (du && dv) {
        const a = S.cells.get(key(cur.u + du, cur.v)), b = S.cells.get(key(cur.u, cur.v + dv));
        if (!a || !a.walk || !b || !b.walk) continue;
      }
      const g = gScore.get(key(cur.u, cur.v)) + cost;
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, key(cur.u, cur.v));
        const h = Math.hypot(nu - tu, nv - tv);
        open.set(nk, { u: nu, v: nv, f: g + h });
      }
    }
  }
  return null;
}
function nearestWalkable(u, v, maxR = 9) {
  const c = cellAt(u, v);
  if (c && c.walk) return [c.u, c.v];
  for (let r = 1; r <= maxR; r++)
    for (let du = -r; du <= r; du++)
      for (let dv = -r; dv <= r; dv++) {
        if (Math.max(Math.abs(du), Math.abs(dv)) !== r) continue;
        const n = S.cells.get((Math.round(u) + du) + "," + (Math.round(v) + dv));
        if (n && n.walk) return [n.u, n.v];
      }
  return null;
}
function walkToPx(px, py) {
  const [fu, fv] = invProj(px, py);
  const goal = nearestWalkable(fu, fv);
  if (!goal) return false;
  const startCell = nearestWalkable(P.u, P.v);
  if (!startCell) return false;
  const cells = findPath(startCell[0], startCell[1], goal[0], goal[1]);
  if (!cells || cells.length < 2) return false;
  P.path = cells.slice(1).map(([u, v]) => {
    const c = S.cells.get(u + "," + v);
    return [c.x, c.y];
  });
  const gc = S.cells.get(goal[0] + "," + goal[1]);
  P.path[P.path.length - 1] = [gc.x, gc.y];
  let total = 0, lx = P.x, ly = P.y;
  for (const [x, y] of P.path) { total += Math.hypot(x - lx, y - ly); lx = x; ly = y; }
  P.running = total > 620;
  P.moving = true;
  S.target = [gc.x, gc.y]; S.ripple = 0;
  return true;
}

// ------------------------------------------------------------ player
function setPlayerPx(px, py) {
  const [u, v] = invProj(px, py);
  P.u = u; P.v = v; P.x = px; P.y = py; P.path = []; P.moving = false;
}
function dirFromVel(vx, vy) {
  let a = Math.atan2(vy, vx) * 180 / Math.PI;
  if (a < 0) a += 360;
  return DIR_NAMES[Math.round(a / 45) % 8];
}
// ------------------------------------------------------------ direct control
// HUD wave (2026-11-09): joystick + WASD drive the player through a manual
// velocity vector instead of an A* path. Gameplay owns the input widgets
// and calls TL2.setManualInput; a non-null vector cancels any path walk.
const manualInput = { active: false, x: 0, y: 0, speed: 0 };
function setManualInput(nx, ny, speed) {
  if (nx === null || nx === undefined) {
    manualInput.active = false;
    return;
  }
  manualInput.active = true;
  manualInput.x = nx; manualInput.y = ny;
  manualInput.speed = speed || 218;
  if (P.path.length) { P.path = []; S.target = null; }
}
function pointWalkable(px, py) {
  const [u, v] = invProj(px, py);
  const c = cellAt(u, v);
  return !!(c && c.walk);
}
// Collision-aware direct step (paint px), axis-separated so the player
// slides along walls instead of sticking. Sub-stepped so fast motion
// (dodge dash) cannot tunnel through thin obstacles. Returns the
// distance actually moved.
function stepPlayer(dx, dy) {
  const total = Math.hypot(dx, dy);
  if (total < 0.001) return 0;
  const steps = Math.max(1, Math.ceil(total / 9));
  const sx = dx / steps, sy = dy / steps;
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    let nx = P.x + sx, ny = P.y + sy;
    if (pointWalkable(nx, ny)) { P.x = nx; P.y = ny; moved += Math.hypot(sx, sy); continue; }
    if (pointWalkable(nx, P.y)) { P.x = nx; moved += Math.abs(sx); continue; }
    if (pointWalkable(P.x, ny)) { P.y = ny; moved += Math.abs(sy); continue; }
    break;
  }
  if (moved > 0.01) {
    P.dir = dirFromVel(dx, dy);
    P.dist += moved;
    const [u, v] = invProj(P.x, P.y);
    P.u = u; P.v = v;
    const c = cellAt(u, v);
    if (c && c.zone) P.zone = c.zone;
  }
  return moved;
}
function updatePlayer(dt) {
  const [cu, cv] = invProj(P.x, P.y);
  P.u = cu; P.v = cv;
  const cc0 = cellAt(cu, cv);
  if (cc0 && cc0.zone) P.zone = cc0.zone;
  // Casting / defending roots the player (spec §3.2/§5.3); manual input is
  // ignored while rooted, and any path is dropped so the cast is clean.
  const rooted = !!(window.Gameplay && Gameplay.movementLocked && Gameplay.movementLocked());
  if (rooted) {
    if (P.path.length) P.path = [];
    P.moving = false;
    P.idleT += dt;
    return;
  }
  if (manualInput.active) {
    P.moving = true;
    P.running = manualInput.speed > 200;
    P.idleT = 0;
    stepPlayer(manualInput.x * manualInput.speed * dt,
               manualInput.y * manualInput.speed * dt);
    return;
  }
  if (!P.path.length) { P.moving = false; P.idleT += dt; return; }
  const speed = P.running ? 218 : 90;
  let move = speed * dt;
  while (move > 0 && P.path.length) {
    const [tx, ty] = P.path[0];
    const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy);
    if (d <= move) {
      P.x = tx; P.y = ty; P.dist += d; move -= d; P.path.shift();
    } else {
      P.x += dx / d * move; P.y += dy / d * move; P.dist += move;
      P.dir = dirFromVel(dx, dy); move = 0;
    }
    if (d > 0.01) P.dir = dirFromVel(dx, dy);
  }
  const [u, v] = invProj(P.x, P.y);
  P.u = u; P.v = v;
  const c = cellAt(u, v);
  if (c && c.zone) P.zone = c.zone;
  if (!P.path.length) { P.moving = false; S.target = null; }
}

// ------------------------------------------------------------ camera / view
let VW = 0, VH = 0, DSF = 1;
function resize() {
  DSF = Math.min(window.devicePixelRatio || 1, 2);
  VW = window.innerWidth; VH = window.innerHeight;
  canvas.width = VW * DSF; canvas.height = VH * DSF;
}
window.addEventListener("resize", resize);
function zoom() { return ZOOMS[S.zoomIdx]; }
function setZoom(i) {
  S.zoomIdx = Math.max(0, Math.min(ZOOMS.length - 1, i));
  localStorage.setItem("tl3_zoom", String(S.zoomIdx));
  document.getElementById("zoomRange").value = S.zoomIdx;
  document.getElementById("zoomPct").textContent = Math.round(zoom() * 100) + "%";
}
function viewToPaint(cx, cy) {
  const z = zoom();
  return [S.cam.x + (cx - VW / 2) / z, S.cam.y + (cy - VH / 2) / z];
}

// ------------------------------------------------------------ drawing
function shadowEllipse(x, y, w, alpha) {
  // Guard: a non-finite centre/radius makes createRadialGradient throw and
  // can kill the rAF loop — skip the shadow instead of crashing the frame.
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || w <= 0) return;
  const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0;
  const h = w * 0.30;
  const g = ctx.createRadialGradient(x, y, 0, x, y, w / 2);
  g.addColorStop(0, `rgba(20,26,18,${a})`);
  g.addColorStop(0.7, `rgba(20,26,18,${a * 0.45})`);
  g.addColorStop(1, "rgba(20,26,18,0)");
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, h / (w / 2)); ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - w / 2, w, w);
  ctx.restore();
}
function drawSprite(im, anchorX, anchorY, dispW) {
  const h = dispW * im.naturalHeight / im.naturalWidth;
  ctx.drawImage(im, anchorX - dispW / 2, anchorY - h, dispW, h);
  return h;
}
function splitGeom(o) {
  const full = S.sprites[o.sprite + "_full"];
  const body = S.sprites[o.sprite + "_body"];
  const H = o.w * full.naturalHeight / full.naturalWidth;
  const bodyTopFrac = S.idx[o.sprite + "_body"].cut_from_top / full.naturalHeight;
  return { H, bodyTop: bodyTopFrac * H, body };
}
function drawPlayer() {
  // HUD wave: during a skill cast, the skill pack's own frame replaces the
  // body sprite (spec §10 — pack frames are the standard while casting; no
  // sword is drawn over them). Gameplay returns true when it has drawn.
  if (window.Gameplay && Gameplay.drawCastFrame && Gameplay.drawCastFrame(ctx)) return;
  const animation = P.moving ? (P.running ? "run" : "walk") : "idle";
  const direction = WORKFLOW_DIR[P.dir] ?? "S";
  const frames = WORKFLOW_FRAMES.get(`${animation}|${direction}`);
  if (!frames || !frames.length) return;
  const stride = P.running ? WORKFLOW.runStride : WORKFLOW.walkStride;
  const index = P.moving
    ? Math.floor(P.dist / stride) % frames.length
    : Math.floor(P.idleT * WORKFLOW.idleFps) % frames.length;
  const f = frames[index];
  const sc = PLAYER_H / WORKFLOW.charH;
  // The atlas pivot is measured in trimmed-rect coordinates and is the
  // frame's ground-contact anchor. One uniform master scale preserves the
  // package's relative body proportions across every pose and direction.
  ctx.drawImage(f.page ? S.sprites[f.page] : S.sprites.workflow,
                f.rect.x, f.rect.y, f.rect.w, f.rect.h,
                P.x - f.pivot.x * sc, P.y - f.pivot.y * sc,
                f.rect.w * sc, f.rect.h * sc);
}
function drawActor(o) {
  if (window.Gameplay && Gameplay.drawActor(o, ctx, S.t)) return o.actor.h;
  const a = o.actor, im = o.img;
  const bob = Math.sin(S.t * (a.bobSpeed || 1.1) + (o.anchor[0] % 17)) * (a.bob ?? 1.6);
  const baseY = o.anchor[1] + bob;
  if (a.sheet) {
    const { cellW, cellH, frames, fps } = a.sheet;
    const seq = a.sheet.pingpong
      ? [...frames, ...frames.slice(1, -1).reverse()]
      : frames;
    const fi = seq[Math.floor(S.t * fps + (o.anchor[0] % 5)) % seq.length];
    const col = fi % a.sheet.cols, row = Math.floor(fi / a.sheet.cols);
    const dh = a.h, dw = dh * cellW / cellH;
    ctx.drawImage(im, col * cellW, row * cellH, cellW, cellH,
                  o.anchor[0] - dw / 2, baseY - dh, dw, dh);
    return dh;
  }
  const dh = a.h, dw = dh * im.naturalWidth / im.naturalHeight;
  ctx.drawImage(im, o.anchor[0] - dw / 2, baseY - dh, dw, dh);
  return dh;
}
function drawLabel(o) {
  const a = o.actor;
  if (!a.label) return;
  const dh = a.h + (a.labelLift || 14);
  ctx.save();
  ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
  const w = ctx.measureText(a.label).width + 18;
  const x = o.anchor[0] - w / 2, y = o.anchor[1] - dh - 24;
  ctx.fillStyle = a.type === "boss" ? "rgba(70,16,10,0.78)"
              : a.type === "monster" ? "rgba(24,30,20,0.72)" : "rgba(16,34,38,0.78)";
  ctx.strokeStyle = a.type === "npc" ? "rgba(212,175,55,0.65)" : "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 24, 8);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = a.type === "boss" ? "#ffd9c9" : "#fdf6da";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(a.label, o.anchor[0], y + 13);
  ctx.restore();
}

/* clouds ringing the island (positions derived from the world size) */
let CLOUDS = [];
function buildClouds(W, H) {
  CLOUDS = [];
  const pts = [[-0.06, 0.2], [0.16, -0.05], [0.38, -0.07], [0.6, -0.05], [0.84, -0.06],
               [1.05, 0.18], [1.06, 0.5], [1.04, 0.82], [0.86, 1.05], [0.58, 1.07],
               [0.3, 1.05], [0.05, 1.04], [-0.07, 0.8], [-0.08, 0.48]];
  for (const [fx, fy] of pts) CLOUDS.push([fx * W, fy * H, 480 + ((fx * 791) % 260)]);
}
function drawCloud(cx, cy, r, a0 = 0.85, a1 = 0.45) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(255,255,255,${a0})`);
  g.addColorStop(0.6, `rgba(255,255,255,${a1})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function render() {
  const z = zoom();
  const sky = ctx.createLinearGradient(0, 0, 0, VH * DSF);
  sky.addColorStop(0, "#a8c4d4"); sky.addColorStop(0.55, "#c3d5dd"); sky.addColorStop(1, "#e6ede9");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(z * DSF, 0, 0, z * DSF,
                   (VW / 2 - S.cam.x * z) * DSF, (VH / 2 - S.cam.y * z) * DSF);
  for (const [cx, cy, r] of CLOUDS) drawCloud(cx, cy, r);
  ctx.drawImage(S.ground, 0, 0);
  if (window.Gameplay) Gameplay.renderGroundVFX(ctx, z);

  const decor = S.objects.filter(o => o.decor).sort((a, b) => a.anchor[1] - b.anchor[1]);
  for (const o of decor) drawSprite(S.sprites[o.sprite], o.anchor[0], o.anchor[1], o.w);

  const items = [];
  for (const o of S.objects) {
    if (o.decor) continue;
    items.push({ y: o.anchor[1], kind: o.actor ? "actor" : "obj", o });
  }
  items.push({ y: P.y, kind: "player" });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.kind === "obj") shadowEllipse(it.o.anchor[0], it.o.anchor[1], Math.max(36, it.o.w * 0.66), 0.34);
    else if (it.kind === "actor") shadowEllipse(it.o.anchor[0], it.o.anchor[1], Math.max(34, it.o.actor.shadowW || 52), 0.34);
    else shadowEllipse(P.x, P.y, 52, 0.34);
  }
  const roofs = [];
  for (const it of items) {
    if (it.kind === "player") { drawPlayer(); continue; }
    if (it.kind === "actor") { drawActor(it.o); continue; }
    const o = it.o;
    const im = S.sprites[o.sprite];
    if (o.flip) {
      const h = o.w * im.naturalHeight / im.naturalWidth;
      ctx.save();
      ctx.translate(o.anchor[0], o.anchor[1]);
      ctx.scale(-1, 1);
      ctx.drawImage(im, -o.w / 2, -h, o.w, h);
      ctx.restore();
      continue;
    }
    if (o.kind === "split") {
      const g = splitGeom(o);
      const roofFrontY = o.anchor[1] + (o.roof_front_dy || 0);
      const bodyH = g.H - g.bodyTop;
      ctx.drawImage(g.body, o.anchor[0] - o.w / 2, o.anchor[1] - bodyH, o.w, bodyH);
      if (P.y < roofFrontY) roofs.push(o);
      else {
        const roof = S.sprites[o.sprite + "_roof"];
        const roofH = g.H * roof.naturalHeight / S.sprites[o.sprite + "_full"].naturalHeight;
        ctx.drawImage(roof, o.anchor[0] - o.w / 2, o.anchor[1] - g.H, o.w, roofH);
      }
      continue;
    }
    drawSprite(im, o.anchor[0], o.anchor[1], o.w);
  }
  for (const o of roofs.sort((a, b) => a.anchor[1] - b.anchor[1])) {
    const g = splitGeom(o);
    const roof = S.sprites[o.sprite + "_roof"];
    const roofH = g.H * roof.naturalHeight / S.sprites[o.sprite + "_full"].naturalHeight;
    ctx.drawImage(roof, o.anchor[0] - o.w / 2, o.anchor[1] - g.H, o.w, roofH);
  }
  for (const o of S.actors) drawLabel(o);
  drawPortalLabels();

  if (S.target) {
    S.ripple += 0.03;
    const r = 10 + (S.ripple % 1) * 22;
    ctx.strokeStyle = "rgba(255,215,90,0.9)";
    ctx.lineWidth = 2.5 / z;
    ctx.beginPath();
    ctx.ellipse(S.target[0], S.target[1], r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // atmosphere: drifting cloud shadows + data-driven spirit motes (kept light)
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const cx = ((S.t * 9 * (i + 1) + i * 1500) % (S.nav.paint.w + 1000)) - 500;
    const cy = 200 + i * 800;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 460);
    g.addColorStop(0, "rgba(30,40,50,0.05)");
    g.addColorStop(1, "rgba(30,40,50,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - 460, cy - 460, 920, 920);
  }
  for (const fx of (S.nav.fx || [])) {
    ctx.fillStyle = fx.color || "rgba(190,240,255,0.8)";
    const n = fx.n || 18, r = fx.r || 120;
    for (let i = 0; i < n; i++) {
      const bx = fx.x + Math.sin(i * 7.3) * r, by = fx.y + ((i * 53) % (r * 1.4)) - r * 0.7;
      const x = bx + Math.sin(S.t * 0.7 + i * 1.7) * 14;
      const y = by + Math.cos(S.t * 0.5 + i * 2.3) * 9 - (S.t * 4 + i * 9) % 24;
      ctx.globalAlpha = 0.22 + 0.32 * Math.abs(Math.sin(S.t * 1.3 + i));
      ctx.fillRect(x, y, 2.6, 2.6);
    }
  }
  ctx.restore();
  // Gameplay world-space VFX (slashes, HP bars, floating text, target marker)
  // — drawn while the world transform is still active, above the actors.
  if (window.Gameplay) Gameplay.renderWorldVFX(ctx, z);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const wash = ctx.createLinearGradient(0, 0, canvas.width * 0.75, canvas.height);
  wash.addColorStop(0, "rgba(255,240,200,0.10)");
  wash.addColorStop(0.5, "rgba(255,240,200,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Gameplay screen-space UI (off-screen quest arrow, gathering bar) — it
  // works in CSS pixels, so present it under the device-pixel scale.
  ctx.setTransform(DSF, 0, 0, DSF, 0, 0);
  if (window.Gameplay) Gameplay.renderScreenUI(ctx);
}

// ------------------------------------------------------------ main loop
let lastTs = 0;
function step(dt) {
  S.t += dt;
  updatePlayer(dt);
  if (window.Gameplay) Gameplay.update(dt);
  checkPortals(dt);
  if (S.follow) {
    S.cam.x += (P.x - S.cam.x) * Math.min(1, dt * 5);
    S.cam.y += ((P.y + 40) - S.cam.y) * Math.min(1, dt * 5);
  }
  const W = S.nav.paint.w, H = S.nav.paint.h;
  S.cam.x = Math.max(-320, Math.min(W + 320, S.cam.x));
  S.cam.y = Math.max(-480, Math.min(H + 480, S.cam.y));
  if (MAP_ID === "xichviem") {
    // Xích Viêm Cốc's ground painting fills its whole 2240x1120 world
    // edge-to-edge (it is not a floating island), so the camera must not
    // show the sky gradient beyond the painting — at the south edge that
    // read as a white void under the HUD. Clamp the view inside the
    // painting for this map only; island/hauson keep the sky margin.
    const hw = VW / (2 * zoom()), hh = VH / (2 * zoom());
    S.cam.x = (hw * 2 >= W) ? W / 2 : Math.max(hw, Math.min(W - hw, S.cam.x));
    S.cam.y = (hh * 2 >= H) ? H / 2 : Math.max(hh, Math.min(H - hh, S.cam.y));
  }
  const label = (S.nav.zones[P.zone] || {}).label || P.zone;
  const zn = document.getElementById("zoneName");
  if (zn.textContent !== label) zn.textContent = label;
  document.querySelectorAll(".zone-chip").forEach(ch =>
    ch.classList.toggle("active", ch.dataset.zone === P.zone));
  render();
}
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (S.ready) step(dt);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ portals (map hops)
function checkPortals(dt) {
  if (S.graceT > 0) S.graceT -= dt;
  for (const p of S.portals) {
    const d = Math.hypot(P.x - p.px[0], P.y - p.px[1]);
    if (d > p.r + 30) p.armed = true;            // arm only after leaving the zone
    if (MANUAL) continue;                        // screenshot mode never hops
    if (p.armed && d <= p.r && S.graceT <= 0) {
      sessionStorage.setItem("tl3_spawn", JSON.stringify({ map: p.to_map, px: p.to_px }));
      const q = new URLSearchParams(location.search);
      q.set("map", p.to_map);
      location.search = q.toString();
      return;
    }
  }
}
function drawPortalLabels() {
  for (const p of S.portals) {
    ctx.save();
    ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
    const w = ctx.measureText(p.label).width + 20;
    const x = p.px[0] - w / 2, y = p.px[1] - 128;
    ctx.fillStyle = "rgba(24,40,60,0.80)";
    ctx.strokeStyle = "rgba(140,230,255,0.7)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, 25, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#dff6ff";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("⇄ " + p.label, p.px[0], y + 13.5);
    ctx.restore();
  }
}

// ------------------------------------------------------------ input
let drag = null;
canvas.addEventListener("pointerdown", e => {
  drag = { x: e.clientX, y: e.clientY, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 7) drag.moved = true;
  if (drag.moved) {
    S.cam.x -= dx / zoom(); S.cam.y -= dy / zoom();
    drag.x = e.clientX; drag.y = e.clientY;
    if (S.follow) { S.follow = false; syncFollowBtn(); }
  }
});
canvas.addEventListener("pointerup", e => {
  if (drag && !drag.moved) tapAt(e.clientX, e.clientY);
  drag = null;
});
// The game's single tap path: gameplay claims the tap first (attack /
// talk / gather / dais); an unclaimed tap falls through to tap-to-move.
// The HUD joystick replays never-dragged touches through here so a tap
// inside the joystick region behaves exactly like a canvas tap.
function tapAt(cx, cy) {
  const [px, py] = viewToPaint(cx, cy);
  if (!(window.Gameplay && Gameplay.handlePointerClick(px, py, null))) walkToPx(px, py);
}
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  setZoom(S.zoomIdx + (e.deltaY < 0 ? 1 : -1));
}, { passive: false });
document.addEventListener("gesturestart", e => e.preventDefault());
document.addEventListener("dblclick", e => e.preventDefault());

const followBtn = document.getElementById("followBtn");
function syncFollowBtn() { followBtn.classList.toggle("off", !S.follow); }
followBtn.addEventListener("click", () => { S.follow = !S.follow; syncFollowBtn(); });
document.getElementById("zoomIn").addEventListener("click", () => setZoom(S.zoomIdx + 1));
document.getElementById("zoomOut").addEventListener("click", () => setZoom(S.zoomIdx - 1));
document.getElementById("zoomRange").addEventListener("input", e => setZoom(parseInt(e.target.value, 10)));
function buildChips() {
  const box = document.getElementById("zoneChips");
  box.innerHTML = "";
  for (const [zid, z] of Object.entries(S.nav.zones)) {
    const b = document.createElement("button");
    b.className = "chip zone-chip";
    b.dataset.zone = zid;
    b.textContent = z.label;
    b.addEventListener("click", () => {
      S.follow = true; syncFollowBtn();
      walkToPx(z.anchor_px[0], z.anchor_px[1]);
    });
    box.appendChild(b);
  }
}

// ------------------------------------------------------------ test hooks (screenshot/clip driver)
window.TL2 = {
  setPlayerPx, walkToPx,
  // HUD-wave direct-control hooks (joystick/WASD velocity, dodge steps,
  // cast facing). setManualInput(null) releases manual control.
  setManualInput, tapAt,
  stepPlayerPx: (dx, dy) => stepPlayer(dx, dy),
  setFacing: (dirName) => { if (DIR_NAMES.includes(dirName)) P.dir = dirName; },
  playerDir: () => P.dir,
  setCam(x, y) { S.cam.x = x; S.cam.y = y; S.follow = false; syncFollowBtn(); },
  setFollow(f) { S.follow = f; syncFollowBtn(); },
  setZoom,
  step(ms) { if (S.ready) step(ms / 1000); },
  state: () => ({ x: P.x, y: P.y, zone: P.zone, moving: P.moving, path: P.path.length, map: S.map,
                  cam: [S.cam.x, S.cam.y], zoom: zoom() }),
  ready: () => S.ready,
};

init().then(() => buildClouds(S.nav.paint.w, S.nav.paint.h))
  .catch(err => {
    window.__err = String(err && err.stack || err);
    console.error(err);
    // Never leave a silent blank screen: the loading overlay stays up and
    // shows the failure so the player (and the next diagnosis) can see it.
    const st = document.getElementById("loadStatus");
    if (st) st.textContent = "Tải game lỗi — thử tải lại trang. Chi tiết: " + window.__err.slice(0, 200);
  });
