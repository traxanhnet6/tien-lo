// GD3 cheat suite (protocol level): a raw WebSocket client tries to
// cheat the GD3 combat server five ways — forged damage fields, forged
// mana, casting through cooldown, hitting out of range, hitting a dead
// target — and every attempt must be rejected or neutralised. It also
// verifies the monster-HP persistence law at the server: a player dies
// mid-boss-fight, respawns, and the boss's HP + phase are unchanged.
// Results are read from the actual server responses (never exit codes).
import { spawn } from "node:child_process";
import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/hatch/workspace/game-tien-lo-gd3/";
const OUT = join(ROOT, "proof/gd3-verify");
mkdirSync(OUT, { recursive: true });
const PORT = 19300 + (process.pid % 200);
const LOGF = join(OUT, "gd3-cheat-test.log");
writeFileSync(LOGF, "");
let failures = 0;
function log(...a) { const s = a.join(" "); console.log(s); appendFileSync(LOGF, s + "\n"); }
function check(name, cond, extra = "") { log(cond ? "PASS" : "FAIL", name, extra); if (!cond) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- server under test (own instance, own port, log captured)
const serverLogF = join(OUT, "gd3-cheat-server.log");
writeFileSync(serverLogF, "");
const server = spawn("node", [join(ROOT, "server/server.mjs")],
  { env: { ...process.env, TL_PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", d => appendFileSync(serverLogF, d));
server.stderr.on("data", d => appendFileSync(serverLogF, d));
process.on("exit", () => { try { server.kill("SIGKILL"); } catch {} });
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch {}
  await sleep(250);
}
log("server up on", PORT);

class Client {
  constructor() { this.waiters = []; this.msgs = []; }
  async connect() {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/`);
    await new Promise((res, rej) => {
      this.ws.addEventListener("open", res, { once: true });
      this.ws.addEventListener("error", rej, { once: true });
    });
    this.ws.addEventListener("message", ev => {
      const m = JSON.parse(ev.data);
      this.msgs.push(m);
      this.waiters = this.waiters.filter(w => !w(m));
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  waitFor(pred, timeoutMs = 6000) {
    // Only messages received from NOW on count: send() and waitFor()
    // run back-to-back with no await between, so no response can be
    // missed, and stale replies from earlier rounds never match.
    const from = this.msgs.length;
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error("waitFor timeout")), timeoutMs);
      this.waiters.push(m => {
        if (this.msgs.indexOf(m) >= from && pred(m)) { clearTimeout(to); res(m); return true; }
        return false;
      });
    });
  }
  async hello(map, x, y, stats, name) {
    this.send({ type: "hello", map, x, y, name, stats });
    const w = await this.waitFor(m => m.type === "welcome");
    this.id = w.playerId;
    return w;
  }
  async cast(seq, skill_id, extra = {}) {
    this.send({ type: "cast_intent", seq, skill_id, ...extra });
    return this.waitFor(m => m.type === "cast_result" && m.seq === seq);
  }
  async attack(seq, extra = {}) {
    this.send({ type: "attack_intent", seq, ...extra });
    return this.waitFor(m => m.type === "attack_result" && m.seq === seq);
  }
  close() { try { this.ws.close(); } catch {} }
}
const STATS = { atk: 32, def: 6, maxHp: 220, hp: 220, maxMp: 60, mp: 60, mpRegen: 3.5, energy: 0 };

// ---------- 1. legitimate cast + forged damage fields ----------------
const A = new Client(); await A.connect();
const wA = await A.hello("island", 520, 1560, STATS, "CheatA");
const ty1 = wA.world.monsters.find(m => m.id === "mon_trucyeu_1");
check("welcome world has mon_trucyeu_1 at full HP", !!ty1 && ty1.hp === 85, `hp=${ty1 && ty1.hp}`);

const r1 = await A.cast(1, "sk_kimcang_quyen", { target_id: "mon_trucyeu_1" });
const h1 = r1.hits && r1.hits[0];
check("legit cast accepted", r1.ok === true);
check("legit damage inside server band 60..78", !!h1 && h1.dmg >= 60 && h1.dmg <= 78, `dmg=${h1 && h1.dmg}`);
check("monster HP consistent (85 - dmg)", !!h1 && h1.hp === 85 - h1.dmg, `hp=${h1 && h1.hp}`);
check("mana deducted by server (60-18=42)", r1.you.mp === 42, `mp=${r1.you.mp}`);

const hpBefore = h1.hp;
const r2 = await A.attack(2, { damage: 99999, dmg: 99999, rawAtk: 99999, hp: 0 });
const h2 = r2.hits && r2.hits[0];
check("CHEAT forged damage fields: attack still accepted as normal swing", r2.ok === true);
check("CHEAT forged damage fields: damage stays in basic band 26..34 (forgery ignored)",
  !!h2 && h2.dmg >= 26 && h2.dmg <= 34, `dmg=${h2 && h2.dmg}`);
check("CHEAT forged damage fields: HP drops by server damage only", !!h2 && h2.hp === Math.max(0, hpBefore - h2.dmg), `hp=${h2 && h2.hp}`);

// ---------- 2. forged mana -------------------------------------------
const F = new Client(); await F.connect();
await F.hello("island", 820, 1980, { ...STATS, mp: 0 }, "CheatF");
const f1 = await F.cast(1, "sk_kimcang_quyen", { target_id: "mon_trucyeu_2" });
check("low-mana cast rejected (reason=mana)", f1.ok === false && f1.reason === "mana", `reason=${f1.reason}`);
const f2 = await F.cast(2, "sk_kimcang_quyen", { target_id: "mon_trucyeu_2", mp: 99999, mana: 99999, energy: 100 });
check("CHEAT forged mana fields: still rejected (reason=mana)", f2.ok === false && f2.reason === "mana", `reason=${f2.reason}`);
F.close();

// ---------- 3. casting through cooldown -------------------------------
const B = new Client(); await B.connect();
await B.hello("island", 420, 2260, STATS, "CheatB");
const b1 = await B.cast(1, "sk_kimcang_quyen", { target_id: "mon_trucyeu_3" });
check("first cast accepted (cooldown baseline)", b1.ok === true);
const b2 = await B.cast(2, "sk_kimcang_quyen", { target_id: "mon_trucyeu_3" });
check("CHEAT recast during cooldown: rejected (reason=cooldown)", b2.ok === false && b2.reason === "cooldown", `reason=${b2.reason}`);
const b3 = await B.cast(3, "sk_kimcang_quyen", { target_id: "mon_trucyeu_3", cooldown: 0, cdReadyAt: 0 });
check("CHEAT forged cooldown fields: still rejected (reason=cooldown)", b3.ok === false && b3.reason === "cooldown", `reason=${b3.reason}`);
B.close();

// ---------- 4. out of range -------------------------------------------
const C = new Client(); await C.connect();
await C.hello("island", 100, 100, STATS, "CheatC");
const c1 = await C.cast(1, "sk_kimcang_quyen", { target_id: "mon_trucyeu_2" });
check("CHEAT cast from ~2000px away at a live target: rejected (reason=out_of_range)", c1.ok === false && c1.reason === "out_of_range", `reason=${c1.reason}`);
C.close();

// ---------- 5. dead target --------------------------------------------
// mon_trucyeu_3 is at 15 HP after client B's accepted cast above; a
// fresh client finishes it with validated basic attacks, then tries
// to cast at the corpse.
const G = new Client(); await G.connect();
await G.hello("island", 420, 2260, STATS, "CheatG");
let dead = false, seq = 10;
for (let i = 0; i < 10 && !dead; i++) {
  const r = await G.attack(seq++);
  const h = r.hits && r.hits.find(x => x.target_id === "mon_trucyeu_3");
  if (h && h.dead) dead = true;
  await sleep(700);
}
check("mon_trucyeu_3 killed by validated basic attacks", dead);
const d1 = await G.cast(99, "sk_kimcang_quyen", { target_id: "mon_trucyeu_3" });
check("CHEAT cast at dead target: rejected (reason=invalid_target)", d1.ok === false && d1.reason === "invalid_target", `reason=${d1.reason}`);
G.close(); A.close();

// ---------- 6. boss HP/phase persistence across a player death --------
const D = new Client(); await D.connect();
const wD = await D.hello("hauson", 1120, 440, { ...STATS, atk: 200 }, "CheatD");
check("boss present in hauson room", !!wD.world.boss && wD.world.boss.hp === 1200 && wD.world.boss.phase === 1,
  `hp=${wD.world.boss && wD.world.boss.hp} phase=${wD.world.boss && wD.world.boss.phase}`);
let bossHp = 1200, bossPhase = 1;
for (let i = 0; i < 12 && bossPhase < 3; i++) {
  const r = await D.attack(50 + i);
  const h = r.hits && r.hits.find(x => x.kind === "boss");
  if (h) { bossHp = h.hp; bossPhase = h.phase; }
  await sleep(700);
}
check("boss driven to phase 3 by validated hits", bossPhase === 3 && bossHp > 0 && bossHp <= 396,
  `hp=${bossHp} phase=${bossPhase}`);
// The boss now kills D (server decides damage from boss phase data).
let died = false;
for (let i = 0; i < 14 && !died; i++) {
  D.send({ type: "monster_hit", target_id: "boss_bachho", defending: false });
  const ys = await D.waitFor(m => m.type === "you_state");
  if (ys.you.dead) died = true;
  await sleep(1500); // respect the server's per-attacker hit cooldown
}
check("player died to server-computed boss hits", died);
D.send({ type: "respawn" });
const rs = await D.waitFor(m => m.type === "you_state" && m.respawned);
check("respawn restores the player (hp full, not dead)", rs.you.hp === 220 && rs.you.dead === false, `hp=${rs.you.hp}`);
const E = new Client(); await E.connect();
const wE = await E.hello("hauson", 1120, 700, STATS, "CheatE");
check("LAW: boss HP unchanged across death+respawn", wE.world.boss.hp === bossHp, `hp=${wE.world.boss.hp} expected=${bossHp}`);
check("LAW: boss phase unchanged across death+respawn", wE.world.boss.phase === bossPhase, `phase=${wE.world.boss.phase} expected=${bossPhase}`);
check("LAW: boss not dead / not reset", wE.world.boss.dead === false);
D.close(); E.close();

log(failures === 0 ? "ALL CHEAT CHECKS PASS" : `${failures} CHECK(S) FAILED`);
server.kill("SIGKILL");
process.exit(failures === 0 ? 0 : 1);
