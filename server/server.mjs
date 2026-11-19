"use strict";
/* Tiên Lộ — GD3 authoritative combat server (spec §8.2 / §9 GĐ3).
 *
 * Pure Node.js, zero external packages: HTTP static file serving for the
 * game tree + a minimal RFC 6455 WebSocket implementation on the same
 * port. The server is the authority for COMBAT state in online mode:
 * player HP/MP/ULT-energy/cooldowns and monster/boss HP (+ boss phase)
 * per map room. Clients send cast/attack INTENTS in the spec §8.1
 * schema shape; the server validates (state, energy, mana, cooldown,
 * target alive, range) and computes results itself from the `damage`
 * formula strings of the skill table — the client only presents.
 *
 * Skill/monster/boss numbers are read from the SAME data the client
 * uses (js/game_data.js evaluated in a vm sandbox + data/<map>/
 * Map_Objects.json anchors), so there is one numeric source of truth.
 * All numbers remain PROVISIONAL (see game_data.js / hud-report.md).
 *
 * Team-chosen parameters for this wave (LABELLED, see gd3-report.md):
 *  - Port 8917, HTTP + WS on the same port.
 *  - RANGE_LEEWAY: monsters live at their home anchors server-side
 *    (monster AI movement stays a client-side visual in this wave), so
 *    range checks allow extra distance to cover chase displacement.
 *  - World sync broadcast every 1000ms; MP regen tick 250ms.
 *  - Player positions are client-reported (movement is not validated
 *    in this wave); player stats are adopted from the join snapshot
 *    (no account system yet) and owned by the server afterwards.
 *  - Server state is in-memory only; nothing persists across restarts.
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || process.env.TL_PORT || 8917); // Render cấp PORT; TL_PORT dùng khi chạy local
const RANGE_LEEWAY = 550;         // px, covers client-side monster chase
const DIRECTIONAL_LEEWAY = 280;   // px, cone skills (origin-anchored)
const MONSTER_HIT_LEEWAY = 650;   // px, monster->player hit reports
const WORLD_SYNC_MS = 1000;
const REGEN_TICK_MS = 250;

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------------------------------------------------------------- data
const gameDataSrc = readFileSync(join(ROOT, "js/game_data.js"), "utf8");
const GAME_DATA = vm.runInNewContext(gameDataSrc + "\n;GAME_DATA;", { window: {} }, { filename: "game_data.js" });

// Skill table: the server-relevant fields of the client SKILLS table
// (js/gameplay.js), in the §8.1 schema shape. The gd3 harness asserts
// mana/energy costs against the client's live inspectSkills() output.
const SKILLS = [
  { skill_id: "sk_thaicuc_chuong",  cooldown: 5,  mana_cost: 12, energy_cost: 0,   target_type: "directional", range: 250, damage: "atk * 1.5" },
  { skill_id: "sk_kimcang_quyen",   cooldown: 8,  mana_cost: 18, energy_cost: 0,   target_type: "single",      range: 160, damage: "atk * 2.2" },
  { skill_id: "sk_philong_cuoc",    cooldown: 10, mana_cost: 16, energy_cost: 0,   target_type: "single",      range: 330, damage: "atk * 1.9" },
  { skill_id: "sk_batquai_chuong",  cooldown: 12, mana_cost: 22, energy_cost: 0,   target_type: "area",        range: 175, damage: "atk * 1.4", radius: 175, center: "self" },
  { skill_id: "ult_nguhanh_quyen",  cooldown: 1,  mana_cost: 0,  energy_cost: 100, target_type: "area",        range: 400, damage: "atk * 3.2", radius: 190, center: "aim" },
  { skill_id: "sk_hoavan_toan",     cooldown: 13, mana_cost: 24, energy_cost: 0,   target_type: "area",        range: 170, damage: "atk * 1.6", radius: 170, center: "self" },
  { skill_id: "sk_bangphong_chuong",cooldown: 11, mana_cost: 20, energy_cost: 0,   target_type: "single",      range: 300, damage: "atk * 1.7" },
  { skill_id: "sk_loidinh_kich",    cooldown: 9,  mana_cost: 19, energy_cost: 0,   target_type: "single",      range: 340, damage: "atk * 2.0" },
  { skill_id: "sk_thienphong_bo",   cooldown: 8,  mana_cost: 14, energy_cost: 0,   target_type: "self",        range: 260, damage: "atk * 0" },
  { skill_id: "sk_voanh_lienhoan",  cooldown: 14, mana_cost: 26, energy_cost: 0,   target_type: "single",      range: 170, damage: "atk * 2.4" },
];
const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.skill_id, s]));

function evalDamageFormula(formula, atk) {
  const m = /^atk\s*\*\s*([\d.]+)(?:\s*\+\s*([\d.]+))?$/.exec(String(formula || "").trim());
  if (!m) return atk;
  return atk * parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) : 0);
}
function monsterCfgKey(id) {
  if (id.includes("linhlang")) return "linhlang";
  if (id.includes("thachve_elite")) return "thachve_elite";
  if (id.includes("thachve")) return "thachve";
  if (id.includes("hoatinh")) return "hoatinh";
  if (id.includes("hoanhamlang")) return "hoanhamlang";
  if (id.includes("xichviem_elite")) return "xichviem_elite";
  if (id.includes("viemnham")) return "viemnham";
  return "trucyeu";
}

// ------------------------------------------------------------- worlds
// One room per map; created lazily, lives for the server's lifetime.
// Monster/boss HP in a room NEVER resets on player death (Bui's law,
// 2026-11-09) — it only changes when a validated hit lands.
const rooms = new Map();
function buildRoom(map) {
  const room = { map, players: new Map(), monsters: new Map(), boss: null };
  let objects = [];
  try {
    objects = JSON.parse(readFileSync(join(ROOT, "data", map, "Map_Objects.json"), "utf8")).objects || [];
  } catch { /* map without objects */ }
  for (const o of objects) {
    const a = o.actor || {};
    if (a.type === "monster") {
      const cfgKey = monsterCfgKey(o.id);
      const cfg = GAME_DATA.monsters[cfgKey];
      room.monsters.set(o.id, {
        id: o.id, kind: "monster", cfgKey, def: cfg.def || 0, atk: cfg.atk || 0,
        attackCooldown: cfg.attackCooldown || 1.8, attackRange: cfg.attackRange || 85,
        x: o.anchor[0], y: o.anchor[1], hp: cfg.maxHp, maxHp: cfg.maxHp, dead: false,
      });
    } else if (a.type === "boss") {
      const cfg = o.id === "boss_xichviem" ? GAME_DATA.boss_xichviem : GAME_DATA.boss;
      room.boss = {
        id: o.id, kind: "boss", def: cfg.def || 0, cfg,
        x: o.anchor[0], y: o.anchor[1], hp: cfg.maxHp, maxHp: cfg.maxHp,
        dead: false, phase: 1,
      };
    }
  }
  rooms.set(map, room);
  log(`[ROOM] built ${map}: ${room.monsters.size} monsters, boss=${room.boss ? room.boss.id : "none"}`);
  return room;
}
const getRoom = map => rooms.get(map) || buildRoom(map);

