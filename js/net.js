"use strict";
/* Tiên Lộ — GD3 online client layer (spec §8.2 / §9 GĐ3).
 *
 * Activated ONLY when the page URL carries ?online (optionally
 * ?online=ws://host:port and ?pname=<display name>). Without the
 * parameter this module stays completely inert and the game is the
 * exact local build of the HUD2 wave.
 *
 * When active it connects to the GD3 combat server (server/server.mjs),
 * which is authoritative for combat: this client sends cast/attack
 * INTENTS in the §8.1 schema shape and applies the RESULTS the server
 * returns through the Gameplay.net* hooks. Player positions are
 * reported at ~8Hz so other clients in the same map can render this
 * player; remote players are handed to Gameplay for rendering.
 *
 * Team choices for this wave (see docs/gd3-report.md): activation via
 * URL parameter; default server = same host/port that served the page;
 * display name = ?pname or "Hà Nhân-<random 3 digits>" (no accounts
 * yet); if the socket drops, Gameplay falls back to local combat.
 */
window.TLNET = (function () {
  const params = new URLSearchParams(location.search);
  const enabledFlag = params.has("online");
  const urlParam = params.get("online");
  const wsUrl = (urlParam && urlParam.indexOf("ws") === 0) ? urlParam
    : (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
  const displayName = params.get("pname") ||
    "Hà Nhân-" + Math.floor(100 + Math.random() * 900);

  let ws = null;
  let connectedFlag = false;
  let myId = null;
  let currentMap = null;
  let lastYou = null;
  let lastSentPos = { x: 0, y: 0 };
  const remotes = new Map(); // playerId -> public player record
  const eventLog = [];

  function note(kind, data) {
    eventLog.push({ t: Date.now(), kind, data });
    if (eventLog.length > 120) eventLog.shift();
  }
  function gp() { return window.Gameplay; }
  function pushRemotes() {
    if (gp() && gp().netSetRemotePlayers) gp().netSetRemotePlayers([...remotes.values()]);
  }
  function send(obj) {
    if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; }
    return false;
  }

  function helloStats() {
    const ic = gp().inspectCombat();
    let mpRegen = 3.5;
    try {
      const lvl = (window.GAME_DATA.levels || [])[(ic.playerLevel || 1) - 1];
      if (lvl && typeof lvl.mpRegen === "number") mpRegen = lvl.mpRegen;
    } catch { /* default above */ }
    return {
      name: displayName,
      x: ic.px, y: ic.py,
      stats: {
        atk: ic.playerAtk, def: ic.playerDef,
        maxHp: ic.playerMaxHp, hp: ic.playerHp,
        maxMp: ic.playerMaxMp, mp: ic.playerMp,
        mpRegen, energy: ic.energy,
      },
    };
  }

  function handle(msg) {
    note(msg.type, msg);
    switch (msg.type) {
      case "welcome": {
        myId = msg.playerId;
        lastYou = msg.you;
        if (gp().netSetOnline) gp().netSetOnline(true);
        if (gp().netApplyYouState) gp().netApplyYouState(msg.you, {});
        if (gp().netApplyWorld) gp().netApplyWorld(msg.world);
        remotes.clear();
        for (const p of msg.world.players || []) if (p.id !== myId) remotes.set(p.id, p);
        pushRemotes();
        break;
      }
      case "map_state": {
        if (gp().netApplyWorld) gp().netApplyWorld(msg.world);
        remotes.clear();
        for (const p of msg.world.players || []) if (p.id !== myId) remotes.set(p.id, p);
        pushRemotes();
        break;
      }
      case "world_sync": {
        if (gp().netApplyWorld) gp().netApplyWorld(msg.world);
        for (const p of msg.world.players || []) {
          if (p.id === myId) continue;
          remotes.set(p.id, p);
        }
        pushRemotes();
        break;
      }
      case "player_joined": remotes.set(msg.player.id, msg.player); pushRemotes(); break;
      case "player_moved": case "player_state": {
        const prev = remotes.get(msg.player.id) || {};
        remotes.set(msg.player.id, { ...prev, ...msg.player });
        pushRemotes();
        break;
      }
      case "player_died": {
        const prev = remotes.get(msg.playerId);
        if (prev) { prev.dead = true; pushRemotes(); }
        break;
      }
      case "player_left": remotes.delete(msg.playerId); pushRemotes(); break;
      case "cast_result": case "attack_result":
        if (gp().netApplyCastResult) gp().netApplyCastResult(msg);
        if (msg.you) lastYou = msg.you;
        break;
      case "hit_event":
        if (gp().netApplyHitEvent) gp().netApplyHitEvent(msg);
        break;
      case "you_state":
        lastYou = msg.you;
        if (gp().netApplyYouState) gp().netApplyYouState(msg.you, msg);
        break;
    }
  }

  function connect() {
    if (!enabledFlag || ws) return;
    let sock;
    try { sock = new WebSocket(wsUrl); } catch { return; }
    ws = sock;
    ws.onopen = () => {
      connectedFlag = true;
      const st = window.TL2 && TL2.state ? TL2.state() : {};
      currentMap = st.map || "island";
      const h = helloStats();
      send({ type: "hello", map: currentMap, name: h.name, x: h.x, y: h.y, stats: h.stats });
      note("hello_sent", { map: currentMap, name: h.name });
    };
    ws.onmessage = ev => { try { handle(JSON.parse(ev.data)); } catch { /* bad frame */ } };
    ws.onclose = () => {
      connectedFlag = false; ws = null;
      if (gp() && gp().netSetOnline) gp().netSetOnline(false);
      note("socket_closed", {});
    };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  }

  // Boot once the game is ready; report position / map at ~8Hz.
  if (enabledFlag) {
    const bootTimer = setInterval(() => {
      if (window.Gameplay && Gameplay.isReady() && window.TL2) {
        clearInterval(bootTimer);
        connect();
      }
    }, 300);
    setInterval(() => {
      if (!connectedFlag || !window.TL2 || !TL2.state) return;
      const st = TL2.state();
      if (st.map && currentMap && st.map !== currentMap) {
        currentMap = st.map;
        send({ type: "enter_map", map: st.map, x: Math.round(st.x), y: Math.round(st.y) });
        return;
      }
      if (Math.hypot(st.x - lastSentPos.x, st.y - lastSentPos.y) > 3) {
        lastSentPos = { x: st.x, y: st.y };
        send({ type: "pos", x: Math.round(st.x), y: Math.round(st.y) });
      }
    }, 120);
  }

  return {
    enabled: () => enabledFlag,
    connected: () => connectedFlag,
    playerId: () => myId,
    sendCastIntent: o => send({ type: "cast_intent", ...o }),
    sendAttackIntent: seq => send({ type: "attack_intent", seq }),
    reportMonsterHit: (targetId, defending) => {
      if (!targetId) return false;
      return send({ type: "monster_hit", target_id: targetId, defending: !!defending });
    },
    sendRespawn: () => send({ type: "respawn" }),
    // Diagnostics for the GD3 harness (read-only).
    state: () => ({
      enabled: enabledFlag, connected: connectedFlag, playerId: myId,
      map: currentMap, name: displayName,
      remotes: [...remotes.values()],
      lastYou,
      eventLog: eventLog.slice(-30),
    }),
  };
})();