function roomSnapshot(room) {
  return {
    monsters: [...room.monsters.values()].map(m => ({ id: m.id, hp: m.hp, maxHp: m.maxHp, dead: m.dead, x: m.x, y: m.y })),
    boss: room.boss ? { id: room.boss.id, hp: room.boss.hp, maxHp: room.boss.maxHp, dead: room.boss.dead, phase: room.boss.phase, x: room.boss.x, y: room.boss.y } : null,
    players: [...room.players.values()].map(publicPlayer),
  };
}
function publicPlayer(p) {
  return { id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir,
           hp: Math.ceil(p.hp), maxHp: p.maxHp, dead: p.dead };
}
function youState(p) {
  const cds = {};
  const now = Date.now();
  for (const [id, at] of Object.entries(p.cdReadyAt)) {
    const left = (at - now) / 1000;
    if (left > 0) cds[id] = Math.round(left * 10) / 10;
  }
  return { hp: Math.ceil(p.hp), maxHp: p.maxHp, mp: Math.floor(p.mp), maxMp: p.maxMp,
           energy: Math.round(p.energy), dead: p.dead, cds };
}

// ------------------------------------------------------------- combat
function applyDamage(room, caster, target, rawAtk) {
  // Mirrors the client's damageMonster/damageBoss arithmetic (same
  // variance band and floors), computed here so the result is the
  // server's, not the client's.
  const isBoss = target.kind === "boss";
  const dmg = isBoss
    ? Math.max(10, Math.round(rawAtk * (0.9 + Math.random() * 0.25) - target.def))
    : Math.max(8, Math.round(rawAtk * (0.9 + Math.random() * 0.25) - target.def));
  target.hp -= dmg;
  let phaseChanged = null;
  if (isBoss && target.hp > 0) {
    const frac = target.hp / target.maxHp;
    if (target.phase === 1 && frac <= 0.66) { target.phase = 2; phaseChanged = 2; }
    else if (target.phase === 2 && frac <= 0.33) { target.phase = 3; phaseChanged = 3; }
  }
  if (target.hp <= 0) { target.hp = 0; target.dead = true; }
  caster.energy = Math.min(100, caster.energy + 2); // +2 per enemy damaged (spec §3.5)
  return { target_id: target.id, kind: target.kind, dmg, hp: target.hp, maxHp: target.maxHp,
           dead: target.dead, phase: isBoss ? target.phase : undefined, phaseChanged };
}

function validateAndResolveCast(room, p, msg) {
  // Rejection order mirrors the client's castBlockReason decision
  // (resources before cooldown) with target checks appended:
  // unknown_skill -> dead -> energy -> mana -> cooldown ->
  // invalid_target -> out_of_range.
  const def = SKILL_BY_ID[msg.skill_id];
  if (!def) return { ok: false, reason: "unknown_skill" };
  if (p.dead) return { ok: false, reason: "dead" };
  if (def.energy_cost > 0 && p.energy < def.energy_cost) return { ok: false, reason: "energy" };
  if (p.mp < def.mana_cost) return { ok: false, reason: "mana" };
  const now = Date.now();
  if ((p.cdReadyAt[def.skill_id] || 0) > now) return { ok: false, reason: "cooldown" };

  const targets = [];
  if (def.target_type === "single") {
    const t = msg.target_id === (room.boss && room.boss.id) ? room.boss : room.monsters.get(msg.target_id);
    if (!t || t.dead) return { ok: false, reason: "invalid_target" };
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d > def.range + RANGE_LEEWAY) return { ok: false, reason: "out_of_range" };
    targets.push(t);
  } else if (def.target_type === "directional") {
    const a = Number(msg.angle) || 0;
    const reach = def.range + 30 + DIRECTIONAL_LEEWAY;
    const inCone = t => {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > reach) return false;
      let diff = Math.abs(Math.atan2(t.y - p.y, t.x - p.x) * 180 / Math.PI - a) % 360;
      if (diff > 180) diff = 360 - diff;
      return diff <= 42;
    };
    for (const m of room.monsters.values()) if (!m.dead && inCone(m)) targets.push(m);
    if (room.boss && !room.boss.dead && inCone(room.boss)) targets.push(room.boss);
  } else if (def.target_type === "area") {
    let cx = p.x, cy = p.y;
    if (def.center !== "self" && msg.point) {
      const dx = msg.point.x - p.x, dy = msg.point.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, def.range);
      cx = p.x + dx / d * cl; cy = p.y + dy / d * cl;
    }
    const radius = def.radius || def.range;
    for (const m of room.monsters.values())
      if (!m.dead && Math.hypot(m.x - cx, m.y - cy) <= radius) targets.push(m);
    if (room.boss && !room.boss.dead &&
        Math.hypot(room.boss.x - cx, room.boss.y - cy) <= radius + 40) targets.push(room.boss);
  }
  // "self" skills (Thiên Phong Bộ): no target, no damage — resources only.

  p.mp -= def.mana_cost;
  if (def.energy_cost > 0) p.energy = Math.max(0, p.energy - def.energy_cost);
  p.cdReadyAt[def.skill_id] = now + def.cooldown * 1000;
  const rawAtk = evalDamageFormula(def.damage, p.atk);
  const hits = targets.map(t => applyDamage(room, p, t, rawAtk));
  return { ok: true, hits };
}

function validateAndResolveAttack(room, p) {
  if (p.dead) return { ok: false, reason: "dead" };
  const now = Date.now();
  const cdMs = (GAME_DATA.player.atkCooldown || 0.6) * 1000;
  if (now - (p.lastAtkAt || 0) < cdMs) return { ok: false, reason: "cooldown" };
  p.lastAtkAt = now;
  const reach = (GAME_DATA.player.atkRange || 105) + RANGE_LEEWAY;
  const hits = [];
  for (const m of room.monsters.values())
    if (!m.dead && Math.hypot(m.x - p.x, m.y - p.y) <= reach) hits.push(applyDamage(room, p, m, p.atk));
  const b = room.boss;
  if (b && !b.dead && Math.hypot(b.x - p.x, b.y - p.y) <= reach + 60) hits.push(applyDamage(room, p, b, p.atk));
  return { ok: true, hits };
}

// ------------------------------------------------------------ ws core
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
function wsAccept(key) { return createHash("sha1").update(key + WS_GUID).digest("base64"); }
function encodeFrame(str) {
  const payload = Buffer.from(str, "utf8");
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.from([0x81, len]); }
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
class WSConn {
  constructor(socket) {
    this.socket = socket; this.buf = Buffer.alloc(0); this.frag = [];
    this.player = null; this.room = null; this.alive = true;
    socket.on("data", d => this.onData(d));
    socket.on("close", () => this.onClose());
    socket.on("error", () => this.onClose());
  }
  send(obj) { if (this.alive) { try { this.socket.write(encodeFrame(JSON.stringify(obj))); } catch { /* gone */ } } }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = !!(b0 & 0x80), op = b0 & 0x0f, masked = !!(b1 & 0x80);
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      const maskOff = off; if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let payload = this.buf.subarray(off, off + len);
      if (masked) {
        const mask = this.buf.subarray(maskOff, maskOff + 4);
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
        payload = out;
      }
      this.buf = this.buf.subarray(off + len);
      if (op === 0x9) { // ping -> pong
        const head = Buffer.from([0x8a, payload.length]);
        try { this.socket.write(Buffer.concat([head, payload])); } catch { /* gone */ }
        continue;
      }
      if (op === 0x8) { this.onClose(); try { this.socket.end(); } catch { /* gone */ } return; }
      if (op === 0x1 || op === 0x0) {
        this.frag.push(payload);
        if (fin) {
          const full = Buffer.concat(this.frag).toString("utf8");
          this.frag = [];
          let msg; try { msg = JSON.parse(full); } catch { continue; }
          try { handleMessage(this, msg); } catch (e) { log("[ERR]", e && e.message); }
        }
      }
    }
  }
  onClose() {
    if (!this.alive) return;
    this.alive = false;
    if (this.player && this.room) {
      this.room.players.delete(this.player.id);
      broadcast(this.room, { type: "player_left", playerId: this.player.id }, null);
      log(`[LEAVE] ${this.player.id} (${this.player.name}) from ${this.room.map}`);
    }
    this.player = null; this.room = null;
  }
}
function broadcast(room, obj, except) {
  for (const p of room.players.values()) if (p.conn !== except) p.conn.send(obj);
}

// ------------------------------------------------------------- logic
let nextPlayerId = 1;
function handleMessage(conn, msg) {
  const p = conn.player;
  switch (msg.type) {
    case "hello": {
      const map = String(msg.map || "island");
      const room = getRoom(map);
      const s = msg.stats || {};
      const np = {
        id: "p" + (nextPlayerId++), conn,
        name: String(msg.name || "Hà Nhân").slice(0, 24),
        x: Number(msg.x) || 0, y: Number(msg.y) || 0, dir: "front",
        atk: Number(s.atk) || GAME_DATA.player.atk, def: Number(s.def) || GAME_DATA.player.def,
        maxHp: Number(s.maxHp) || GAME_DATA.player.maxHp,
        hp: Math.min(Number(s.hp) || GAME_DATA.player.maxHp, Number(s.maxHp) || GAME_DATA.player.maxHp),
        maxMp: Number(s.maxMp) || 60, mp: Math.min(Number(s.mp) ?? 60, Number(s.maxMp) || 60),
        mpRegen: Number(s.mpRegen) || 3.5,
        energy: Math.max(0, Math.min(100, Number(s.energy) || 0)),
        dead: false, cdReadyAt: {}, lastAtkAt: 0, lastHitBy: {},
      };
      conn.player = np; conn.room = room;
      room.players.set(np.id, np);
      conn.send({ type: "welcome", playerId: np.id, you: youState(np), world: roomSnapshot(room) });
      broadcast(room, { type: "player_joined", player: publicPlayer(np) }, conn);
      log(`[JOIN] ${np.id} (${np.name}) -> ${map} atk=${np.atk} maxHp=${np.maxHp} mp=${np.mp}`);
      break;
    }
    case "enter_map": {
      if (!p) return;
      const old = conn.room;
      if (old) { old.players.delete(p.id); broadcast(old, { type: "player_left", playerId: p.id }, conn); }
      const room = getRoom(String(msg.map || "island"));
      conn.room = room; room.players.set(p.id, p);
      if (typeof msg.x === "number") p.x = msg.x;
      if (typeof msg.y === "number") p.y = msg.y;
      conn.send({ type: "map_state", map: room.map, world: roomSnapshot(room) });
      broadcast(room, { type: "player_joined", player: publicPlayer(p) }, conn);
      log(`[MAP] ${p.id} -> ${room.map}`);
      break;
    }
    case "pos": {
      if (!p) return;
      p.x = Number(msg.x) || 0; p.y = Number(msg.y) || 0;
      if (msg.dir) p.dir = String(msg.dir);
      broadcast(conn.room, { type: "player_moved", player: publicPlayer(p) }, conn);
      break;
    }
    case "cast_intent": {
      if (!p) return;
      const res = validateAndResolveCast(conn.room, p, msg);
      if (res.ok) {
        log(`[CAST] ${p.id} ${msg.skill_id} ACCEPT hits=${res.hits.length}` +
            res.hits.map(h => ` ${h.target_id}:${h.dmg}->${h.hp}${h.dead ? " DEAD" : ""}`).join(""));
        conn.send({ type: "cast_result", seq: msg.seq, ok: true, skill_id: msg.skill_id, hits: res.hits, you: youState(p) });
        broadcast(conn.room, { type: "hit_event", by: p.id, skill_id: msg.skill_id, hits: res.hits }, conn);
      } else {
        log(`[CAST] ${p.id} ${msg.skill_id} REJECT reason=${res.reason}`);
        conn.send({ type: "cast_result", seq: msg.seq, ok: false, skill_id: msg.skill_id, reason: res.reason, you: youState(p) });
      }
      break;
    }
    case "attack_intent": {
      if (!p) return;
      const res = validateAndResolveAttack(conn.room, p);
      if (res.ok) {
        log(`[ATTACK] ${p.id} ACCEPT hits=${res.hits.length}` +
            res.hits.map(h => ` ${h.target_id}:${h.dmg}->${h.hp}${h.dead ? " DEAD" : ""}`).join(""));
        conn.send({ type: "attack_result", seq: msg.seq, ok: true, hits: res.hits, you: youState(p) });
        broadcast(conn.room, { type: "hit_event", by: p.id, skill_id: null, hits: res.hits }, conn);
      } else {
        log(`[ATTACK] ${p.id} REJECT reason=${res.reason}`);
        conn.send({ type: "attack_result", seq: msg.seq, ok: false, reason: res.reason, you: youState(p) });
      }
      break;
    }
    case "monster_hit": {
      // A monster/boss hit this player (its AI runs client-side in this
      // wave). The server decides the damage from its own data: attacker
      // must be alive, near the player's reported position, and off its
      // own attack cooldown against this player.
      if (!p || p.dead) return;
      const room = conn.room;
      const t = msg.target_id === (room.boss && room.boss.id) ? room.boss : room.monsters.get(msg.target_id);
      if (!t || t.dead) { conn.send({ type: "you_state", you: youState(p), note: "invalid_attacker" }); return; }
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > (t.attackRange || 120) + MONSTER_HIT_LEEWAY) {
        log(`[MHIT] ${p.id} by ${t.id} REJECT out_of_range d=${Math.round(d)}`);
        conn.send({ type: "you_state", you: youState(p), note: "attacker_out_of_range" });
        return;
      }
      const now = Date.now();
      const cdMs = ((t.attackCooldown || 1.8) * 0.8) * 1000;
      if (now - (p.lastHitBy[t.id] || 0) < cdMs) {
        conn.send({ type: "you_state", you: youState(p), note: "attacker_on_cooldown" });
        return;
      }
      p.lastHitBy[t.id] = now;
      let base = t.atk;
      if (t.kind === "boss") {
        const ph = t.cfg["phase" + (t.phase || 1)] || {};
        base = ph.swipeDamage ?? ph.dashDamage ?? ph.roarDamage ?? t.cfg.atk ?? 40;
      }
      let dmg = Math.max(5, Math.round(base - p.def));
      if (msg.defending) dmg = Math.max(1, Math.round(dmg * 0.4));
      p.hp -= dmg;
      p.energy = Math.min(100, p.energy + 6); // +6 per hit received (spec §3.5)
      let died = false;
      if (p.hp <= 0) { p.hp = 0; p.dead = true; died = true; }
      log(`[MHIT] ${p.id} by ${t.id} dmg=${dmg} hp->${Math.ceil(p.hp)}${died ? " DIED" : ""}`);
      conn.send({ type: "you_state", you: youState(p), dmgTaken: dmg, by: t.id });
      broadcast(room, { type: "player_state", player: publicPlayer(p) }, conn);
      if (died) broadcast(room, { type: "player_died", playerId: p.id }, null);
      break;
    }
    case "respawn": {
      if (!p) return;
      // THE LAW: respawn restores the PLAYER only. Monster/boss HP and
      // boss phase in the room are not touched here — ever.
      p.dead = false; p.hp = p.maxHp; p.mp = p.maxMp;
      log(`[RESPAWN] ${p.id} hp=${p.hp} (room ${conn.room.map}: monsters/boss untouched)`);
      conn.send({ type: "you_state", you: youState(p), respawned: true });
      broadcast(conn.room, { type: "player_state", player: publicPlayer(p) }, conn);
      break;
    }
  }
}

// ------------------------------------------------------- regen + sync
setInterval(() => {
  for (const room of rooms.values()) {
    for (const p of room.players.values()) {
      if (!p.dead && p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + p.mpRegen * REGEN_TICK_MS / 1000);
    }
  }
}, REGEN_TICK_MS);
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.players.size) continue;
    broadcast(room, { type: "world_sync", world: roomSnapshot(room) }, null);
  }
}, WORLD_SYNC_MS);

// ------------------------------------------------------------ http+ws
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const file = join(ROOT, p);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end("nf"); return; }
  try {
    const data = readFileSync(file);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(500); res.end("err"); }
});
server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return; }
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${wsAccept(key)}\r\n\r\n`);
  new WSConn(socket);
});
server.listen(PORT, () => log(`[BOOT] Tiên Lộ GD3 server on http://127.0.0.1:${PORT} (HTTP+WS), root=${ROOT}`));
