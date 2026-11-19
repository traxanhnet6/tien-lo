"use strict";
/* Tiên Lộ — Gameplay & Vertical Slice Combat System (§3.1 - §3.4).
   Implements:
   - Quest State Machine (Q1 -> Q8) with Map_Quests.json as sole anchor source.
   - Guidance indicator (in-world beacon, floating "!", off-screen edge pointers, cross-map portal direction).
   - Player combat (HP, sword attack, damage numbers, red hit flash, death & fair respawn).
   - Monster AI (§28): Trúc Yêu, Linh Lang pack behavior, Thạch Vệ, Thạch Vệ Tinh Anh AoE ground smash.
   - Boss Bạch Hổ Sơn Quân (§29 + §G.3): 3 phases, Gầm Chấn Động red circle warning, Lao Bổ Diện Rộng directional warning.
   - Herb gathering channel and inventory.
   - NPC Dialogue UI (Cổ phong ngọc/đồng cổ).
   - LocalStorage persistence and Restart flow.
*/

window.Gameplay = (function () {
  const SAVE_KEY = "tl3_save_v1";

  // Runtime State
  const G = {
    initialized: false,
    questData: null,
    questIndex: 0,        // 0 to 7 for Q1 to Q8
    questState: "not_accepted", // "not_accepted" | "active" | "ready_to_turn_in" | "completed"
    questProgress: 0,    // count of kills, herbs, etc.
    herbsCount: 0,
    activeTarget: null,   // computed target for guidance

    // Player stats
    player: {
      maxHp: 220,
      hp: 220,
      atk: 32,
      def: 6,
      atkRange: 105,
      atkCooldown: 0.60,
      lastAtkTime: 0,
      isAttacking: false,
      atkAnimT: 0,
      hitFlashT: 0,
      isDead: false,
      deathT: 0,
      xp: 0,
      level: 1,
      // MP + ULT energy (HUD wave 2026-11-09, spec §4.1/§3.5): maxMp and
      // mpRegen derive from GAME_DATA.levels like every other stat
      // (PROVISIONAL values, see game_data.js note). Energy is the ULT
      // gauge 0..100, gained by dealing and by receiving damage.
      mp: 60,
      maxMp: 60,
      mpRegen: 3.5,
      energy: 0,
    },
    inventory: [],

    // Dialogue modal
    dialogue: {
      open: false,
      speaker: "",
      role: "",
      text: "",
      lines: [],
      lineIdx: 0,
      btnLabel: "Tiếp tục",
      onComplete: null,
      sourceObjId: null,
    },

    // Gathering
    gathering: {
      active: false,
      nodeId: null,
      t: 0,
      duration: 1.2,
    },
    // Q5 cave-mouth dialogue latch: armed on zone entry, disarmed once the
    // dialogue opens, re-armed only after the player leaves the mouth area.
    caveMouthArmed: true,
    gatheredNodes: new Set(),

    // Monsters & Boss instances
    monsters: new Map(),
    boss: null,
    bossEngaged: false,
    bossIntroT: 0,

    // Visual effects & floating text
    floatingTexts: [],
    groundVfx: [],
    sparks: [],
    attackSlashes: [],

    // Announcements
    banner: { text: "", sub: "", t: 0, duration: 3.0 },

    // Pending auto-interactions
    pendingInteract: null, // { objId, standPx, callback }

    // Combat HUD runtime (HUD wave 2026-11-09, spec §3): skill casting
    // state machine, hold-aim, selected target, dodge/defend.
    casting: null,      // { def, t, angle, row, target, center, hitApplied }
    // GD3 online layer (spec §9 GĐ3): when G.online is true the GD3
    // server owns combat results; local damage functions are bypassed
    // and server results are applied instead. Local mode is untouched.
    online: false,
    onlineSeq: 0,
    onlineResults: new Map(), // intent seq -> server result awaiting hit phase
    remotePlayers: new Map(), // playerId -> { name, x, y, hp, maxHp, dead }
    aim: null,          // { def, angle, point:{x,y} } while hold-aiming
    target: null,       // { kind: "monster", m } | { kind: "boss" }
    dodge: null,        // { t, dur, dx, dy } active dodge dash
    dodgeReadyAt: 0,    // S.t when the dodge cooldown ends
    defending: false,
    pendingSkill: null, // { def, target, t } walk-into-range cast request
    skillRt: {},        // skill_id -> { cdReadyAt }
    skillSlots: null,   // [SK1..SK4, ULT] skill_ids (HUD2 wave, spec §6.3);
                        // null until DEFAULT_SKILL_SLOTS is defined below
    skillPanelOpen: false,
    castBursts: [],     // image burst FX at a cast's hit moment
    moveKeys: new Set(), // held WASD/arrow key codes (PC movement)
    keyPress: null,      // { def, aiming, timer } held skill key (hold-aim)
    mouseClient: null,   // last mouse position, for key hold-aim
    joyActive: false,    // joystick currently engaged (owns manual input)
    loadedMp: false,     // save carried an MP value (pre-HUD saves have none)
  };

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------
  function saveState() {
    try {
      const data = {
        questIndex: G.questIndex,
        questState: G.questState,
        questProgress: G.questProgress,
        herbsCount: G.herbsCount,
        playerHp: G.player.hp,
        playerMp: G.player.mp,
        playerEnergy: G.player.energy,
        playerXp: G.player.xp,
        inventory: G.inventory,
        gatheredNodes: Array.from(G.gatheredNodes),
        skillSlots: G.skillSlots ? [...G.skillSlots] : null,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Save failed:", e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (typeof data.questIndex === "number") G.questIndex = data.questIndex;
      if (data.questState) G.questState = data.questState;
      if (typeof data.questProgress === "number") G.questProgress = data.questProgress;
      if (typeof data.herbsCount === "number") G.herbsCount = data.herbsCount;
      if (typeof data.playerHp === "number") G.player.hp = Math.max(1, data.playerHp);
      if (typeof data.playerMp === "number") { G.player.mp = Math.max(0, data.playerMp); G.loadedMp = true; }
      if (typeof data.playerEnergy === "number") G.player.energy = Math.max(0, Math.min(100, data.playerEnergy));
      if (typeof data.playerXp === "number") G.player.xp = data.playerXp;
      if (Array.isArray(data.inventory)) G.inventory = data.inventory;
      if (Array.isArray(data.gatheredNodes)) G.gatheredNodes = new Set(data.gatheredNodes);
      if (Array.isArray(data.skillSlots)) G.pendingSkillSlots = data.skillSlots;
      return true;
    } catch (e) {
      console.warn("Load failed:", e);
      return false;
    }
  }

  function resetGame() {
    localStorage.removeItem(SAVE_KEY);
    sessionStorage.removeItem("tl3_spawn");
    location.href = "index.html";
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------
  async function init() {
    // Load Map_Quests.json
    try {
      G.questData = await (await fetch("data/Map_Quests.json")).json();
    } catch (e) {
      console.error("Failed to load Map_Quests.json", e);
      return;
    }

    // Load boss and monster sheet images if not already cached
    await Promise.all([
      loadImage("assets/boss/boss_bachho_sheet_v1.png").catch(() => null),
      loadImage("assets/boss/boss_xichviem_sheet_v1.png").then(im => { S.sprites.boss_xichviem_sheet_v1 = im; return im; }).catch(() => null),
      loadImage("assets/monsters/monster_linhlang_full_sheet_v1.png").catch(() => null),
    ]);

    loadState();
    if (G.pendingSkillSlots) { applySavedSkillSlots(G.pendingSkillSlots); G.pendingSkillSlots = null; }
    // Stats derive from the loaded XP (rewards wave): a mid-chain save
    // reloads with exactly the level/stats its XP buys; HP clamps to the
    // derived max.
    recomputePlayerStats(false);
    // A save from before the HUD wave carries no MP: start at full.
    if (!G.loadedMp) G.player.mp = G.player.maxMp;
    initMonsters();
    initBoss();
    buildHUD();
    loadSkillPacks(); // async, non-blocking: cast frames fade in when ready
    updateGuidanceTarget();
    G.initialized = true;
  }

  // --------------------------------------------------------------------------
  // Monster & Boss Initialization
  // --------------------------------------------------------------------------
  function initMonsters() {
    G.monsters.clear();
    for (const o of S.actors) {
      if (o.actor.type !== "monster") continue;
      const id = o.id;
      let cfgKey = "trucyeu";
      if (id.includes("linhlang")) cfgKey = "linhlang";
      else if (id.includes("thachve_elite")) cfgKey = "thachve_elite";
      else if (id.includes("thachve")) cfgKey = "thachve";
      else if (id.includes("hoatinh")) cfgKey = "hoatinh";
      else if (id.includes("hoanhamlang")) cfgKey = "hoanhamlang";
      else if (id.includes("xichviem_elite")) cfgKey = "xichviem_elite";
      else if (id.includes("viemnham")) cfgKey = "viemnham";

      const cfg = GAME_DATA.monsters[cfgKey];
      const m = {
        id,
        cfgKey,
        cfg,
        name: o.actor.label,
        obj: o,
        homeX: o.anchor[0],
        homeY: o.anchor[1],
        x: o.anchor[0],
        y: o.anchor[1],
        hp: cfg.maxHp,
        maxHp: cfg.maxHp,
        state: "IDLE", // IDLE, CHASE, TELEGRAPH, ATTACK, HIT, DEATH
        stateT: 0,
        telegraphT: 0,
        telegraphDur: cfg.telegraphDuration,
        cooldownT: Math.random() * 0.5,
        targetPos: null,
        skillT: cfg.skillCooldown || 0,
        isUsingSkill: false,
        hitFlashT: 0,
        animFrame: 0,
        deathT: 0,
        isDead: false,
        path: [],
      };
      G.monsters.set(id, m);
    }
  }

  function initBoss() {
    const bossObj = S.actors.find(o => o.actor?.type === "boss");
    if (!bossObj) {
      G.boss = null;
      return;
    }
    const isXichViem = bossObj.id === "boss_xichviem";
    const cfg = isXichViem ? GAME_DATA.boss_xichviem : GAME_DATA.boss;
    G.boss = {
      id: bossObj.id,
      obj: bossObj,
      cfg,
      name: cfg.name,
      homeX: bossObj.anchor[0],
      homeY: bossObj.anchor[1],
      x: bossObj.anchor[0],
      y: bossObj.anchor[1],
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
      phase: 1, // 1: 100-66%, 2: 66-33%, 3: 33-0%
      state: "IDLE", // IDLE, MOVE, TELEGRAPH_SWIPE, ATTACK_SWIPE, TELEGRAPH_ROAR, ATTACK_ROAR, TELEGRAPH_DASH, ATTACK_DASH, HIT, PHASE_TRANSITION, DEATH
      stateT: 0,
      phaseTransT: 0,
      cooldownT: 1.0,
      roarCooldownT: 5.0,
      dashCooldownT: 6.0,
      hitFlashT: 0,
      animFrame: 0,
      isDead: false,
      deathT: 0,
      dashStart: null,
      dashEnd: null,
      dashProgress: 0,
      warningCircle: null, // { x, y, r, dur, maxDur }
      warningLine: null,   // { x0, y0, x1, y1, width, dur, maxDur }
    };
  }

  // --------------------------------------------------------------------------
  // Quest Engine (§3.1)
  // --------------------------------------------------------------------------
  function currentQuest() {
    if (!G.questData) return null;
    return G.questData.quests[G.questIndex] || null;
  }

  function updateGuidanceTarget() {
    const q = currentQuest();
    if (!q) {
      G.activeTarget = null;
      return;
    }

    if (G.questState === "not_accepted") {
      // Points to giver
      G.activeTarget = {
        name: q.giver.object,
        map: q.giver.map,
        zone: q.giver.zone,
        anchor_px: q.giver.anchor_px,
        stand_px: q.giver.stand_px,
        label: "Người giao: " + (q.giver.object === "npc_tiendong" ? "Tiên Đồng" :
                                q.giver.object === "npc_chapsu" ? "Chấp Sự" :
                                q.giver.object === "npc_truonglao" ? "Trưởng Lão Võ" :
                                q.giver.object === "npc_dansu" ? "Đan Dược Sư" :
                                q.giver.object === "npc_thuve" ? "Thủ Vệ" :
                                q.giver.object === "npc_xichviem_tientri" ? "Thủ Hộ Giả" :
                                q.giver.object === "dais_qt" ? "Đài Truyền Tống" : "Chưởng Môn"),
        type: "giver",
      };
    } else if (G.questState === "active") {
      if (q.id === "q1_tan_nhan_nhap_mon") {
        const t = q.targets[0];
        G.activeTarget = { ...t, label: "Gặp Chấp Sự Thanh Vân", type: "talk" };
      } else if (q.id === "q2_buoc_chan_tu_tien") {
        const t = q.targets[0];
        G.activeTarget = { ...t, label: "Kích hoạt Đài Truyền Tống", type: "interact" };
      } else if (q.id === "q3_luyen_kiem_nhap_mon") {
        // Find first alive trucyeu
        let targetMon = null;
        for (const t of q.targets) {
          const m = G.monsters.get(t.object);
          if (m && !m.isDead) { targetMon = t; break; }
        }
        if (!targetMon) targetMon = q.targets[0];
        G.activeTarget = { ...targetMon, label: `Trúc Yêu (${G.questProgress}/5)`, type: "kill" };
      } else if (q.id === "q4_thu_thap_linh_thao") {
        // Find first uncollected herb
        let targetHerb = null;
        for (const t of q.targets) {
          if (!G.gatheredNodes.has(t.object)) { targetHerb = t; break; }
        }
        if (!targetHerb) targetHerb = q.targets[0];
        G.activeTarget = { ...targetHerb, label: `Linh Thảo (${G.herbsCount}/5)`, type: "gather" };
      } else if (q.id === "q5_truy_tim_dau_vet") {
        if (G.questProgress === 0) {
          G.activeTarget = { ...q.targets[0], label: "Thủ Vệ Vân Ẩn Động", type: "talk" };
        } else {
          G.activeTarget = { ...q.targets[1], anchor_px: q.targets[1].point, label: "Miệng Vân Ẩn Động", type: "explore" };
        }
      } else if (q.id === "q6_thach_ve_thuc_tinh") {
        G.activeTarget = { ...q.targets[0], label: "Thạch Vệ Tinh Anh", type: "kill_elite" };
      } else if (q.id === "q7_bach_ho_xuat_the") {
        G.activeTarget = { ...q.targets[0], label: "Bạch Hổ Sơn Quân (Hậu Sơn)", type: "boss" };
      } else if (q.id === "q8_xuat_mon_lich_luyen") {
        G.activeTarget = { ...q.targets[0], label: "Đài Truyền Tống — Xuất Môn", type: "depart" };
      } else if (q.id === "q9_pha_an_nhap_coc") {
        G.activeTarget = { ...q.targets[0], label: "Gặp Thủ Hộ Giả Xích Viêm", type: "talk" };
      } else if (q.id === "q10_tru_diet_hoa_tinh") {
        let targetMon = null;
        for (const t of q.targets) {
          const m = G.monsters.get(t.object);
          if (m && !m.isDead) { targetMon = t; break; }
        }
        if (!targetMon) targetMon = q.targets[0];
        G.activeTarget = { ...targetMon, label: `Hỏa Tinh Thử (${G.questProgress}/5)`, type: "kill" };
      } else if (q.id === "q11_thu_thap_viem_tinh") {
        let targetNode = null;
        for (const t of q.targets) {
          if (!G.gatheredNodes.has(t.object)) { targetNode = t; break; }
        }
        if (!targetNode) targetNode = q.targets[0];
        G.activeTarget = { ...targetNode, label: `Viêm Tinh Thạch (${G.questProgress}/5)`, type: "gather" };
      } else if (q.id === "q12_viem_tinh_thuc_tinh") {
        G.activeTarget = { ...q.targets[0], label: "Xích Viêm Tinh Anh", type: "kill_elite" };
      } else if (q.id === "q13_ma_quan_giang_the") {
        G.activeTarget = { ...q.targets[0], label: "Xích Viêm Ma Quân (Boss 002)", type: "boss" };
      }
    } else if (G.questState === "ready_to_turn_in") {
      // Points to giver to turn in
      G.activeTarget = {
        name: q.giver.object,
        map: q.giver.map,
        zone: q.giver.zone,
        anchor_px: q.giver.anchor_px,
        stand_px: q.giver.stand_px,
        label: "Trả nhiệm vụ: " + q.name,
        type: "turn_in",
      };
    } else if (G.questState === "completed") {
      G.activeTarget = null;
    }

    // Cross-map translation: if target is on another map, point to the appropriate portal!
    if (G.activeTarget && G.activeTarget.map !== S.map) {
      if (S.map === "island" && G.activeTarget.map === "hauson") {
        // Point to portal_to_hauson (dais_portal_hs) at [1560, 890]
        G.activeTarget = {
          object: "dais_portal_hs",
          map: "island",
          zone: "quang_truong",
          anchor_px: [1560, 890],
          stand_px: [1560, 930],
          label: "Cổng vào Hậu Sơn (Tới mục tiêu)",
          type: "portal",
          realTarget: G.activeTarget,
        };
      } else if (S.map === "hauson" && G.activeTarget.map === "island") {
        // Point to dais_portal_back at [1120, 820]
        G.activeTarget = {
          object: "dais_portal_back",
          map: "hauson",
          zone: "hauson",
          anchor_px: [1120, 820],
          stand_px: [1120, 800],
          label: "Cổng về Thanh Vân (Tới mục tiêu)",
          type: "portal",
          realTarget: G.activeTarget,
        };
      } else if (S.map === "island" && G.activeTarget.map === "xichviem") {
        // Point to dais_qt at [2820, 1572]
        G.activeTarget = {
          object: "dais_qt",
          map: "island",
          zone: "quang_truong",
          anchor_px: [2820, 1572],
          stand_px: [2820, 1700],
          label: "Đài Truyền Tống → Xích Viêm Cốc (Tới mục tiêu)",
          type: "portal",
          realTarget: G.activeTarget,
        };
      } else if (S.map === "xichviem" && G.activeTarget.map === "island") {
        // Point to dais_portal_xv at [1120, 1015]
        G.activeTarget = {
          object: "dais_portal_xv",
          map: "xichviem",
          zone: "xich_viem_ngoai",
          anchor_px: [1120, 1015],
          stand_px: [1120, 880],
          label: "Cổng về Thanh Vân (Tới mục tiêu)",
          type: "portal",
          realTarget: G.activeTarget,
        };
      }
    }

    updateHUDQuestTracker();
  }

  // Level derivation (added 2026-11-09, rewards wave): combat stats are a
  // pure function of total XP via GAME_DATA.levels, so they persist with
  // the saved XP and need no extra save fields. Level 1 == shipped base
  // stats, so a pre-rewards save is unaffected.
  function levelRowForXp(xp) {
    const rows = (typeof GAME_DATA !== "undefined" && GAME_DATA.levels) || [];
    let idx = 0;
    for (let i = 0; i < rows.length; i++) {
      if (xp >= rows[i].xpNeed) idx = i;
    }
    return { level: idx + 1, row: rows[idx] || null };
  }

  // Display name of the player's cultivation realm (Bui's order
  // 2026-11-10: "Chuyển cấp độ thành cấp tu tiên"). The numeric level
  // still exists internally for logic/server use; it is never shown
  // to the player as "Cấp X" any more. The levels table's title field
  // carries the realm name; this list is the fallback when a row or
  // its title is missing, so the fallback also yields a realm name.
  const REALM_NAMES = [
    "Luyện Khí tầng 1", "Luyện Khí tầng 2", "Luyện Khí tầng 3",
    "Luyện Khí tầng 4", "Luyện Khí tầng 5", "Luyện Khí tầng 6",
    "Luyện Khí tầng 7", "Luyện Khí tầng 8", "Luyện Khí tầng 9",
    "Trúc Cơ Sơ Kỳ", "Trúc Cơ Trung Kỳ", "Trúc Cơ Hậu Kỳ",
    "Trúc Cơ Viên Mãn",
  ];
  function realmNameForLevel(level, row) {
    if (row && row.title) return row.title;
    const lv = Math.max(1, Math.min(REALM_NAMES.length, level || 1));
    return REALM_NAMES[lv - 1];
  }

  // Recompute maxHp/atk/def/level from G.player.xp. On a level-up the HP
  // gain is granted as healing equal to the maxHp delta (never above the
  // new max), so growth is felt immediately without a free full heal.
  function recomputePlayerStats(healByDelta) {
    const { level, row } = levelRowForXp(G.player.xp);
    const leveledUp = level > (G.player.level || 1);
    G.player.level = level;
    if (row) {
      const oldMax = G.player.maxHp;
      const oldMaxMp = G.player.maxMp;
      G.player.maxHp = row.maxHp;
      G.player.atk = row.atk;
      G.player.def = row.def;
      // MP extends the same pure-function-of-level model (HUD wave).
      if (typeof row.maxMp === "number") G.player.maxMp = row.maxMp;
      if (typeof row.mpRegen === "number") G.player.mpRegen = row.mpRegen;
      if (healByDelta && leveledUp && !G.player.isDead) {
        if (G.player.maxHp > oldMax) {
          G.player.hp = Math.min(G.player.maxHp, G.player.hp + (G.player.maxHp - oldMax));
        }
        if (G.player.maxMp > oldMaxMp) {
          G.player.mp = Math.min(G.player.maxMp, G.player.mp + (G.player.maxMp - oldMaxMp));
        }
      }
    }
    if (G.player.hp > G.player.maxMp) G.player.hp = G.player.maxHp;
    if (G.player.mp > G.player.maxMp) G.player.mp = G.player.maxMp;
    return leveledUp;
  }

  // Quest rewards are DATA-DRIVEN: a turn-in only grants what the data
  // defines — a `reward` block on the Map_Quests entry and/or
  // GAME_DATA.questRewards[questId], shaped { xp?: number, items?: string[] }.
  // Where the data defines no reward, nothing is granted and the completion
  // banner keeps its generic text (no invented numbers).
  function applyQuestRewards(q) {
    const parts = [];
    const sources = [];
    if (q && q.reward) sources.push(q.reward);
    const table = (typeof GAME_DATA !== "undefined" && GAME_DATA.questRewards) || null;
    if (table && q && table[q.id]) sources.push(table[q.id]);
    for (const r of sources) {
      if (typeof r.xp === "number" && r.xp > 0) {
        G.player.xp += r.xp;
        parts.push(`+${r.xp} EXP`);
      }
      if (Array.isArray(r.items)) {
        for (const it of r.items) {
          G.inventory.push(it);
          parts.push(it);
        }
      }
    }
    // XP only matters if it moves the stats: re-derive level/stats after
    // any grant (no-op when nothing was granted or no threshold crossed).
    if (parts.length && recomputePlayerStats(true)) {
      const { row } = levelRowForXp(G.player.xp);
      parts.push(`Đạt cảnh giới ${realmNameForLevel(G.player.level, row)}`);
    }
    return parts.length ? "Phần thưởng: " + parts.join(" · ") : null;
  }

  function advanceQuest() {
    const q = currentQuest();
    if (!q) return;

    if (G.questState === "not_accepted") {
      G.questState = "active";
      G.questProgress = 0;
      showBanner(`NHẬN NHIỆM VỤ: ${q.name}`, q.objective);
      addFloatingText(P.x, P.y - 70, `Nhận: ${q.name}`, "#ffd75a");
    } else if (G.questState === "ready_to_turn_in") {
      const granted = applyQuestRewards(q);
      showBanner(`HOÀN THÀNH: ${q.name}`, granted || "Nhận thưởng kinh nghiệm & đan dược");
      addFloatingText(P.x, P.y - 70, `Hoàn thành: ${q.name}`, "#7eff8a");
      G.questIndex++;
      if (G.questIndex < G.questData.quests.length) {
        G.questState = "not_accepted";
        G.questProgress = 0;
      } else {
        G.questState = "completed";
      }
    }
    saveState();
    updateGuidanceTarget();
  }

  // --------------------------------------------------------------------------
  // Dialogue Flow
  // --------------------------------------------------------------------------
  function openDialogue(speaker, role, lines, btnLabel, onComplete, sourceObjId) {
    G.dialogue.open = true;
    G.dialogue.speaker = speaker;
    G.dialogue.role = role || "";
    G.dialogue.lines = Array.isArray(lines) ? lines : [lines];
    G.dialogue.lineIdx = 0;
    G.dialogue.text = G.dialogue.lines[0];
    G.dialogue.btnLabel = btnLabel || "Tiếp tục";
    G.dialogue.onComplete = onComplete;
    G.dialogue.sourceObjId = sourceObjId;

    renderDialogueModal();
  }

  function nextDialogue() {
    if (!G.dialogue.open) return;
    G.dialogue.lineIdx++;
    if (G.dialogue.lineIdx < G.dialogue.lines.length) {
      G.dialogue.text = G.dialogue.lines[G.dialogue.lineIdx];
      renderDialogueModal();
    } else {
      closeDialogue();
    }
  }

  function closeDialogue() {
    const cb = G.dialogue.onComplete;
    G.dialogue.open = false;
    renderDialogueModal();
    if (cb) cb();
  }

  function renderDialogueModal() {
    let box = document.getElementById("dialogueBox");
    if (!G.dialogue.open) {
      if (box) box.style.display = "none";
      return;
    }
    if (!box) {
      box = document.createElement("div");
      box.id = "dialogueBox";
      box.className = "dialogue-modal";
      document.body.appendChild(box);
    }
    box.style.display = "flex";
    box.innerHTML = `
      <div class="dialogue-card">
        <div class="dialogue-header">
          <div class="dialogue-badge">ĐỐI THOẠI</div>
          <div class="dialogue-speaker">${G.dialogue.speaker}</div>
          <div class="dialogue-role">${G.dialogue.role}</div>
        </div>
        <div class="dialogue-body">${G.dialogue.text}</div>
        <div class="dialogue-footer">
          <button class="dialogue-btn" id="dialogueAdvanceBtn">${G.dialogue.btnLabel} [F / Enter]</button>
        </div>
      </div>
    `;
    const btn = document.getElementById("dialogueAdvanceBtn");
    if (btn) btn.addEventListener("click", nextDialogue);
  }

  // --------------------------------------------------------------------------
  // Interaction Handler (NPCs, Dais, Herbs)
  // --------------------------------------------------------------------------
  function triggerInteraction(objId) {
    const q = currentQuest();
    if (!q) return;

    // 1. Q1: Tân nhân nhập môn
    if (q.id === "q1_tan_nhan_nhap_mon") {
      if (objId === "npc_tiendong" && G.questState === "not_accepted") {
        const d = GAME_DATA.dialogues.q1_intro;
        openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
        return;
      }
      if (objId === "npc_chapsu" && G.questState === "active") {
        const d = GAME_DATA.dialogues.q1_complete;
        openDialogue(d.name, d.role, d.lines, d.btn, () => {
          G.questState = "ready_to_turn_in";
          advanceQuest();
        }, objId);
        return;
      }
    }

    // 2. Q2: Bước chân tu tiên
    if (q.id === "q2_buoc_chan_tu_tien") {
      if (objId === "npc_chapsu" && G.questState === "not_accepted") {
        const d = GAME_DATA.dialogues.q2_intro;
        openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
        return;
      }
      if (objId === "dais_qt" && G.questState === "active") {
        const d = GAME_DATA.dialogues.q2_inspect_dais;
        openDialogue(d.name, d.role, d.lines, d.btn, () => {
          G.questState = "ready_to_turn_in";
          advanceQuest();
        }, objId);
        return;
      }
    }

    // 3. Q3: Luyện kiếm nhập môn
    if (q.id === "q3_luyen_kiem_nhap_mon") {
      if (objId === "npc_truonglao") {
        if (G.questState === "not_accepted") {
          const d = GAME_DATA.dialogues.q3_intro;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        } else if (G.questState === "ready_to_turn_in") {
          const d = GAME_DATA.dialogues.q3_turn_in;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        }
      }
    }

    // 4. Q4: Thu thập linh thảo
    if (q.id === "q4_thu_thap_linh_thao") {
      if (objId === "npc_dansu") {
        if (G.questState === "not_accepted") {
          const d = GAME_DATA.dialogues.q4_intro;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        } else if (G.questState === "ready_to_turn_in") {
          const d = GAME_DATA.dialogues.q4_turn_in;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        }
      }
      if (objId.startsWith("herb_node_") && G.questState === "active") {
        startGathering(objId);
        return;
      }
    }

    // 5. Q5: Truy tìm dấu vết
    if (q.id === "q5_truy_tim_dau_vet") {
      if (objId === "npc_chapsu" && G.questState === "not_accepted") {
        const d = GAME_DATA.dialogues.q5_intro;
        openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
        return;
      }
      if (objId === "npc_thuve" && G.questState === "active" && G.questProgress === 0) {
        const d = GAME_DATA.dialogues.q5_talk_guard;
        openDialogue(d.name, d.role, d.lines, d.btn, () => {
          G.questProgress = 1;
          saveState();
          updateGuidanceTarget();
        }, objId);
        return;
      }
    }

    // 6. Q6: Thạch Vệ thức tỉnh
    if (q.id === "q6_thach_ve_thuc_tinh") {
      if (objId === "npc_thuve") {
        if (G.questState === "not_accepted") {
          const d = GAME_DATA.dialogues.q6_intro;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        } else if (G.questState === "ready_to_turn_in") {
          const d = GAME_DATA.dialogues.q6_turn_in;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        }
      }
    }

    // 7. Q7: Bạch Hổ xuất thế
    if (q.id === "q7_bach_ho_xuat_the") {
      if (objId === "npc_chuongmon" && G.questState === "not_accepted") {
        const d = GAME_DATA.dialogues.q7_intro;
        openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
        return;
      }
      if (objId === "npc_chuongmon" && G.questState === "ready_to_turn_in") {
        const d = GAME_DATA.dialogues.q7_turn_in;
        openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
        return;
      }
    }

    // 8. Q8: Xuất môn lịch luyện
    if (q.id === "q8_xuat_mon_lich_luyen") {
      if (objId === "npc_chuongmon" && G.questState === "not_accepted") {
        const d = GAME_DATA.dialogues.q8_intro;
        openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
        return;
      }
      if (objId === "dais_qt" && G.questState === "active") {
        const d = GAME_DATA.dialogues.q8_complete_slice;
        openDialogue(d.name, d.role, d.lines, d.btn, () => {
          const granted = applyQuestRewards(q);
          G.questIndex = 8;
          G.questState = "not_accepted";
          G.questProgress = 0;
          if (!S.portals.some(p => p.id === "portal_to_xichviem")) {
            S.portals.push({
              id: "portal_to_xichviem",
              px: [2820, 1572],
              r: 85,
              to_map: "xichviem",
              to_px: [1120, 880],
              label: "Cổng Xích Viêm",
              armed: false,
            });
          }
          saveState();
          updateGuidanceTarget();
          showBanner("CỔNG PHONG ẤN ĐÃ MỞ", "Đài Truyền Tống đã giải trừ phong ấn — Sẵn sàng tiến vào Xích Viêm Cốc!" + (granted ? ` · ${granted}` : ""));
        }, objId);
        return;
      }
    }

    // Sealed dais check before Q8:
    if (objId === "dais_qt" && G.questIndex < 7 && q.id !== "q2_buoc_chan_tu_tien") {
      openDialogue("Đài Truyền Tống Cổ", "Phong Ấn Viễn Cổ", [
        "Trận đồ truyền tống này bị một luồng khí tức viễn cổ phong ấn kiên cố.",
        "Phải hoàn thành lịch luyện môn phái và hàng phục Bạch Hổ Sơn Quân mới có thể phá giải phong ấn mở lối đi!"
      ], "Đóng", null, objId);
      showBanner("PHONG ẤN BẢO HỘ", "Cổng dịch chuyển chưa kích hoạt");
      return;
    }

    // 9. Q9: Phá ấn nhập cốc
    if (q.id === "q9_pha_an_nhap_coc") {
      if (objId === "dais_qt" && G.questState === "not_accepted") {
        const d = GAME_DATA.dialogues.q9_intro;
        openDialogue(d.name, d.role, d.lines, d.btn, () => {
          advanceQuest();
          saveState();
          updateGuidanceTarget();
          sessionStorage.setItem("tl3_spawn", JSON.stringify({ map: "xichviem", px: [1120, 880] }));
          location.search = "?map=xichviem";
        }, objId);
        return;
      }
      if (objId === "npc_xichviem_tientri" && G.questState === "active") {
        const d = GAME_DATA.dialogues.q9_talk_guardian;
        openDialogue(d.name, d.role, d.lines, d.btn, () => {
          G.questState = "ready_to_turn_in";
          advanceQuest(); // applies Q9 reward (650 EXP), advances to Q10
        }, objId);
        return;
      }
    }

    // 10. Q10: Trừ diệt Hỏa Tinh Thử
    if (q.id === "q10_tru_diet_hoa_tinh") {
      if (objId === "npc_xichviem_tientri") {
        if (G.questState === "not_accepted") {
          const d = GAME_DATA.dialogues.q10_intro;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        } else if (G.questState === "ready_to_turn_in") {
          const d = GAME_DATA.dialogues.q10_turn_in;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        }
      }
    }

    // 11. Q11: Thu thập Viêm Tinh Thạch
    if (q.id === "q11_thu_thap_viem_tinh") {
      if (objId === "npc_xichviem_tientri") {
        if (G.questState === "not_accepted") {
          const d = GAME_DATA.dialogues.q11_intro;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        } else if (G.questState === "ready_to_turn_in") {
          const d = GAME_DATA.dialogues.q11_turn_in;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        }
      }
      if (objId.startsWith("node_viemtinh_") && G.questState === "active") {
        startGathering(objId);
        return;
      }
    }

    // 12. Q12: Xích Viêm Tinh Anh
    if (q.id === "q12_viem_tinh_thuc_tinh") {
      if (objId === "npc_xichviem_tientri") {
        if (G.questState === "not_accepted") {
          const d = GAME_DATA.dialogues.q12_intro;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        } else if (G.questState === "ready_to_turn_in") {
          const d = GAME_DATA.dialogues.q12_turn_in;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        }
      }
    }

    // 13. Q13: Ma Quân giáng thế
    if (q.id === "q13_ma_quan_giang_the") {
      if (objId === "npc_xichviem_tientri") {
        if (G.questState === "not_accepted") {
          const d = GAME_DATA.dialogues.q13_intro;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        } else if (G.questState === "ready_to_turn_in") {
          const d = GAME_DATA.dialogues.q13_complete_slice;
          openDialogue(d.name, d.role, d.lines, d.btn, () => advanceQuest(), objId);
          return;
        }
      }
    }

    // Default NPC idle chatter
    const actorObj = S.actors.find(a => a.id === objId);
    if (actorObj && actorObj.actor.type === "npc") {
      openDialogue(actorObj.actor.label, "Thanh Vân Tiên Môn",
        ["Tu đạo chú trọng kiên tâm tĩnh khí. Đạo hữu hãy chú ý làm theo chỉ dẫn nhiệm vụ!"],
        "Đóng", null, objId);
    }
  }

  // --------------------------------------------------------------------------
  // Gathering System (§3.1 Q4)
  // --------------------------------------------------------------------------
  function startGathering(nodeId) {
    if (G.gathering.active || G.gatheredNodes.has(nodeId)) return;
    G.gathering.active = true;
    G.gathering.nodeId = nodeId;
    G.gathering.t = 0;
    const isViemTinh = nodeId.startsWith("node_viemtinh_");
    addFloatingText(P.x, P.y - 60, isViemTinh ? "Đang khai thác Viêm Tinh Thạch..." : "Đang hái linh thảo...", "#8be8ff");
  }

  function finishGathering() {
    const nodeId = G.gathering.nodeId;
    G.gathering.active = false;
    G.gathering.nodeId = null;
    if (!nodeId || G.gatheredNodes.has(nodeId)) return;

    G.gatheredNodes.add(nodeId);
    if (nodeId.startsWith("node_viemtinh_")) {
      G.questProgress++;
      addFloatingText(P.x, P.y - 70, "+1 Viêm Tinh Thạch (Hỏa Nham Vực)", "#ff9800");
      showBanner("THU THẬP THÀNH CÔNG", `Viêm Tinh Thạch: ${G.questProgress}/5`);

      if (G.questProgress >= 5) {
        G.questState = "ready_to_turn_in";
        showBanner("HOÀN THÀNH THU THẬP", "Trở về gặp Thủ Hộ Giả tại Thềm Nhập Cốc");
      }
    } else {
      G.herbsCount++;
      G.questProgress = G.herbsCount;
      addFloatingText(P.x, P.y - 70, "+1 Linh Thảo (Trúc Linh Lâm)", "#52ff7d");
      showBanner("THU THẬP THÀNH CÔNG", `Linh thảo: ${G.herbsCount}/5`);

      if (G.herbsCount >= 5) {
        G.questState = "ready_to_turn_in";
        showBanner("HOÀN THÀNH THU THẬP", "Trở về gặp Đan Dược Sư tại Quảng Trường");
      }
    }
    saveState();
    updateGuidanceTarget();
  }

  // --------------------------------------------------------------------------
  // Player Combat & Damage (§3.2)
  // --------------------------------------------------------------------------
  function playerAttack() {
    const p = G.player;
    if (p.isDead || p.isAttacking || G.casting) return false;
    if (S.t - p.lastAtkTime < p.atkCooldown) return false;

    p.lastAtkTime = S.t;
    p.isAttacking = true;
    p.atkAnimT = 0;

    if (netOn()) {
      // GD3: basic attack is an intent too; the server picks targets
      // in reach and computes the damage. Only the swing visual is local.
      const seq = ++G.onlineSeq;
      TLNET.sendAttackIntent(seq);
      const dirAngles = { east: 0, SE: 45, front: 90, SW: 135, west: 180, NW: 225, back: 270, NE: 315 };
      const rad = (dirAngles[P.dir] || 90) * Math.PI / 180;
      createAttackSlash(P.x, P.y, P.x + Math.cos(rad) * p.atkRange, P.y + Math.sin(rad) * p.atkRange);
      return true;
    }

    // Find targets in sword reach
    let hitCount = 0;
    const reach = p.atkRange;

    // Attack monster
    for (const [id, m] of G.monsters.entries()) {
      if (m.isDead) continue;
      const d = Math.hypot(m.x - P.x, m.y - P.y);
      if (d <= reach) {
        damageMonster(m, p.atk);
        hitCount++;
        // Create slashing trail towards monster
        createAttackSlash(P.x, P.y, m.x, m.y);
      }
    }

    // Attack boss if in range
    if (G.boss && !G.boss.isDead && (S.map === "hauson" || S.map === "xichviem")) {
      const b = G.boss;
      const d = Math.hypot(b.x - P.x, b.y - P.y);
      if (d <= reach + 60) {
        damageBoss(b, p.atk);
        hitCount++;
        createAttackSlash(P.x, P.y, b.x, b.y);
      }
    }

    if (hitCount === 0) {
      // Empty swing in current facing direction
      const dirAngles = { east: 0, SE: 45, front: 90, SW: 135, west: 180, NW: 225, back: 270, NE: 315 };
      const rad = (dirAngles[P.dir] || 90) * Math.PI / 180;
      createAttackSlash(P.x, P.y, P.x + Math.cos(rad) * reach, P.y + Math.sin(rad) * reach);
    }

    return true;
  }

  function createAttackSlash(x0, y0, x1, y1) {
    G.attackSlashes.push({
      x0, y0, x1, y1,
      t: 0,
      duration: 0.22,
    });
  }

  // ULT energy gauge (spec §3.5): fills when the player deals damage and
  // when the player takes damage. Rates are PROVISIONAL team-chosen
  // balance values: +2 per enemy damaged, +6 per hit received.
  function gainEnergy(n) {
    const p = G.player;
    p.energy = Math.max(0, Math.min(100, p.energy + n));
  }

  // ---- GD3 online layer helpers (spec §8.2/§9 GĐ3) -------------------
  // Active only when the GD3 server has welcomed this client (net.js
  // sets G.online via netSetOnline). Every hook below is a no-op path
  // in local mode: all call sites branch on netOn() first.
  function netOn() { return G.online && window.TLNET && TLNET.connected(); }

  // Apply one server-computed hit list (own cast result or a remote
  // player's broadcast hit_event). The server already decided damage,
  // remaining HP, deaths and boss phase; here we only PRESENT it:
  // flash, floating text, death transitions + quest kill credit.
  function applyServerHits(hits) {
    if (!hits) return;
    for (const h of hits) {
      if (h.kind === "boss") {
        const b = G.boss;
        if (!b || b.id !== h.target_id) continue;
        const wasDead = b.isDead;
        b.hp = h.hp;
        b.hitFlashT = 0.25;
        addFloatingText(b.x, b.y - b.cfg.h * 0.65, `-${h.dmg}`, "#ffd54f");
        if (typeof h.phase === "number" && h.phase !== b.phase) {
          b.phase = h.phase;
          if (h.phaseChanged && !wasDead) {
            b.state = "PHASE_TRANSITION"; b.stateT = 0; b.phaseTransT = 1.4;
            addFloatingText(b.x, b.y - 120, `GIAI ĐOẠN ${h.phase}!`, "#ff5252");
          }
        }
        if (h.dead && !wasDead) {
          b.isDead = true; b.state = "DEATH"; b.stateT = 0;
          onBossKilled();
        }
      } else {
        const m = G.monsters.get(h.target_id);
        if (!m) continue;
        const wasDead = m.isDead;
        m.hp = h.hp;
        m.hitFlashT = 0.25;
        addFloatingText(m.x, m.y - m.obj.actor.h * 0.7, `-${h.dmg}`, "#fff176");
        createAttackSlash(P.x, P.y, m.x, m.y);
        if (h.dead && !wasDead) {
          m.isDead = true; m.state = "DEATH"; m.stateT = 0;
          onMonsterKilled(m);
        } else if (!wasDead) {
          m.state = "HIT"; m.stateT = 0;
        }
      }
    }
  }

  // Adopt the server's authoritative player state (HP/MP/energy and
  // per-skill cooldowns). Called on welcome, on every cast/attack
  // result (accepted or rejected) and on monster_hit verdicts.
  function netApplyYouState(you, meta) {
    if (!you) return;
    const p = G.player;
    p.hp = you.hp;
    p.mp = you.mp;
    p.energy = you.energy;
    for (const def of SKILLS) {
      const left = you.cds ? you.cds[def.skill_id] : undefined;
      G.skillRt[def.skill_id].cdReadyAt = left ? S.t + left : 0;
    }
    if (meta && typeof meta.dmgTaken === "number" && meta.dmgTaken > 0) {
      addFloatingText(P.x, P.y - 80, `-${meta.dmgTaken}`, "#ff4444");
    }
    if (you.dead && !p.isDead) {
      p.hp = 0; p.isDead = true; p.deathT = 2.0;
      G.casting = null; G.aim = null; G.dodge = null;
      G.defending = false; G.pendingSkill = null;
      showBanner("BỊ TRỌNG THƯƠNG", "Đang hồi sinh tại điểm an toàn...");
    }
  }

  // A cast/attack result from the server (net.js forwards it here).
  function netApplyCastResult(msg) {
    if (msg.you) netApplyYouState(msg.you, {});
    if (!msg.ok) {
      const def = msg.skill_id ? SKILL_BY_ID[msg.skill_id] : null;
      if (def) {
        if (msg.reason === "energy" || msg.reason === "mana") refuseCast(def, msg.reason);
        else if (msg.reason === "cooldown") flashButton(def.skill_id, "on-cd", 300);
        else if (msg.reason === "invalid_target") refuseCast(def, "target");
        else if (msg.reason === "out_of_range") refuseCast(def, "range");
      }
      if (G.casting && G.casting.seq === msg.seq) G.casting.serverRejected = true;
      return;
    }
    if (msg.type === "attack_result") { applyServerHits(msg.hits); return; }
    const c = G.casting;
    if (c && c.seq === msg.seq && c.awaitingServer && !c.serverRejected) {
      c.awaitingServer = false;
      applyServerHits(msg.hits);
    } else {
      G.onlineResults.set(msg.seq, msg);
    }
  }

  // Sync monster/boss HP+death from a server snapshot or world_sync.
  // Deliberately grants NO quest kill credit: credit flows only from
  // live hit results/events (applyServerHits), never from snapshots.
  function netApplyWorld(world) {
    if (!world) return;
    for (const e of world.monsters || []) {
      const m = G.monsters.get(e.id);
      if (!m) continue;
      if (e.dead && !m.isDead) { m.hp = 0; m.isDead = true; m.state = "DEATH"; m.stateT = 0; }
      else if (!e.dead) m.hp = e.hp;
    }
    if (world.boss && G.boss && world.boss.id === G.boss.id) {
      const e = world.boss, b = G.boss;
      if (e.dead && !b.isDead) { b.hp = 0; b.isDead = true; b.state = "DEATH"; b.stateT = 0; }
      else if (!e.dead) {
        b.hp = e.hp;
        if (typeof e.phase === "number") b.phase = e.phase;
      }
    }
  }

  function damageMonster(m, rawAtk) {
    if (m.isDead) return;
    const def = m.cfg.def || 0;
    const dmg = Math.max(8, Math.round(rawAtk * (0.9 + Math.random() * 0.25) - def));
    m.hp -= dmg;
    gainEnergy(2);
    m.hitFlashT = 0.25;
    addFloatingText(m.x, m.y - m.obj.actor.h * 0.7, `-${dmg}`, "#fff176");

    // Pack aggro for Linh Lang (§28)
    if (m.cfgKey === "linhlang") {
      for (const [siblingId, sib] of G.monsters.entries()) {
        if (sib !== m && sib.cfgKey === "linhlang" && !sib.isDead) {
          if (Math.hypot(sib.x - m.x, sib.y - m.y) <= m.cfg.packCallRadius) {
            sib.state = "CHASE";
          }
        }
      }
    }

    if (m.hp <= 0) {
      m.hp = 0;
      m.isDead = true;
      m.state = "DEATH";
      m.stateT = 0;
      onMonsterKilled(m);
    } else {
      m.state = "HIT";
      m.stateT = 0;
    }
  }

  function damageBoss(b, rawAtk) {
    if (b.isDead || b.state === "PHASE_TRANSITION") return;
    const dmg = Math.max(10, Math.round(rawAtk * (0.9 + Math.random() * 0.25) - b.cfg.def));
    b.hp -= dmg;
    gainEnergy(2);
    b.hitFlashT = 0.25;
    addFloatingText(b.x, b.y - b.cfg.h * 0.65, `-${dmg}`, "#ffd54f");

    // Phase threshold check (§3.4)
    const hpFrac = b.hp / b.maxHp;
    if (b.phase === 1 && hpFrac <= 0.66 && hpFrac > 0) {
      b.phase = 2;
      b.state = "PHASE_TRANSITION";
      b.stateT = 0;
      b.phaseTransT = 1.4;
      if (b.id === "boss_xichviem") {
        showBanner("MA QUÂN THỨC TỈNH", "Giai đoạn 2: Thêm kỹ năng LIỆT HỎA ĐỊA CHẤN");
        addFloatingText(b.x, b.y - 120, "LIỆT HỎA ĐỊA CHẤN!", "#ff5252");
      } else {
        showBanner("BẠCH HỔ NỔI GIẬN", "Giai đoạn 2: Thêm kỹ năng GẦM CHẤN ĐỘNG");
        addFloatingText(b.x, b.y - 120, "GẦM CHẤN ĐỘNG!", "#ff5252");
      }
    } else if (b.phase === 2 && hpFrac <= 0.33 && hpFrac > 0) {
      b.phase = 3;
      b.state = "PHASE_TRANSITION";
      b.stateT = 0;
      b.phaseTransT = 1.4;
      if (b.id === "boss_xichviem") {
        showBanner("MA QUÂN CUỒNG NỘ", "Giai đoạn 3: Thêm kỹ năng XÍCH VIÊM LIÊU NGUYÊN");
        addFloatingText(b.x, b.y - 120, "XÍCH VIÊM LIÊU NGUYÊN!", "#ff1744");
      } else {
        showBanner("BẠCH HỔ CUỒNG PHỘ", "Giai đoạn 3: Thêm kỹ năng LAO BỔ DIỆN RỘNG");
        addFloatingText(b.x, b.y - 120, "LAO BỔ DIỆN RỘNG!", "#ff1744");
      }
    }

    if (b.hp <= 0) {
      b.hp = 0;
      b.isDead = true;
      b.state = "DEATH";
      b.stateT = 0;
      onBossKilled();
    } else if (b.state !== "PHASE_TRANSITION" && b.state !== "TELEGRAPH_ROAR" && b.state !== "TELEGRAPH_DASH") {
      b.state = "HIT";
      b.stateT = 0;
    }
  }

  function damagePlayer(amount, sourceName, knockback, attackerId) {
    const p = G.player;
    if (p.isDead) return;
    if (netOn()) {
      // GD3: monster->player damage is decided by the server from its
      // own data (attacker alive / in range / off its attack cooldown).
      // The local amount is NOT applied; netApplyYouState applies the
      // server's verdict (and triggers death if it says HP reached 0).
      // Knockback stays a local visual (positions are client-reported).
      p.hitFlashT = 0.3;
      if (knockback && knockback.dx !== undefined) {
        P.x += knockback.dx; P.y += knockback.dy; P.path = []; P.moving = false;
      }
      TLNET.reportMonsterHit(attackerId || null, G.defending);
      return;
    }
    let dmg = Math.max(5, Math.round(amount - p.def));
    // Defend stance (spec §5.3): strong damage reduction while held —
    // PROVISIONAL team-chosen value: 60% reduction, player rooted.
    if (G.defending) dmg = Math.max(1, Math.round(dmg * 0.4));
    p.hp -= dmg;
    p.hitFlashT = 0.3;
    gainEnergy(6);
    addFloatingText(P.x, P.y - 80, `-${dmg}`, "#ff4444");

    // Cast interrupt (spec §3.4, K2 precedent): a hit dealing >= 10% of
    // max HP during CASTING, before the hit phase lands, breaks the cast —
    // half the mana is refunded and the skill takes a short cooldown.
    if (G.casting && G.casting.def.interruptible && !G.casting.hitApplied &&
        dmg >= 0.10 * p.maxHp) {
      interruptCast("Bị ngắt chiêu!");
    }

    if (knockback && knockback.dx !== undefined) {
      // knockback player
      P.x += knockback.dx;
      P.y += knockback.dy;
      P.path = [];
      P.moving = false;
    }

    if (p.hp <= 0) {
      p.hp = 0;
      p.isDead = true;
      p.deathT = 2.0;
      showBanner("BỊ TRỌNG THƯƠNG", "Đang hồi sinh tại điểm an toàn...");
    }
  }

  function respawnPlayer() {
    const p = G.player;
    if (netOn()) TLNET.sendRespawn(); // GD3: server restores the player; room HP/phase untouched there too
    p.isDead = false;
    p.hp = p.maxHp;
    p.mp = p.maxMp; // MP refills on respawn, mirroring HP; energy is kept
    // Any in-flight cast / aim / dodge / defend dies with the player.
    G.casting = null;
    G.aim = null;
    G.dodge = null;
    G.defending = false;
    G.pendingSkill = null;
    // Map default spawn
    const spawnPx = S.nav.spawn_px;
    setPlayerPx(spawnPx[0], spawnPx[1]);
    S.cam.x = P.x; S.cam.y = P.y + 60;
    showBanner("HỒI SINH HOÀN TẤT", "Sinh mệnh đã phục hồi toàn bộ");

    // Combat state disengages fairly (§3.2, §3.4) — but hit points do NOT
    // reset. Per Bui's ruling (2026-11-09: "Khi chết ta hồi sinh máu quái
    // giữ nguyên không hồi đầy"), a damaged monster/elite/boss KEEPS its
    // current HP across a player death so attrition is a valid path, and
    // a killed monster stays dead. Only AI state and position reset (the
    // enemy returns home still wounded); the boss's phase is likewise
    // kept, since it is a function of its kept HP.
    for (const m of G.monsters.values()) {
      if (m.isDead) continue; // killed stays killed; its HP is 0 as-is
      m.state = "IDLE";
      m.x = m.homeX;
      m.y = m.homeY;
      m.obj.anchor[0] = m.homeX;
      m.obj.anchor[1] = m.homeY;
      // m.hp intentionally NOT restored (persistent-HP ruling).
      m.isUsingSkill = false;
      m.path = [];
    }
    if (G.boss && !G.boss.isDead) {
      // G.boss.hp and G.boss.phase intentionally NOT reset (same ruling);
      // phase stays consistent because it only ever advances as HP drops.
      G.boss.state = "IDLE";
      G.boss.x = G.boss.homeX;
      G.boss.y = G.boss.homeY;
      G.boss.obj.anchor[0] = G.boss.homeX;
      G.boss.obj.anchor[1] = G.boss.homeY;
      G.boss.warningCircle = null;
      G.boss.warningLine = null;
      G.bossEngaged = false;
    }
    saveState();
  }

  function onMonsterKilled(m) {
    const q = currentQuest();
    if (!q) return;

    if (q.id === "q3_luyen_kiem_nhap_mon" && m.cfgKey === "trucyeu") {
      G.questProgress++;
      addFloatingText(m.x, m.y - 90, `Trúc Yêu: ${G.questProgress}/5`, "#52ff7d");
      showBanner("TIẾN ĐỘ NHIỆM VỤ", `Đã trảm Trúc Yêu: ${G.questProgress}/5`);
      if (G.questProgress >= 5) {
        G.questState = "ready_to_turn_in";
        showBanner("HOÀN THÀNH TIÊU DIỆT", "Trở về gặp Trưởng Lão Võ tại Luyện Võ Trường");
      }
      saveState();
      updateGuidanceTarget();
    } else if (q.id === "q6_thach_ve_thuc_tinh" && m.cfgKey === "thachve_elite") {
      G.questProgress = 1;
      G.questState = "ready_to_turn_in";
      showBanner("TRẢM THẠCH VỆ TINH ANH", "Trở về báo công cùng Thủ Vệ Vân Ẩn Động");
      saveState();
      updateGuidanceTarget();
    } else if (q.id === "q10_tru_diet_hoa_tinh" && m.cfgKey === "hoatinh") {
      G.questProgress++;
      addFloatingText(m.x, m.y - 90, `Hỏa Tinh: ${G.questProgress}/5`, "#52ff7d");
      showBanner("TIẾN ĐỘ NHIỆM VỤ", `Đã trảm Hỏa Tinh Thử: ${G.questProgress}/5`);
      if (G.questProgress >= 5) {
        G.questState = "ready_to_turn_in";
        showBanner("HOÀN THÀNH TIÊU DIỆT", "Trở về gặp Thủ Hộ Giả tại Thềm Nhập Cốc");
      }
      saveState();
      updateGuidanceTarget();
    } else if (q.id === "q12_viem_tinh_thuc_tinh" && m.cfgKey === "xichviem_elite") {
      G.questProgress = 1;
      G.questState = "ready_to_turn_in";
      showBanner("TRẢM XÍCH VIÊM TINH ANH", "Trở về báo công cùng Thủ Hộ Giả");
      saveState();
      updateGuidanceTarget();
    }
  }

  function onBossKilled() {
    const q = currentQuest();
    if (q && q.id === "q7_bach_ho_xuat_the") {
      G.questProgress = 1;
      G.questState = "ready_to_turn_in";
      showBanner("HÀNG PHỤC SƠN QUÂN", "Hoàn thành Q7 tại chỗ! Trở về gặp Chưởng Môn");
      saveState();
      updateGuidanceTarget();
      const d = GAME_DATA.dialogues.q7_boss_victory;
      openDialogue(d.name, d.role, d.lines, d.btn, null, "boss_bachho");
    } else if (q && q.id === "q13_ma_quan_giang_the") {
      G.questProgress = 1;
      G.questState = "ready_to_turn_in";
      showBanner("HÀNG PHỤC MA QUÂN", "Hoàn thành Q13! Trở về gặp Thủ Hộ Giả");
      saveState();
      updateGuidanceTarget();
      const d = GAME_DATA.dialogues.q13_boss_victory;
      if (d) {
        openDialogue(d.name, d.role, d.lines, d.btn, null, "boss_xichviem");
      }
    }
  }

  // ==========================================================================
  // Combat HUD — Skills, Casting State Machine, Dodge/Defend (spec §3/§5/§6/§8)
  // HUD wave 2026-11-09. Bui locked the configuration (16:40, 2026-11-09):
  // phone + PC, 4 skill slots + 1 ULT, tap-cast AND hold-drag aim,
  // auto-target = nearest monster.
  //
  // ALL per-skill numbers below are PROVISIONAL team-chosen values: the
  // animation packs carry no balance data, so costs/cooldowns/damage were
  // scaled to the slice's existing combat numbers (basic swing = atk per
  // 0.6s; player atk 32 at level 1 -> 53 at level 8) pending a balance
  // pass. Monster/boss stats are untouched.
  // ==========================================================================

  // Pack grids: rows are directions in sheet order [N, NE, E, SE, S, SW, W,
  // NW], columns are phases F1..F8. Angle index here is screen-space
  // (0 = east, clockwise, y down): [E, SE, S, SW, W, NW, N, NE].
  const SKILL_DIR_ROWS = [2, 3, 4, 5, 6, 7, 0, 1];
  const DIR_NAMES_BY_ANGLE = ["east", "SE", "front", "SW", "west", "NW", "back", "NE"];
  function angleIndex(deg) { return Math.round((((deg % 360) + 360) % 360) / 45) % 8; }
  function angleToRow(deg) { return SKILL_DIR_ROWS[angleIndex(deg)]; }
  function dirNameForAngle(deg) { return DIR_NAMES_BY_ANGLE[angleIndex(deg)]; }
  function facingAngle() {
    const map = { east: 0, SE: 45, front: 90, SW: 135, west: 180, NW: 225, back: 270, NE: 315 };
    return map[P.dir] !== undefined ? map[P.dir] : 90;
  }
  function angleToPoint(x, y) {
    return Math.atan2(y - P.y, x - P.x) * 180 / Math.PI;
  }

  // Skill data in the spec §8.1 server-shaped schema (14 fields). The
  // damage field is a FORMULA STRING (data, not code), evaluated against
  // the player's current ATK. For area skills the effect radius rides in
  // the vfx payload; vfx.center says where the area is centred.
  const SKILLS = [
    {
      skill_id: "sk_thaicuc_chuong", name_vi: "Thái Cực Chưởng",
      icon: "assets/hud/icon_sk_thaicuc_chuong.png",
      animation: { pack: "thaicuc", fps: 16, hit_phase: 5 },
      vfx: { id: "fx_thaicuc_ring" },
      cooldown: 5, mana_cost: 12, energy_cost: 0,
      target_type: "directional", cast_time: 0.5, range: 250,
      damage: "atk * 1.5", interruptible: true, unlock: "default",
    },
    {
      skill_id: "sk_kimcang_quyen", name_vi: "Kim Cang Quyền",
      icon: "assets/hud/icon_sk_kimcang_quyen.png",
      animation: { pack: "kimcang", fps: 16, hit_phase: 5 },
      vfx: { id: "ground_ring", color: "rgba(255, 190, 60, 0.30)", border: "rgba(255, 215, 90, 0.95)" },
      cooldown: 8, mana_cost: 18, energy_cost: 0,
      target_type: "single", cast_time: 0.5, range: 160,
      damage: "atk * 2.2", interruptible: true, unlock: "default",
    },
    {
      skill_id: "sk_philong_cuoc", name_vi: "Phi Long Cước",
      icon: "assets/hud/icon_sk_philong_cuoc.png",
      animation: { pack: "philong", fps: 16, hit_phase: 5 },
      vfx: { id: "ground_ring", color: "rgba(80, 220, 170, 0.28)", border: "rgba(120, 255, 200, 0.95)" },
      cooldown: 10, mana_cost: 16, energy_cost: 0,
      target_type: "single", cast_time: 0.55, range: 330,
      damage: "atk * 1.9", interruptible: true, unlock: "default",
    },
    {
      skill_id: "sk_batquai_chuong", name_vi: "Bát Quái Chưởng",
      icon: "assets/hud/icon_sk_batquai_chuong.png",
      animation: { pack: "batquai", fps: 16, hit_phase: 5 },
      vfx: { id: "ground_ring", center: "self", radius: 175, color: "rgba(150, 200, 255, 0.26)", border: "rgba(170, 220, 255, 0.95)" },
      cooldown: 12, mana_cost: 22, energy_cost: 0,
      target_type: "area", cast_time: 0.6, range: 175,
      damage: "atk * 1.4", interruptible: true, unlock: "default",
    },
    {
      skill_id: "ult_nguhanh_quyen", name_vi: "Ngũ Hành Quyền",
      icon: "assets/hud/icon_ult_nguhanh_quyen.png",
      animation: { pack: "nguhanhquyen", fps: 10, hit_phase: 5 },
      vfx: { id: "ground_ring", center: "aim", radius: 190, color: "rgba(255, 120, 200, 0.26)", border: "rgba(255, 180, 90, 0.95)" },
      cooldown: 1, mana_cost: 0, energy_cost: 100,
      target_type: "area", cast_time: 0.8, range: 400,
      damage: "atk * 3.2", interruptible: true, unlock: "default",
    },
    // ---- HUD2 wave (spec §6.2): the five swappable skills. ALL numbers
    // PROVISIONAL, set on the same relative scale as the five above and
    // pending a dedicated balance wave (see docs/hud-report.md).
    {
      skill_id: "sk_hoavan_toan", name_vi: "Hỏa Vân Toàn",
      icon: "assets/hud/icon_sk_hoavan_toan.png",
      animation: { pack: "hoavan", fps: 16, hit_phase: 5 },
      vfx: { id: "ground_ring", center: "self", radius: 170, color: "rgba(255, 110, 40, 0.26)", border: "rgba(255, 160, 60, 0.95)" },
      cooldown: 13, mana_cost: 24, energy_cost: 0,
      target_type: "area", cast_time: 0.6, range: 170,
      damage: "atk * 1.6", interruptible: true, unlock: "default",
    },
    {
      skill_id: "sk_bangphong_chuong", name_vi: "Băng Phong Chưởng",
      icon: "assets/hud/icon_sk_bangphong_chuong.png",
      animation: { pack: "bangphong", fps: 16, hit_phase: 5 },
      vfx: { id: "ground_ring", color: "rgba(120, 210, 255, 0.28)", border: "rgba(170, 235, 255, 0.95)" },
      cooldown: 11, mana_cost: 20, energy_cost: 0,
      target_type: "single", cast_time: 0.5, range: 300,
      damage: "atk * 1.7", interruptible: true, unlock: "default",
    },
    {
      skill_id: "sk_loidinh_kich", name_vi: "Lôi Đình Kích",
      icon: "assets/hud/icon_sk_loidinh_kich.png",
      animation: { pack: "loidinh", fps: 16, hit_phase: 5 },
      vfx: { id: "ground_ring", color: "rgba(180, 140, 255, 0.28)", border: "rgba(215, 190, 255, 0.95)" },
      cooldown: 9, mana_cost: 19, energy_cost: 0,
      target_type: "single", cast_time: 0.45, range: 340,
      damage: "atk * 2.0", interruptible: true, unlock: "default",
    },
    {
      skill_id: "sk_thienphong_bo", name_vi: "Thiên Phong Bộ",
      icon: "assets/hud/icon_sk_thienphong_bo.png",
      animation: { pack: "thienphong", fps: 16, hit_phase: 5 },
      vfx: { id: "ground_ring", color: "rgba(140, 255, 220, 0.22)", border: "rgba(170, 255, 230, 0.9)" },
      cooldown: 8, mana_cost: 14, energy_cost: 0,
      target_type: "self", cast_time: 0.5, range: 260,
      damage: "atk * 0", interruptible: true, unlock: "default",
    },
    {
      skill_id: "sk_voanh_lienhoan", name_vi: "Vô Ảnh Liên Hoàn",
      icon: "assets/hud/icon_sk_voanh_lienhoan.png",
      animation: { pack: "voanh", fps: 16, hit_phase: 5 },
      vfx: { id: "ground_ring", color: "rgba(235, 240, 255, 0.26)", border: "rgba(255, 255, 255, 0.95)" },
      cooldown: 14, mana_cost: 26, energy_cost: 0,
      target_type: "single", cast_time: 0.7, range: 170,
      damage: "atk * 2.4", interruptible: true, unlock: "default",
    },
  ];
  const SKILL_BY_ID = {};
  for (const s of SKILLS) { SKILL_BY_ID[s.skill_id] = s; G.skillRt[s.skill_id] = { cdReadyAt: 0 }; }
  // Default slot binding (spec §6.1): SK1..SK4 + ULT. From the HUD2 wave
  // the four SK slots are player-swappable via the skill panel (§6.3);
  // the live binding is G.skillSlots, seeded from this default and
  // restored from the save. The ULT slot is locked to Ngũ Hành Quyền.
  const DEFAULT_SKILL_SLOTS = ["sk_thaicuc_chuong", "sk_kimcang_quyen", "sk_philong_cuoc", "sk_batquai_chuong", "ult_nguhanh_quyen"];
  G.skillSlots = [...DEFAULT_SKILL_SLOTS];
  function applySavedSkillSlots(saved) {
    if (!Array.isArray(saved) || saved.length !== 5) return;
    const sk = saved.slice(0, 4);
    const ok = sk.every(id => SKILL_BY_ID[id] && SKILL_BY_ID[id].energy_cost === 0) &&
      new Set(sk).size === 4 && saved[4] === "ult_nguhanh_quyen";
    if (ok) G.skillSlots = [...sk, "ult_nguhanh_quyen"];
  }

  function evalDamageFormula(formula, atk) {
    const m = /^atk\s*\*\s*([\d.]+)(?:\s*\+\s*([\d.]+))?$/.exec(String(formula || "").trim());
    if (!m) return atk;
    return atk * parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) : 0);
  }
  function skillCdLeft(def) {
    const rt = G.skillRt[def.skill_id];
    return rt ? Math.max(0, rt.cdReadyAt - S.t) : 0;
  }

  // ---- Animation pack loading (async; casting falls back to the normal
  // body sprite until a pack arrives, the state machine is unaffected).
  const PACKS = {}; // pack name -> { img, pivot:[x,y] in cell px, disp }
  const PACK_FILES = {
    thaicuc: "thaicuc_atlas", kimcang: "kimcang_atlas", philong: "philong_atlas",
    batquai: "batquai_atlas", nguhanhquyen: "nguhanhquyen_atlas",
    hoavan: "hoavan_atlas", bangphong: "bangphong_atlas", loidinh: "loidinh_atlas",
    thienphong: "thienphong_atlas", voanh: "voanh_atlas",
  };
  // Measured body height inside a 512 cell where the pack JSON carries no
  // body_h_in_cell (Thái Cực HD: F1 front bbox measured 2026-11-09).
  const PACK_BODYH_FALLBACK = { thaicuc: 293 };
  let thaicucFxImg = null;
  async function loadSkillPacks() {
    for (const [pack, stem] of Object.entries(PACK_FILES)) {
      try {
        const json = await (await fetch(`assets/skills/${stem}.json`)).json();
        const img = await loadImage(`assets/skills/${stem}.png`);
        let pivot = (json.meta && json.meta.pivot) || null;
        let bodyH = PACK_BODYH_FALLBACK[pack] || 267;
        if (json.frames) {
          for (const f of Object.values(json.frames)) {
            if (!pivot && f.pivot_in_cell) pivot = f.pivot_in_cell;
            if (typeof f.body_h_in_cell === "number") { bodyH = f.body_h_in_cell; break; }
          }
        }
        if (!pivot) pivot = [256, 461];
        // Display size: the character body inside the cell should stand
        // ~118px tall in the world, the slice's PLAYER_H.
        PACKS[pack] = { img, pivot, disp: 118 * 512 / bodyH, bodyH };
      } catch (err) {
        console.warn("skill pack failed to load:", pack, err);
      }
    }
    thaicucFxImg = await loadImage("assets/skills/fx_thaicuc_ring.png").catch(() => null);
  }

  // ---- Target selection (spec §3.3)
  function targetPos(t) {
    if (!t) return null;
    if (t.kind === "monster") {
      if (!t.m || t.m.isDead) return null;
      return { x: t.m.x, y: t.m.y };
    }
    if (t.kind === "boss") {
      if (!G.boss || G.boss.isDead) return null;
      return { x: G.boss.x, y: G.boss.y };
    }
    return null;
  }
  function targetAlive(t) { return !!targetPos(t); }
  function nearestEnemy(maxDist, fromX, fromY) {
    const fx = fromX !== undefined ? fromX : P.x, fy = fromY !== undefined ? fromY : P.y;
    let best = null, bestD = maxDist;
    for (const m of G.monsters.values()) {
      if (m.isDead) continue;
      const d = Math.hypot(m.x - fx, m.y - fy);
      if (d < bestD) { bestD = d; best = { kind: "monster", m }; }
    }
    if (G.boss && !G.boss.isDead) {
      const d = Math.hypot(G.boss.x - fx, G.boss.y - fy);
      if (d < bestD) { bestD = d; best = { kind: "boss" }; }
    }
    return best;
  }
  function cycleTarget() {
    const list = [];
    for (const m of G.monsters.values()) if (!m.isDead) list.push({ kind: "monster", m });
    if (G.boss && !G.boss.isDead) list.push({ kind: "boss" });
    if (!list.length) { G.target = null; return; }
    list.sort((a, b) => {
      const pa = targetPos(a), pb = targetPos(b);
      return Math.hypot(pa.x - P.x, pa.y - P.y) - Math.hypot(pb.x - P.x, pb.y - P.y);
    });
    let idx = -1;
    if (G.target) idx = list.findIndex(t =>
      (t.kind === G.target.kind) && (t.kind === "boss" || t.m === G.target.m));
    G.target = list[(idx + 1) % list.length];
    const tp = targetPos(G.target);
    if (tp) addFloatingText(tp.x, tp.y - 90, "Đã chọn mục tiêu", "#ffd75a");
  }

  // ---- Cast feedback on the HUD buttons
  const btnRefs = {}; // filled by buildHUD: skill_id / "atk" / "dodge" -> element
  function flashButton(key, cls, ms) {
    const el = btnRefs[key];
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms || 650);
  }
  function refuseCast(def, reason) {
    // reason: "mana" | "energy" | "cooldown" | "target" | "range"
    if (reason === "mana") {
      flashButton(def.skill_id, "no-mana");
      const mpEl = document.getElementById("playerStatus");
      if (mpEl) { mpEl.classList.add("mp-flash"); setTimeout(() => mpEl.classList.remove("mp-flash"), 650); }
      addFloatingText(P.x, P.y - 95, "Không đủ MP!", "#6ec6ff");
    } else if (reason === "energy") {
      flashButton(def.skill_id, "no-energy");
      addFloatingText(P.x, P.y - 95, "Chưa đủ năng lượng tuyệt kỹ!", "#ffb74d");
    } else if (reason === "target") {
      addFloatingText(P.x, P.y - 95, "Không có mục tiêu!", "#ffe082");
    } else if (reason === "range") {
      addFloatingText(P.x, P.y - 95, "Mục tiêu ngoài tầm!", "#ffe082");
    }
    return false;
  }

  // ---- The casting state machine (spec §3.2)
  function startCast(def, ctxCast) {
    const p = G.player;
    p.mp -= def.mana_cost;
    if (def.energy_cost > 0) p.energy = Math.max(0, p.energy - def.energy_cost);
    G.gathering.active = false; // casting supersedes a gather channel
    P.path = [];
    const angle = ctxCast.angle !== undefined ? ctxCast.angle : facingAngle();
    if (window.TL2 && TL2.setFacing) TL2.setFacing(dirNameForAngle(angle));
    G.casting = {
      def, t: 0, angle, row: angleToRow(angle),
      target: ctxCast.target || null,
      center: ctxCast.center || null,
      hitApplied: false, dashed: false,
      seq: 0, awaitingServer: false,
    };
    addFloatingText(P.x, P.y - 100, def.name_vi + "!", "#ffd75a");
    if (netOn()) {
      // GD3: send the cast INTENT (spec §8.1 shape); the local mana
      // deduction above is only a prediction — the server validates
      // and its you_state in the result is adopted verbatim.
      const seq = ++G.onlineSeq;
      G.casting.seq = seq;
      const tgt = ctxCast.target || null;
      TLNET.sendCastIntent({
        seq, skill_id: def.skill_id,
        target_id: tgt ? (tgt.kind === "boss" ? (G.boss ? G.boss.id : null) : (tgt.m ? tgt.m.id : null)) : null,
        angle: Math.round(angle),
        point: ctxCast.center ? { x: Math.round(ctxCast.center.x), y: Math.round(ctxCast.center.y) } : null,
      });
    }
    saveState();
  }

  // HUD2 open-point decision (parent brief): when a skill is BOTH on
  // cooldown AND unaffordable, the button reports the RESOURCE shortage
  // ("thiếu mana" / "chưa đủ năng lượng") — the actionable information —
  // while the cast stays blocked either way. Resource checks therefore
  // run before the cooldown check in tryCast and beginAim alike.
  function castBlockReason(def) {
    const p = G.player;
    if (def.energy_cost > 0 && p.energy < def.energy_cost) return "energy";
    if (p.mp < def.mana_cost) return "mana";
    if (skillCdLeft(def) > 0) return "cooldown";
    return null;
  }
  function blockedBy(def) {
    const reason = castBlockReason(def);
    if (!reason) return false;
    if (reason === "cooldown") { flashButton(def.skill_id, "on-cd", 300); return true; }
    refuseCast(def, reason);
    return true;
  }

  function tryCast(def, aimCtx) {
    const p = G.player;
    if (G.dialogue.open || p.isDead || G.casting) return false;
    if (blockedBy(def)) return false;

    if (def.target_type === "directional") {
      let angle;
      if (aimCtx && aimCtx.angle !== undefined) angle = aimCtx.angle;
      else if (targetAlive(G.target)) { const tp = targetPos(G.target); angle = angleToPoint(tp.x, tp.y); }
      else angle = facingAngle();
      startCast(def, { angle });
      return true;
    }

    if (def.target_type === "single") {
      let target = null;
      if (aimCtx && aimCtx.point) target = nearestEnemy(110, aimCtx.point.x, aimCtx.point.y);
      if (!target && targetAlive(G.target)) target = G.target;
      if (!target) target = nearestEnemy(def.range * 1.6);
      if (!target) return refuseCast(def, "target");
      const tp = targetPos(target);
      const d = Math.hypot(tp.x - P.x, tp.y - P.y);
      G.target = target;
      if (d > def.range) {
        if (aimCtx) return refuseCast(def, "range");
        // Tap-cast out of range: walk into range, cast on arrival (§3.3).
        G.pendingSkill = { def, target, t: 0 };
        walkToPx(tp.x, tp.y);
        return true;
      }
      startCast(def, { angle: angleToPoint(tp.x, tp.y), target });
      return true;
    }

    if (def.target_type === "area") {
      let center;
      if (def.vfx.center === "self") {
        center = { x: P.x, y: P.y };
      } else if (aimCtx && aimCtx.point) {
        const dx = aimCtx.point.x - P.x, dy = aimCtx.point.y - P.y;
        const d = Math.hypot(dx, dy) || 1;
        const cl = Math.min(d, def.range);
        center = { x: P.x + dx / d * cl, y: P.y + dy / d * cl };
      } else if (targetAlive(G.target)) {
        center = targetPos(G.target);
      } else {
        const a = facingAngle() * Math.PI / 180;
        center = { x: P.x + Math.cos(a) * 140, y: P.y + Math.sin(a) * 140 };
      }
      const angle = aimCtx && aimCtx.angle !== undefined ? aimCtx.angle
        : angleToPoint(center.x, center.y);
      startCast(def, { angle, center });
      return true;
    }

    if (def.target_type === "self") {
      // Thân pháp (spec §6.2): no target needed; the cast itself carries
      // the player forward (dash applied in updateSkills at the hit
      // moment, distance = def.range). Aim sets the dash direction.
      let angle;
      if (aimCtx && aimCtx.angle !== undefined) angle = aimCtx.angle;
      else angle = facingAngle();
      startCast(def, { angle });
      return true;
    }
    return false;
  }

  function interruptCast(msg) {
    const c = G.casting;
    if (!c) return;
    const refund = Math.floor(c.def.mana_cost / 2);
    G.player.mp = Math.min(G.player.maxMp, G.player.mp + refund);
    G.skillRt[c.def.skill_id].cdReadyAt = S.t + 2.0; // short cooldown (§3.4)
    G.casting = null;
    if (msg) addFloatingText(P.x, P.y - 95, msg, "#ff8a65");
  }

  function finishCast(c) {
    G.skillRt[c.def.skill_id].cdReadyAt = S.t + c.def.cooldown;
    G.casting = null;
  }

  function applySkillHit(c) {
    const def = c.def;
    if (netOn() && c.seq) {
      if (c.serverRejected) return; // server said no: no damage, no VFX hit
      // GD3: damage is whatever the server computed for this intent.
      // The result normally arrived during the cast animation; if it
      // has not, netApplyCastResult applies it the moment it lands.
      const res = G.onlineResults.get(c.seq);
      if (res) {
        G.onlineResults.delete(c.seq);
        if (res.ok) {
          applyServerHits(res.hits);
          // Keep the local ground VFX so the cast still reads on screen.
          if (def.target_type === "area") {
            const ctr = c.center || { x: P.x, y: P.y };
            G.groundVfx.push({ type: "circle", x: ctr.x, y: ctr.y, r: def.vfx.radius || def.range, color: (def.vfx && def.vfx.color) || "rgba(255,255,255,0.2)", border: (def.vfx && def.vfx.border) || "rgba(255,255,255,0.8)", t: 0, dur: 0.5 });
          }
        }
        // Rejected casts apply nothing; feedback was already shown by
        // netApplyCastResult and resources were re-synced from you_state.
      } else {
        c.awaitingServer = true;
      }
      return;
    }
    const rawAtk = evalDamageFormula(def.damage, G.player.atk);
    const hitOne = (kind, ref, x, y) => {
      if (kind === "boss") damageBoss(G.boss, rawAtk);
      else damageMonster(ref, rawAtk);
      createAttackSlash(P.x, P.y, x, y);
    };
    let fxX = P.x, fxY = P.y;

    if (def.target_type === "directional") {
      const a = c.angle;
      const check = (x, y) => {
        const d = Math.hypot(x - P.x, y - P.y);
        if (d > def.range + 30) return false;
        let diff = Math.abs(angleToPoint(x, y) - a) % 360;
        if (diff > 180) diff = 360 - diff;
        return diff <= 42;
      };
      for (const m of G.monsters.values()) if (!m.isDead && check(m.x, m.y)) hitOne("monster", m, m.x, m.y);
      if (G.boss && !G.boss.isDead && check(G.boss.x, G.boss.y)) {
        hitOne("boss", null, G.boss.x, G.boss.y);
      }
      const rad = a * Math.PI / 180;
      fxX = P.x + Math.cos(rad) * def.range * 0.55;
      fxY = P.y + Math.sin(rad) * def.range * 0.55;
      if (thaicucFxImg) G.castBursts.push({ img: thaicucFxImg, x: fxX, y: fxY, r: 95, t: 0, dur: 0.45 });
      G.groundVfx.push({ type: "circle", x: fxX, y: fxY, r: 80, color: "rgba(255, 220, 120, 0.20)", border: "rgba(255, 230, 150, 0.8)", t: 0, dur: 0.4 });
    } else if (def.target_type === "single") {
      const tp = targetPos(c.target) || targetPos(G.target);
      if (tp) {
        fxX = tp.x; fxY = tp.y;
        if (c.target && c.target.kind === "boss") hitOne("boss", null, tp.x, tp.y);
        else if (c.target && c.target.kind === "monster" && !c.target.m.isDead) hitOne("monster", c.target.m, tp.x, tp.y);
        G.groundVfx.push({ type: "circle", x: fxX, y: fxY, r: 55, color: def.vfx.color || "rgba(255,255,255,0.2)", border: def.vfx.border || "rgba(255,255,255,0.8)", t: 0, dur: 0.4 });
      }
    } else if (def.target_type === "area") {
      const ctr = c.center || { x: P.x, y: P.y };
      const radius = def.vfx.radius || def.range;
      fxX = ctr.x; fxY = ctr.y;
      for (const m of G.monsters.values()) {
        if (!m.isDead && Math.hypot(m.x - ctr.x, m.y - ctr.y) <= radius) hitOne("monster", m, m.x, m.y);
      }
      if (G.boss && !G.boss.isDead &&
          Math.hypot(G.boss.x - ctr.x, G.boss.y - ctr.y) <= radius + 40) {
        hitOne("boss", null, G.boss.x, G.boss.y);
      }
      G.groundVfx.push({ type: "circle", x: fxX, y: fxY, r: radius, color: def.vfx.color || "rgba(255,255,255,0.2)", border: def.vfx.border || "rgba(255,255,255,0.8)", t: 0, dur: 0.5 });
    } else if (def.target_type === "self") {
      // Thân pháp deals no damage; a wind ring at the feet marks the dash.
      G.groundVfx.push({ type: "circle", x: P.x, y: P.y, r: 62, color: def.vfx.color || "rgba(255,255,255,0.2)", border: def.vfx.border || "rgba(255,255,255,0.8)", t: 0, dur: 0.4 });
    }
  }

  // ---- Hold-aim (spec §3.2: hold >= 180ms enters AIMING)
  function beginAim(def) {
    const p = G.player;
    if (G.dialogue.open || p.isDead || G.casting) return false;
    if (blockedBy(def)) return false;
    const a = facingAngle();
    const rad = a * Math.PI / 180;
    G.aim = {
      def, angle: a, cancel: false,
      point: { x: P.x + Math.cos(rad) * def.range * 0.6, y: P.y + Math.sin(rad) * def.range * 0.6 },
    };
    return true;
  }
  function updateAimVector(dx, dy) {
    if (!G.aim) return;
    const len = Math.hypot(dx, dy);
    if (len < 6) return;
    const def = G.aim.def;
    G.aim.angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const worldLen = Math.min(def.range, len / (window.TL2 ? (TL2.state().zoom || 1) : 1) * 2.2);
    const rad = G.aim.angle * Math.PI / 180;
    G.aim.point = { x: P.x + Math.cos(rad) * worldLen, y: P.y + Math.sin(rad) * worldLen };
  }
  function releaseAim(castIt) {
    if (!G.aim) return false;
    const { def, angle, point } = G.aim;
    G.aim = null;
    if (!castIt) return false;
    return tryCast(def, { angle, point });
  }

  // ---- Dodge & Defend (spec §5.3)
  const DODGE_COOLDOWN = 3.0;   // PROVISIONAL
  const DODGE_DISTANCE = 150;   // PROVISIONAL, over 0.22s
  function doDodge() {
    const p = G.player;
    if (G.dialogue.open || p.isDead || G.casting || G.dodge) return false;
    if (S.t < G.dodgeReadyAt) { flashButton("dodge", "on-cd", 300); return false; }
    G.aim = null;
    const rad = facingAngle() * Math.PI / 180;
    G.dodge = { t: 0, dur: 0.22, dx: Math.cos(rad), dy: Math.sin(rad) };
    G.dodgeReadyAt = S.t + DODGE_COOLDOWN;
    P.path = [];
    return true;
  }
  function setDefend(on) {
    if (on && (G.dialogue.open || G.player.isDead || G.casting)) on = false;
    G.defending = !!on;
  }

  const MOVE_KEY_CODES = new Set([
    "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  ]);

  // ---- Per-frame skill-system update
  function updateSkills(dt) {
    const p = G.player;
    if (!p.isDead && !netOn()) p.mp = Math.min(p.maxMp, p.mp + p.mpRegen * dt); // GD3: server regens MP online

    // WASD / arrow-key movement vector -> main.js manual control.
    if (window.TL2 && TL2.setManualInput) {
      if (G.moveKeys.size && !G.dialogue.open && !p.isDead) {
        let vx = 0, vy = 0;
        if (G.moveKeys.has("KeyA") || G.moveKeys.has("ArrowLeft")) vx -= 1;
        if (G.moveKeys.has("KeyD") || G.moveKeys.has("ArrowRight")) vx += 1;
        if (G.moveKeys.has("KeyW") || G.moveKeys.has("ArrowUp")) vy -= 1;
        if (G.moveKeys.has("KeyS") || G.moveKeys.has("ArrowDown")) vy += 1;
        const len = Math.hypot(vx, vy);
        if (len > 0) TL2.setManualInput(vx / len, vy / len, 218);
      } else if (!G.joyActive) {
        // Joystick releases clear manual input themselves; the keyboard
        // path only clears when no key is held AND the stick is idle.
        TL2.setManualInput(null);
      }
    }
    if (G.target && !targetAlive(G.target)) G.target = null;

    // Pending walk-into-range cast
    if (G.pendingSkill) {
      const ps = G.pendingSkill;
      ps.t += dt;
      const tp = targetPos(ps.target);
      if (!tp || ps.t > 7 || G.casting || p.isDead) {
        G.pendingSkill = null;
      } else if (Math.hypot(tp.x - P.x, tp.y - P.y) <= ps.def.range) {
        G.pendingSkill = null;
        tryCast(ps.def, null);
      }
    }

    // Dodge dash motion
    if (G.dodge) {
      const dg = G.dodge;
      dg.t += dt;
      const stepLen = (DODGE_DISTANCE / dg.dur) * dt;
      if (window.TL2 && TL2.stepPlayerPx) TL2.stepPlayerPx(dg.dx * stepLen, dg.dy * stepLen);
      if (dg.t >= dg.dur) G.dodge = null;
    }

    // Casting progression: the hit lands mid-F5 (hit_phase), per spec §6.2.
    if (G.casting) {
      const c = G.casting;
      c.t += dt;
      const hitT = ((c.def.animation.hit_phase - 0.5) / 8) * c.def.cast_time;
      // Phi Long Cước: the cast itself carries the player to the target.
      if (c.def.skill_id === "sk_philong_cuoc" && !c.dashed && c.t >= hitT * 0.45) {
        c.dashed = true;
        const tp = targetPos(c.target);
        if (tp && window.TL2 && TL2.stepPlayerPx) {
          const dx = tp.x - P.x, dy = tp.y - P.y;
          const d = Math.hypot(dx, dy) || 1;
          const stop = Math.max(0, d - 58);
          TL2.stepPlayerPx(dx / d * stop, dy / d * stop);
          if (window.TL2 && TL2.setFacing) TL2.setFacing(dirNameForAngle(c.angle));
        }
      }
      // Thiên Phong Bộ (self): the cast carries the player forward along
      // the cast angle by def.range px, fired just before the hit moment.
      if (c.def.target_type === "self" && !c.dashed && c.t >= hitT * 0.4) {
        c.dashed = true;
        if (window.TL2 && TL2.stepPlayerPx) {
          const rad = c.angle * Math.PI / 180;
          TL2.stepPlayerPx(Math.cos(rad) * c.def.range, Math.sin(rad) * c.def.range);
          if (TL2.setFacing) TL2.setFacing(dirNameForAngle(c.angle));
        }
      }
      if (!c.hitApplied && c.t >= hitT) {
        c.hitApplied = true;
        applySkillHit(c);
      }
      if (c.t >= c.def.cast_time) finishCast(c);
    }

    for (let i = G.castBursts.length - 1; i >= 0; i--) {
      const b = G.castBursts[i];
      b.t += dt;
      if (b.t >= b.dur) G.castBursts.splice(i, 1);
    }
  }

  // ---- Cast frame for main.js drawPlayer (spec §10: while casting, the
  // pack's frames are the standard and no sword is drawn over them).
  function drawCastFrame(ctx) {
    const c = G.casting;
    if (!c) return false;
    const pack = PACKS[c.def.animation.pack];
    if (!pack || !pack.img) return false;
    const frame = Math.min(7, Math.floor(c.t / c.def.cast_time * 8));
    const disp = pack.disp;
    ctx.drawImage(pack.img, frame * 512, c.row * 512, 512, 512,
      P.x - (pack.pivot[0] / 512) * disp, P.y - (pack.pivot[1] / 512) * disp, disp, disp);
    return true;
  }
  function isCasting() { return !!G.casting; }
  function movementLocked() { return !!G.casting || G.defending; }

  // ---- Context interact (spec §5.4 + standing NPC-touch law: near opens
  // at once, far walks over and opens exactly once on arrival — both are
  // handlePointerClick's existing branches, reused verbatim).
  function findContextTarget() {
    let best = null, bestD = 700;
    for (const o of S.objects) {
      if (!o.actor && o.id !== "dais_qt") continue;
      const d = Math.hypot(P.x - o.anchor[0], P.y - o.anchor[1]);
      if (d < bestD) { bestD = d; best = { x: o.anchor[0], y: o.anchor[1], label: o.actor ? o.actor.label : "Đài Truyền Tống" }; }
    }
    const q = currentQuest();
    if (q && q.id === "q4_thu_thap_linh_thao" && G.questState === "active") {
      for (const t of q.targets) {
        if (G.gatheredNodes.has(t.object)) continue;
        const d = Math.hypot(P.x - t.anchor_px[0], P.y - t.anchor_px[1]);
        if (d < bestD) { bestD = d; best = { x: t.anchor_px[0], y: t.anchor_px[1], label: "Linh Thảo" }; }
      }
    }
    if (q && q.id === "q11_thu_thap_viem_tinh" && G.questState === "active") {
      for (const t of q.targets) {
        if (G.gatheredNodes.has(t.object)) continue;
        const d = Math.hypot(P.x - t.anchor_px[0], P.y - t.anchor_px[1]);
        if (d < bestD) { bestD = d; best = { x: t.anchor_px[0], y: t.anchor_px[1], label: "Viêm Tinh Thạch" }; }
      }
    }
    return best;
  }
  function pressInteract() {
    if (G.dialogue.open) return false;
    const t = findContextTarget();
    if (!t) return false;
    return handlePointerClick(t.x, t.y, null);
  }

  // --------------------------------------------------------------------------
  // Monster AI (§28)
  // --------------------------------------------------------------------------
  function updateMonsters(dt) {
    if (S.map !== "island" && S.map !== "xichviem") return;

    for (const [id, m] of G.monsters.entries()) {
      if (m.isDead) continue;
      m.stateT += dt;
      if (m.hitFlashT > 0) m.hitFlashT -= dt;
      if (m.cooldownT > 0) m.cooldownT -= dt;

      const distToPlayer = Math.hypot(P.x - m.x, P.y - m.y);
      const isXvMon = (m.cfgKey === "hoatinh" || m.cfgKey === "hoanhamlang" || m.cfgKey === "viemnham" || m.cfgKey === "xichviem_elite");

      // AI States: IDLE, CHASE, TELEGRAPH, ATTACK, HIT, DEATH
      if (m.state === "IDLE") {
        m.animFrame = isXvMon ? (Math.floor(S.t * 3) % 2) : (Math.floor(S.t * 3) % 4);
        if (distToPlayer <= m.cfg.aggroRadius && !G.player.isDead) {
          m.state = "CHASE";
          m.stateT = 0;
        }
      } else if (m.state === "CHASE") {
        m.animFrame = isXvMon ? (2 + (Math.floor(S.t * 5) % 2)) : (4 + (Math.floor(S.t * 6) % 4));
        // Move towards player
        if (distToPlayer > m.cfg.aggroRadius * 1.8) {
          // Player fled out of chase radius, return home
          m.state = "IDLE";
          m.x = m.homeX; m.y = m.homeY;
          m.obj.anchor[0] = m.homeX; m.obj.anchor[1] = m.homeY;
          if (!netOn()) m.hp = Math.min(m.maxHp, m.hp + 20); // GD3: HP is the server's online
        } else if (distToPlayer <= m.cfg.attackRange && m.cooldownT <= 0) {
          // Check elite skill
          const isElite = (m.cfgKey === "thachve_elite" || m.cfgKey === "xichviem_elite");
          if (isElite && S.t - m.skillT > m.cfg.skillCooldown) {
            m.isUsingSkill = true;
            m.state = "TELEGRAPH";
            m.stateT = 0;
            m.telegraphDur = m.cfg.skillTelegraphDuration;
            m.skillT = S.t;
            // Ground warning circle
            G.groundVfx.push({
              type: "circle",
              x: m.x, y: m.y,
              r: m.cfg.skillRadius,
              t: 0,
              dur: m.telegraphDur,
              color: "rgba(255, 120, 30, 0.45)",
              border: "rgba(255, 180, 50, 0.85)",
            });
          } else {
            m.isUsingSkill = false;
            m.state = "TELEGRAPH";
            m.stateT = 0;
            m.telegraphDur = m.cfg.telegraphDuration;
          }
        } else {
          // Step towards player along walkable direction
          const speed = m.cfg.speed * dt;
          const dx = P.x - m.x, dy = P.y - m.y;
          const d = Math.hypot(dx, dy);
          if (d > 1) {
            m.x += (dx / d) * speed;
            m.y += (dy / d) * speed;
            m.obj.anchor[0] = m.x;
            m.obj.anchor[1] = m.y;
          }
        }
      } else if (m.state === "TELEGRAPH") {
        m.animFrame = isXvMon ? 4 : (m.cfgKey === "trucyeu" ? 12 : (m.cfgKey === "linhlang" ? 4 : 2));
        // Wind-up pause so player can react and dodge (§28)
        if (m.stateT >= m.telegraphDur) {
          m.state = "ATTACK";
          m.stateT = 0;
        }
      } else if (m.state === "ATTACK") {
        m.animFrame = isXvMon ? 5 : (m.cfgKey === "trucyeu" ? 8 + Math.min(3, Math.floor(m.stateT * 7)) :
                      (m.cfgKey === "linhlang" ? 4 : 3));
        // Damage window: only damages if player is STILL in range at attack moment! (§28)
        if (m.stateT < 0.15) {
          const isElite = (m.cfgKey === "thachve_elite" || m.cfgKey === "xichviem_elite");
          if (m.isUsingSkill && isElite) {
            if (distToPlayer <= m.cfg.skillRadius) {
              const kx = (P.x - m.x) / (distToPlayer || 1) * 60;
              const ky = (P.y - m.y) / (distToPlayer || 1) * 60;
              damagePlayer(m.cfg.skillDamage, m.name, { dx: kx, dy: ky }, m.id);
            }
          } else {
            if (distToPlayer <= m.cfg.attackRange + 15) {
              damagePlayer(m.cfg.atk, m.name, null, m.id);
            }
          }
        }
        if (m.stateT >= 0.45) {
          m.state = "CHASE";
          m.cooldownT = m.cfg.attackCooldown;
        }
      } else if (m.state === "HIT") {
        m.animFrame = isXvMon ? 6 : (m.cfgKey === "trucyeu" ? 14 : (m.cfgKey === "linhlang" ? 5 : 4));
        if (m.stateT >= 0.3) {
          m.state = "CHASE";
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Boss AI (§29 + §G.3: Bạch Hổ Sơn Quân 3 Phase)
  // --------------------------------------------------------------------------
  function updateBoss(dt) {
    if ((S.map !== "hauson" && S.map !== "xichviem") || !G.boss) return;
    const b = G.boss;
    if (b.isDead) return;

    b.stateT += dt;
    if (b.hitFlashT > 0) b.hitFlashT -= dt;
    if (b.cooldownT > 0) b.cooldownT -= dt;
    if (b.roarCooldownT > 0) b.roarCooldownT -= dt;
    if (b.dashCooldownT > 0) b.dashCooldownT -= dt;

    const distToPlayer = Math.hypot(P.x - b.x, P.y - b.y);

    // Arena intro trigger (§3.4)
    const arenaTrigger = (S.map === "hauson" && P.y <= 660) || (S.map === "xichviem" && (P.y <= 580 || distToPlayer <= 260));
    if (!G.bossEngaged && arenaTrigger && !G.player.isDead) {
      G.bossEngaged = true;
      b.state = "PHASE_TRANSITION";
      b.stateT = 0;
      b.phaseTransT = 1.6;
      if (b.id === "boss_xichviem") {
        showBanner("XÍCH VIÊM MA QUÂN GIÁNG THẾ", "Giai đoạn 1: Liệt Diệm Trảm — Cận chiến cuồng bạo");
        addFloatingText(b.x, b.y - 120, "TRỜI ĐẤT PHẢI DIỆT!", "#ff3b30");
      } else {
        showBanner("BẠCH HỔ SƠN QUÂN XUẤT THẾ", "Giai đoạn 1: Đánh thường — Vồ cào cận chiến");
        addFloatingText(b.x, b.y - 120, "ROARRRR!", "#ffd54f");
      }
    }

    if (!G.bossEngaged) {
      b.state = "IDLE";
      b.animFrame = Math.floor(S.t * 4) % 4;
      return;
    }

    // Phase transition lock
    if (b.state === "PHASE_TRANSITION") {
      b.animFrame = 25 + Math.min(3, Math.floor(b.stateT * 3));
      if (b.stateT >= b.phaseTransT) {
        b.state = "MOVE";
        b.stateT = 0;
      }
      return;
    }

    // 3-Phase Decision Tree
    if (b.state === "IDLE" || b.state === "MOVE") {
      b.animFrame = 4 + (Math.floor(S.t * 6) % 4);

      // Phase 3: Lao Bổ Diện Rộng (§3.4)
      if (b.phase >= 3 && b.dashCooldownT <= 0 && distToPlayer > 130) {
        b.state = "TELEGRAPH_DASH";
        b.stateT = 0;
        b.dashCooldownT = b.cfg.phase3.dashCooldown;
        // Directional charge warning zone
        const dx = P.x - b.x, dy = P.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const targetLen = Math.min(b.cfg.phase3.dashLength, d + 80);
        b.dashStart = { x: b.x, y: b.y };
        b.dashEnd = { x: b.x + (dx / d) * targetLen, y: b.y + (dy / d) * targetLen };
        b.warningLine = {
          x0: b.x, y0: b.y,
          x1: b.dashEnd.x, y1: b.dashEnd.y,
          width: b.cfg.phase3.dashWidth,
          t: 0,
          dur: b.cfg.phase3.dashTelegraph,
        };
        return;
      }

      // Phase 2: Gầm Chấn Động (§3.4)
      if (b.phase >= 2 && b.roarCooldownT <= 0) {
        b.state = "TELEGRAPH_ROAR";
        b.stateT = 0;
        b.roarCooldownT = b.cfg.phase2.roarCooldown;
        b.warningCircle = {
          x: b.x, y: b.y,
          r: b.cfg.phase2.roarRadius,
          t: 0,
          dur: b.cfg.phase2.roarTelegraph,
        };
        return;
      }

      // Phase 1: Basic Swipe
      if (distToPlayer <= b.cfg.attackRange && b.cooldownT <= 0) {
        b.state = "TELEGRAPH_SWIPE";
        b.stateT = 0;
        return;
      }

      // Move towards player in arena
      const speed = b.cfg.speed * dt;
      const dx = P.x - b.x, dy = P.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        b.x += (dx / d) * speed;
        b.y += (dy / d) * speed;
        b.obj.anchor[0] = b.x;
        b.obj.anchor[1] = b.y;
      }
    } else if (b.state === "TELEGRAPH_SWIPE") {
      b.animFrame = 8 + Math.min(1, Math.floor(b.stateT * 3));
      if (b.stateT >= b.cfg.phase1.swipeTelegraph) {
        b.state = "ATTACK_SWIPE";
        b.stateT = 0;
      }
    } else if (b.state === "ATTACK_SWIPE") {
      b.animFrame = 10 + Math.min(2, Math.floor(b.stateT * 7));
      if (b.stateT < 0.15) {
        if (distToPlayer <= b.cfg.phase1.swipeRange) {
          damagePlayer(b.cfg.phase1.swipeDamage, b.name, null, b.id);
        }
      }
      if (b.stateT >= 0.45) {
        b.state = "MOVE";
        b.cooldownT = b.cfg.phase1.swipeCooldown;
      }
    } else if (b.state === "TELEGRAPH_ROAR") {
      b.animFrame = 13 + Math.min(1, Math.floor(b.stateT * 3));
      if (b.warningCircle) b.warningCircle.t = b.stateT;
      if (b.stateT >= b.cfg.phase2.roarTelegraph) {
        b.state = "ATTACK_ROAR";
        b.stateT = 0;
        b.warningCircle = null;
      }
    } else if (b.state === "ATTACK_ROAR") {
      b.animFrame = 15 + Math.min(2, Math.floor(b.stateT * 6));
      // Shockwave burst damage & knockback if caught inside! (§3.4)
      if (b.stateT < 0.15) {
        if (distToPlayer <= b.cfg.phase2.roarRadius) {
          const kx = (P.x - b.x) / (distToPlayer || 1) * b.cfg.phase2.knockbackDist;
          const ky = (P.y - b.y) / (distToPlayer || 1) * b.cfg.phase2.knockbackDist;
          damagePlayer(b.cfg.phase2.roarDamage, b.name, { dx: kx, dy: ky }, b.id);
        }
      }
      if (b.stateT >= 0.60) {
        b.state = "MOVE";
        b.cooldownT = 1.2;
      }
    } else if (b.state === "TELEGRAPH_DASH") {
      b.animFrame = 18 + Math.min(1, Math.floor(b.stateT * 3));
      if (b.warningLine) b.warningLine.t = b.stateT;
      if (b.stateT >= b.cfg.phase3.dashTelegraph) {
        b.state = "ATTACK_DASH";
        b.stateT = 0;
        b.warningLine = null;
      }
    } else if (b.state === "ATTACK_DASH") {
      b.animFrame = 20 + Math.min(2, Math.floor(b.stateT * 8));
      // High speed charge forward
      const dashDur = 0.45;
      const progress = Math.min(1.0, b.stateT / dashDur);
      if (b.dashStart && b.dashEnd) {
        b.x = b.dashStart.x + (b.dashEnd.x - b.dashStart.x) * progress;
        b.y = b.dashStart.y + (b.dashEnd.y - b.dashStart.y) * progress;
        b.obj.anchor[0] = b.x;
        b.obj.anchor[1] = b.y;

        // Damage player if caught in dash route
        if (progress < 0.8 && distToPlayer <= b.cfg.phase3.dashWidth * 0.8) {
          damagePlayer(b.cfg.phase3.dashDamage, b.name, null, b.id);
        }
      }
      if (b.stateT >= dashDur) {
        b.state = "MOVE";
        b.cooldownT = 1.4;
      }
    } else if (b.state === "HIT") {
      b.animFrame = 23 + Math.min(1, Math.floor(b.stateT * 6));
      if (b.stateT >= 0.25) {
        b.state = "MOVE";
      }
    }
  }

  // --------------------------------------------------------------------------
  // Render Hooks
  // --------------------------------------------------------------------------
  function renderGroundVFX(ctx, z) {
    // 1. Boss warnings (Circle & Line)
    if (G.boss) {
      if (G.boss.warningCircle) {
        const c = G.boss.warningCircle;
        const progress = Math.min(1.0, c.t / c.dur);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.r * progress, c.r * progress * 0.48, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 40, 20, ${0.25 + 0.25 * progress})`;
        ctx.fill();
        ctx.lineWidth = 4 / z;
        ctx.strokeStyle = `rgba(255, 70, 40, ${0.7 + 0.3 * Math.sin(S.t * 15)})`;
        ctx.stroke();
        ctx.restore();
      }
      if (G.boss.warningLine) {
        const l = G.boss.warningLine;
        const progress = Math.min(1.0, l.t / l.dur);
        ctx.save();
        ctx.lineWidth = l.width;
        ctx.strokeStyle = `rgba(255, 30, 20, ${0.28 + 0.3 * progress})`;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(l.x0, l.y0);
        ctx.lineTo(l.x1, l.y1);
        ctx.stroke();
        // Bright warning edge
        ctx.lineWidth = 3 / z;
        ctx.strokeStyle = "rgba(255, 230, 80, 0.9)";
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Elite monster skill circle
    for (const vfx of G.groundVfx) {
      if (vfx.type === "circle") {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(vfx.x, vfx.y, vfx.r, vfx.r * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = vfx.color;
        ctx.fill();
        ctx.lineWidth = 3 / z;
        ctx.strokeStyle = vfx.border;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Target guidance beacon
    if (G.activeTarget && G.activeTarget.anchor_px && G.activeTarget.map === S.map) {
      const [tx, ty] = G.activeTarget.anchor_px;
      ctx.save();
      const ringR = 25 + Math.sin(S.t * 5) * 8;
      ctx.beginPath();
      ctx.ellipse(tx, ty, ringR, ringR * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 215, 60, 0.25)";
      ctx.fill();
      ctx.lineWidth = 2.5 / z;
      ctx.strokeStyle = "rgba(255, 220, 80, 0.9)";
      ctx.stroke();
      ctx.restore();
    }

    // 4. Selected-target ring (HUD wave, spec §3.3)
    {
      const tp = targetPos(G.target);
      if (tp) {
        const r = G.target.kind === "boss" ? 66 : 34;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(tp.x, tp.y, r + Math.sin(S.t * 6) * 3, (r + Math.sin(S.t * 6) * 3) * 0.45, 0, 0, Math.PI * 2);
        ctx.lineWidth = 3 / z;
        ctx.strokeStyle = "rgba(255, 90, 60, 0.95)";
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(tp.x, tp.y, r * 0.7, r * 0.7 * 0.45, 0, 0, Math.PI * 2);
        ctx.lineWidth = 1.6 / z;
        ctx.strokeStyle = "rgba(255, 200, 120, 0.8)";
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Hold-aim indicator (HUD wave, spec §3.2): shape follows the
    // skill's target_type — wedge for directional, circle for area,
    // line + landing ring for single.
    if (G.aim) {
      const def = G.aim.def;
      const a = G.aim.angle * Math.PI / 180;
      ctx.save();
      if (G.aim.cancel) {
        // Cancel zone (drag slid back to the centre, spec §3.2): the
        // indicator turns red — releasing now cancels with no cost.
        ctx.beginPath();
        ctx.ellipse(P.x, P.y, 52, 27, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 70, 50, 0.20)";
        ctx.fill();
        ctx.lineWidth = 2.5 / z;
        ctx.strokeStyle = "rgba(255, 90, 70, 0.95)";
        ctx.stroke();
      } else if (def.target_type === "directional") {
        ctx.beginPath();
        ctx.moveTo(P.x, P.y);
        ctx.ellipse(P.x, P.y, def.range, def.range * 0.5, 0, a - 0.73, a + 0.73);
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 205, 70, 0.16)";
        ctx.fill();
        ctx.lineWidth = 2.5 / z;
        ctx.strokeStyle = "rgba(255, 215, 90, 0.85)";
        ctx.stroke();
      } else if (def.target_type === "area") {
        const ctr = def.vfx.center === "self" ? { x: P.x, y: P.y } : G.aim.point;
        const radius = def.vfx.radius || def.range;
        ctx.beginPath();
        ctx.ellipse(ctr.x, ctr.y, radius, radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 160, 220, 0.14)";
        ctx.fill();
        ctx.lineWidth = 2.5 / z;
        ctx.strokeStyle = "rgba(255, 190, 110, 0.9)";
        ctx.stroke();
        if (def.vfx.center !== "self") {
          ctx.beginPath();
          ctx.moveTo(P.x, P.y);
          ctx.lineTo(ctr.x, ctr.y);
          ctx.lineWidth = 1.6 / z;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
          ctx.stroke();
        }
      } else { // single: line to the aim point + landing ring
        ctx.beginPath();
        ctx.moveTo(P.x, P.y);
        ctx.lineTo(G.aim.point.x, G.aim.point.y);
        ctx.lineWidth = 2.5 / z;
        ctx.strokeStyle = "rgba(140, 255, 190, 0.75)";
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(G.aim.point.x, G.aim.point.y, 30, 15, 0, 0, Math.PI * 2);
        ctx.lineWidth = 2.5 / z;
        ctx.strokeStyle = "rgba(140, 255, 190, 0.95)";
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function renderWorldVFX(ctx, z) {
    // 0. GD3 remote players (online mode only): simple presence figure
    // — shadow, robe, head, name + HP bar. Positions are the server-
    // relayed reports of the other clients in this map.
    if (G.online) {
      for (const rp of G.remotePlayers.values()) {
        const x = rp.x, y = rp.y;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.30)";
        ctx.beginPath(); ctx.ellipse(x, y, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
        if (!rp.dead) {
          ctx.fillStyle = "#2e7d6b"; // robe
          ctx.beginPath();
          ctx.moveTo(x, y - 52); ctx.lineTo(x + 15, y); ctx.lineTo(x - 15, y);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#f2d5b8"; // head
          ctx.beginPath(); ctx.arc(x, y - 60, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#c9973f"; // conical hat
          ctx.beginPath();
          ctx.moveTo(x - 15, y - 66); ctx.lineTo(x + 15, y - 66); ctx.lineTo(x, y - 78);
          ctx.closePath(); ctx.fill();
        } else {
          ctx.fillStyle = "rgba(120,120,120,0.8)";
          ctx.beginPath(); ctx.ellipse(x, y - 4, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
        }
        // HP bar + name
        const w = 44, frac = rp.maxHp ? Math.max(0, rp.hp / rp.maxHp) : 0;
        ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x - w / 2, y - 92, w, 5);
        ctx.fillStyle = "#69f0ae"; ctx.fillRect(x - w / 2, y - 92, w * frac, 5);
        ctx.font = "11px sans-serif"; ctx.textAlign = "center";
        ctx.fillStyle = "#ffe082";
        ctx.fillText(rp.name || "Đồng môn", x, y - 96);
        ctx.restore();
      }
    }

    // 1. Attack slashes
    for (const s of G.attackSlashes) {
      ctx.save();
      ctx.lineWidth = 8 / z;
      ctx.strokeStyle = `rgba(200, 245, 255, ${1.0 - s.t / s.duration})`;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0 - 45);
      ctx.lineTo(s.x1, s.y1 - 45);
      ctx.stroke();
      ctx.lineWidth = 3 / z;
      ctx.strokeStyle = `rgba(255, 255, 255, ${1.0 - s.t / s.duration})`;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Target exclamation mark "!" or "?" above active target
    if (G.activeTarget && G.activeTarget.anchor_px && G.activeTarget.map === S.map) {
      const [tx, ty] = G.activeTarget.anchor_px;
      const bounce = Math.sin(S.t * 5) * 8;
      const isTurnIn = G.activeTarget.type === "turn_in";
      const markerText = isTurnIn ? "?" : "!";
      const markerColor = isTurnIn ? "#7eff8a" : "#ffd75a";

      ctx.save();
      ctx.font = "bold 28px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const my = ty - 145 + bounce;

      // Glow backing
      ctx.fillStyle = "rgba(16, 34, 38, 0.85)";
      ctx.beginPath();
      ctx.arc(tx, my, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2 / z;
      ctx.strokeStyle = markerColor;
      ctx.stroke();

      ctx.fillStyle = markerColor;
      ctx.fillText(markerText, tx, my + 1);

      // Downward pointer arrow
      ctx.beginPath();
      ctx.moveTo(tx - 8, my + 20);
      ctx.lineTo(tx + 8, my + 20);
      ctx.lineTo(tx, my + 30);
      ctx.closePath();
      ctx.fillStyle = markerColor;
      ctx.fill();

      ctx.restore();
    }

    // 3. Overhead Health Bars for engaged monsters
    for (const [id, m] of G.monsters.entries()) {
      if (m.isDead || m.hp >= m.maxHp) continue;
      const barW = Math.max(50, m.obj.actor.h * 0.45);
      const barH = 7;
      const bx = m.x - barW / 2;
      const by = m.y - m.obj.actor.h - 14;

      ctx.save();
      ctx.fillStyle = "rgba(10, 20, 22, 0.75)";
      ctx.fillRect(bx, by, barW, barH);
      const hpRatio = Math.max(0, m.hp / m.maxHp);
      ctx.fillStyle = hpRatio > 0.4 ? "#ff5252" : "#d50000";
      ctx.fillRect(bx + 1, by + 1, (barW - 2) * hpRatio, barH - 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.restore();
    }

    // 3b. Cast burst FX (pack FX art, e.g. the Thái Cực ring, at hit moment)
    for (const b of G.castBursts) {
      const k = b.t / b.dur;
      const size = b.r * 2 * (0.65 + 0.6 * k);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.drawImage(b.img, b.x - size / 2, b.y - size / 2 - 10, size, size);
      ctx.restore();
    }

    // 4. Floating Combat Damage Numbers
    for (const f of G.floatingTexts) {
      ctx.save();
      ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = f.color;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx.lineWidth = 3;
      ctx.textAlign = "center";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function renderScreenUI(ctx) {
    // Off-screen quest indicator
    if (G.activeTarget && G.activeTarget.anchor_px && G.activeTarget.map === S.map) {
      const [tx, ty] = G.activeTarget.anchor_px;
      const z = zoom();
      const sx = (tx - S.cam.x) * z + VW / 2;
      const sy = (ty - S.cam.y) * z + VH / 2;

      // Check if off screen
      const margin = 45;
      if (sx < margin || sx > VW - margin || sy < margin || sy > VH - margin) {
        const cx = VW / 2, cy = VH / 2;
        const angle = Math.atan2(sy - cy, sx - cx);
        const edgeX = Math.max(margin, Math.min(VW - margin, cx + Math.cos(angle) * (VW / 2 - margin)));
        const edgeY = Math.max(margin, Math.min(VH - margin, cy + Math.sin(angle) * (VH / 2 - margin)));

        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.rotate(angle);

        // Arrow
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fillStyle = "#ffd75a";
        ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.restore();
      }
    }

    // Gathering Progress Bar
    if (G.gathering.active) {
      const p = Math.min(1.0, G.gathering.t / G.gathering.duration);
      const bw = 240, bh = 14;
      const bx = (VW - bw) / 2, by = VH - 150;
      ctx.save();
      ctx.fillStyle = "rgba(16, 34, 38, 0.9)";
      ctx.fillRect(bx - 4, by - 24, bw + 8, bh + 32);
      ctx.strokeStyle = "rgba(212, 175, 55, 0.8)";
      ctx.strokeRect(bx - 4, by - 24, bw + 8, bh + 32);

      ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#fdf6da";
      ctx.textAlign = "center";
      ctx.fillText("Đang thu thập linh thảo...", VW / 2, by - 8);

      ctx.fillStyle = "#263238";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "#4caf50";
      ctx.fillRect(bx, by, bw * p, bh);
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // Actor Drawing Override (Boss & Monster Animations)
  // --------------------------------------------------------------------------
  function drawActor(o, ctx, t) {
    // 1. Boss drawing with animated sheet
    if ((o.id === "boss_bachho" || o.id === "boss_xichviem") && G.boss) {
      const b = G.boss;
      const sheet = o.id === "boss_xichviem"
        ? (S.sprites.boss_xichviem_sheet_v1 || S.sprites["boss_xichviem_sheet_v1"] || o.img)
        : (S.sprites.boss_sheet || S.sprites["boss_bachho_sheet_v1"]);
      if (sheet) {
        const CW = 608, CH = 426, COLS = 6;
        const fi = b.animFrame;
        const col = fi % COLS, row = Math.floor(fi / COLS);
        const dh = b.cfg.h, dw = dh * CW / CH;
        const baseY = b.y;

        ctx.save();
        if (b.hitFlashT > 0) ctx.filter = "brightness(1.5) sepia(1) hue-rotate(320deg) saturate(3)";
        ctx.drawImage(sheet, col * CW, row * CH, CW, CH,
                      b.x - dw / 2, baseY - dh, dw, dh);
        ctx.restore();
        return true;
      }
    }

    // 2. Monster drawing with state frames
    if (G.monsters.has(o.id)) {
      const m = G.monsters.get(o.id);
      const a = o.actor;
      const im = o.img;

      const isXvMon = (m.cfgKey === "hoatinh" || m.cfgKey === "hoanhamlang" || m.cfgKey === "viemnham" || m.cfgKey === "xichviem_elite");
      if (isXvMon) {
        const cellDims = {
          hoatinh: [120, 120],
          hoanhamlang: [160, 140],
          viemnham: [180, 180],
          xichviem_elite: [220, 220]
        };
        const [CW, CH] = cellDims[m.cfgKey] || [120, 120];
        const fi = Math.max(0, Math.min(8, m.animFrame));
        const dh = a.h, dw = dh * CW / CH;
        const baseY = m.y;

        ctx.save();
        if (m.hitFlashT > 0) ctx.filter = "brightness(1.5) sepia(1) hue-rotate(320deg) saturate(3)";
        if (m.isDead && m.stateT > 1.2) ctx.globalAlpha = Math.max(0, 1.0 - (m.stateT - 1.2));
        ctx.drawImage(im, fi * CW, 0, CW, CH,
                      m.x - dw / 2, baseY - dh, dw, dh);
        ctx.restore();
        return true;
      }

      if (m.cfgKey === "trucyeu") {
        const CW = 200, CH = 220, COLS = 4;
        const fi = m.animFrame;
        const col = fi % COLS, row = Math.floor(fi / COLS);
        const dh = a.h, dw = dh * CW / CH;
        const baseY = m.y;

        ctx.save();
        if (m.hitFlashT > 0) ctx.filter = "brightness(1.5) sepia(1) hue-rotate(320deg) saturate(3)";
        if (m.isDead && m.stateT > 1.2) ctx.globalAlpha = Math.max(0, 1.0 - (m.stateT - 1.2));
        ctx.drawImage(im, col * CW, row * CH, CW, CH,
                      m.x - dw / 2, baseY - dh, dw, dh);
        ctx.restore();
        return true;
      } else if (m.cfgKey === "linhlang") {
        const CW = 96, CH = 96, COLS = 8;
        const fi = m.animFrame;
        const dh = a.h, dw = dh * CW / CH;
        const baseY = m.y;

        ctx.save();
        if (m.hitFlashT > 0) ctx.filter = "brightness(1.5) sepia(1) hue-rotate(320deg) saturate(3)";
        if (m.isDead && m.stateT > 1.2) ctx.globalAlpha = Math.max(0, 1.0 - (m.stateT - 1.2));
        ctx.drawImage(im, fi * CW, 0, CW, CH,
                      m.x - dw / 2, baseY - dh, dw, dh);
        ctx.restore();
        return true;
      } else if (m.cfgKey.startsWith("thachve")) {
        const CW = 96, CH = 96;
        const fi = m.animFrame;
        const dh = a.h, dw = dh * CW / CH;
        const baseY = m.y;

        ctx.save();
        if (m.hitFlashT > 0) ctx.filter = "brightness(1.5) sepia(1) hue-rotate(320deg) saturate(3)";
        if (m.isDead && m.stateT > 1.2) ctx.globalAlpha = Math.max(0, 1.0 - (m.stateT - 1.2));
        ctx.drawImage(im, fi * CW, 0, CW, CH,
                      m.x - dw / 2, baseY - dh, dw, dh);
        ctx.restore();
        return true;
      }
    }

    return false; // let main.js draw default
  }

  // --------------------------------------------------------------------------
  // Update Loop
  // --------------------------------------------------------------------------
  function update(dt) {
    if (!G.initialized) return;

    // Check cave exploration in Q5 — guarded: never (re)open while a dialogue
    // is open, and only once per zone-visit. Without the latch, openDialogue()
    // reset lineIdx to 0 on every tick inside the radius and the conversation
    // could never be read to the end (soft-lock).
    const q = currentQuest();
    if (q && q.id === "q5_truy_tim_dau_vet" && G.questState === "active" && G.questProgress === 1) {
      const [cx, cy] = [655, 600]; // Miệng Vân Ẩn Động
      const dCave = Math.hypot(P.x - cx, P.y - cy);
      if (dCave > 110) G.caveMouthArmed = true; // left the mouth area: re-arm
      if (dCave <= 80 && G.caveMouthArmed && !G.dialogue.open) {
        G.caveMouthArmed = false;
        const d = GAME_DATA.dialogues.q5_cave_mouth;
        openDialogue(d.name, d.role, d.lines, d.btn, () => {
          G.questState = "ready_to_turn_in";
          advanceQuest();
        }, "cave_mouth");
      }
    }

    // Auto-walk interaction completion
    if (G.pendingInteract) {
      const pi = G.pendingInteract;
      const d = Math.hypot(P.x - pi.standPx[0], P.y - pi.standPx[1]);
      if (d <= 35 || (!P.moving && P.path.length === 0)) {
        const cb = pi.callback;
        G.pendingInteract = null;
        if (cb) cb();
      }
    }

    // Gathering channel update
    if (G.gathering.active) {
      G.gathering.t += dt;
      if (G.gathering.t >= G.gathering.duration) {
        finishGathering();
      }
    }

    // Player attack animation
    if (G.player.isAttacking) {
      G.player.atkAnimT += dt;
      if (G.player.atkAnimT >= 0.25) {
        G.player.isAttacking = false;
      }
    }
    if (G.player.hitFlashT > 0) G.player.hitFlashT -= dt;

    // Player death timer
    if (G.player.isDead) {
      G.player.deathT -= dt;
      if (G.player.deathT <= 0) {
        respawnPlayer();
      }
    }

    // Combat HUD systems (skills, MP regen, dodge, pending approach casts)
    updateSkills(dt);

    // Update monsters & boss
    updateMonsters(dt);
    updateBoss(dt);

    // Update VFX & floating text
    for (let i = G.floatingTexts.length - 1; i >= 0; i--) {
      const f = G.floatingTexts[i];
      f.y -= dt * 32;
      f.t += dt;
      if (f.t >= f.duration) G.floatingTexts.splice(i, 1);
    }
    for (let i = G.groundVfx.length - 1; i >= 0; i--) {
      const v = G.groundVfx[i];
      v.t += dt;
      if (v.t >= v.dur) G.groundVfx.splice(i, 1);
    }
    for (let i = G.attackSlashes.length - 1; i >= 0; i--) {
      const s = G.attackSlashes[i];
      s.t += dt;
      if (s.t >= s.duration) G.attackSlashes.splice(i, 1);
    }

    // Banner update
    if (G.banner.t > 0) {
      G.banner.t -= dt;
      const el = document.getElementById("gameBanner");
      if (el) el.style.opacity = Math.min(1.0, G.banner.t * 2);
    }

    // Sync HUD status
    syncHUDStats();
  }

  // --------------------------------------------------------------------------
  // Click & Pointer Input (§3.1, §3.2)
  // --------------------------------------------------------------------------
  function handlePointerClick(px, py, e) {
    if (G.dialogue.open) return true;

    // 1. Check if clicking on an attackable monster/boss
    for (const [id, m] of G.monsters.entries()) {
      if (m.isDead) continue;
      const d = Math.hypot(px - m.x, py - (m.y - m.obj.actor.h * 0.4));
      if (d <= Math.max(45, m.obj.actor.h * 0.35)) {
        // Tapping a monster also SELECTS it as the skill target (spec §3.3).
        G.target = { kind: "monster", m };
        const playerDist = Math.hypot(P.x - m.x, P.y - m.y);
        if (playerDist <= G.player.atkRange) {
          playerAttack();
        } else {
          // Walk into attack range
          walkToPx(m.x, m.y);
        }
        return true;
      }
    }

    if (G.boss && !G.boss.isDead && (S.map === "hauson" || S.map === "xichviem")) {
      const b = G.boss;
      const d = Math.hypot(px - b.x, py - (b.y - b.cfg.h * 0.4));
      if (d <= 140) {
        G.target = { kind: "boss" };
        const playerDist = Math.hypot(P.x - b.x, P.y - b.y);
        if (playerDist <= G.player.atkRange + 60) {
          playerAttack();
        } else {
          walkToPx(b.x, b.y);
        }
        return true;
      }
    }

    // 2. Check if clicking on an herb / mineral node
    const q = currentQuest();
    if (q && q.id === "q4_thu_thap_linh_thao" && G.questState === "active") {
      for (const t of q.targets) {
        if (G.gatheredNodes.has(t.object)) continue;
        const [hx, hy] = t.anchor_px;
        if (Math.hypot(px - hx, py - hy) <= 55) {
          if (Math.hypot(P.x - hx, P.y - hy) <= 85) {
            startGathering(t.object);
          } else {
            walkToPx(t.stand_px[0], t.stand_px[1]);
            G.pendingInteract = {
              objId: t.object,
              standPx: t.stand_px,
              callback: () => startGathering(t.object),
            };
          }
          return true;
        }
      }
    }
    if (q && q.id === "q11_thu_thap_viem_tinh" && G.questState === "active") {
      for (const t of q.targets) {
        if (G.gatheredNodes.has(t.object)) continue;
        const [hx, hy] = t.anchor_px;
        if (Math.hypot(px - hx, py - hy) <= 55) {
          if (Math.hypot(P.x - hx, P.y - hy) <= 85) {
            startGathering(t.object);
          } else {
            walkToPx(t.stand_px[0], t.stand_px[1]);
            G.pendingInteract = {
              objId: t.object,
              standPx: t.stand_px,
              callback: () => startGathering(t.object),
            };
          }
          return true;
        }
      }
    }

    // 3. Check if clicking on an NPC / Dais object — the NEAREST candidate
    // wins. The dais has a 165px tap radius (w=330) and Chấp Sự stands only
    // ~161px from its anchor, so first-match iteration let the dais steal
    // every tap aimed at him and the Q1 turn-in could never be talked to.
    let bestObj = null, bestD = Infinity;
    for (const o of S.objects) {
      if (!o.actor && o.id !== "dais_qt") continue;
      const d = Math.hypot(px - o.anchor[0], py - o.anchor[1]);
      // Actor objects (NPCs) carry no `w` in Map_Objects — default their tap
      // radius, otherwise o.w * 0.5 is NaN and no NPC tap ever registers.
      const tapRadius = Math.max(45, ((o.w || 100) * 0.5));
      if (d <= tapRadius && d < bestD) { bestObj = o; bestD = d; }
    }
    if (bestObj) {
      const o = bestObj;
      {
        const pDist = Math.hypot(P.x - o.anchor[0], P.y - o.anchor[1]);
        if (pDist <= 115) {
          // Close: open dialogue immediately (§3.1)
          triggerInteraction(o.id);
        } else {
          // Far: walk to stand position, then open once (§3.1)
          let standPx = [o.anchor[0], o.anchor[1] + 45];
          // Look up stand_px from Map_Quests
          if (G.questData) {
            for (const qu of G.questData.quests) {
              if (qu.giver.object === o.id && qu.giver.stand_px) standPx = qu.giver.stand_px;
              for (const tg of qu.targets) {
                if (tg.object === o.id && tg.stand_px) standPx = tg.stand_px;
              }
            }
          }
          walkToPx(standPx[0], standPx[1]);
          G.pendingInteract = {
            objId: o.id,
            standPx: standPx,
            callback: () => triggerInteraction(o.id),
          };
        }
        return true;
      }
    }

    return false; // let main.js walk
  }

  // --------------------------------------------------------------------------
  // HUD & UI Construction
  // --------------------------------------------------------------------------
  function buildHUD() {
    // 1. Quest Tracker Card
    let tracker = document.getElementById("questTracker");
    if (!tracker) {
      tracker = document.createElement("div");
      tracker.id = "questTracker";
      tracker.className = "quest-tracker-hud";
      document.body.appendChild(tracker);
      tracker.addEventListener("click", () => {
        // Clicking tracker walks player toward current target
        if (G.activeTarget && G.activeTarget.stand_px && G.activeTarget.map === S.map) {
          walkToPx(G.activeTarget.stand_px[0], G.activeTarget.stand_px[1]);
        }
      });
    }

    // 2. Character plate (spec §4.1): name, level from the EXISTING
    // xp/level model, HP bar + %, MP bar + %. Static DOM, updated in
    // place by syncHUDStats (no per-frame innerHTML churn).
    let status = document.getElementById("playerStatus");
    if (!status) {
      status = document.createElement("div");
      status.id = "playerStatus";
      status.className = "player-status-hud";
      status.innerHTML = `
        <div class="ps-header">
          <span class="ps-name">HÀ NHÂN</span>
          <span class="ps-level" id="psLevel"></span>
        </div>
        <div class="ps-bar-bg hp">
          <div class="ps-bar-fill" id="psHpFill"></div>
          <span class="ps-bar-text" id="psHpText"></span>
        </div>
        <div class="ps-bar-bg mp">
          <div class="ps-bar-fill mp" id="psMpFill"></div>
          <span class="ps-bar-text" id="psMpText"></span>
        </div>
        <div class="ps-herb-count" id="psSub"></div>
      `;
      document.body.appendChild(status);
    }

    // 3. Boss Health Bar (top center)
    let bossBar = document.getElementById("bossStatus");
    if (!bossBar) {
      bossBar = document.createElement("div");
      bossBar.id = "bossStatus";
      bossBar.className = "boss-status-hud";
      bossBar.style.display = "none";
      document.body.appendChild(bossBar);
    }

    // 4. Combat cluster (spec §2 zone F + §5): big basic attack, SK1–SK4,
    // ULT, dodge, defend, context interact. Id "mobileAtkBtn" is kept on
    // the basic-attack button (the verification driver taps it). Every
    // icon is real art: skill icons are cropped from the packs' own apex
    // frames, the rest are drawn icons — no emoji, no glyph art.
    buildCombatCluster();
    buildSkillPanel();

    // 4b. Floating-origin joystick (spec §2 zone E): touch drags in the
    // bottom-left region drive the player; a touch that never drags is
    // replayed as a normal canvas tap so tap-to-move keeps working.
    buildJoystick();

    // 5. Game Center Banner
    let banner = document.getElementById("gameBanner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "gameBanner";
      banner.className = "game-banner-hud";
      document.body.appendChild(banner);
    }

    // 6. Settings / Reset Button
    let rstBtn = document.getElementById("resetBtn");
    if (!rstBtn) {
      rstBtn = document.createElement("button");
      rstBtn.id = "resetBtn";
      rstBtn.className = "chip reset-btn";
      rstBtn.innerHTML = "↺ Chơi lại";
      rstBtn.title = "Chơi lại từ đầu (xóa tiến độ lưu)";
      const topR = document.querySelector(".hud-top-right");
      if (topR) topR.parentElement.appendChild(rstBtn);
      rstBtn.addEventListener("click", () => {
        if (confirm("Bạn có chắc chắn muốn chơi lại từ đầu không?")) {
          resetGame();
        }
      });
    }

    // PC keys (spec §9.1): WASD move, J basic, Q/E/R/F skills, Space
    // dodge, Shift defend (hold), G ultimate, Tab target. While a
    // dialogue is open it takes the keys (F/Enter/Space advance it) —
    // the F = SK3 binding applies to combat, not to modal text.
    window.addEventListener("keydown", e => {
      if (G.dialogue.open) {
        if (e.code === "KeyF" || e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          nextDialogue();
        }
        return;
      }
      if (MOVE_KEY_CODES.has(e.code)) {
        G.moveKeys.add(e.code);
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      switch (e.code) {
        case "KeyJ": playerAttack(); break;
        case "KeyQ": keySkillPress(0); break;
        case "KeyE": keySkillPress(1); break;
        case "KeyR": keySkillPress(2); break;
        case "KeyF": keySkillPress(3); break;
        case "KeyG": keySkillPress(4); break;
        case "Space": e.preventDefault(); doDodge(); break;
        case "ShiftLeft": case "ShiftRight": setDefend(true); break;
        case "Tab": e.preventDefault(); cycleTarget(); break;
        case "Enter":
          // Legacy convenience: interact with the quest target when near.
          if (G.activeTarget && G.activeTarget.anchor_px && G.activeTarget.map === S.map) {
            const [tx, ty] = G.activeTarget.anchor_px;
            if (Math.hypot(P.x - tx, P.y - ty) <= 125) {
              triggerInteraction(G.activeTarget.object || G.activeTarget.name);
            }
          }
          break;
      }
    });
    window.addEventListener("keyup", e => {
      if (MOVE_KEY_CODES.has(e.code)) { G.moveKeys.delete(e.code); return; }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") setDefend(false);
      // Releasing a skill key ends its press: a quick tap casts at once,
      // a held key casts toward the mouse (hold-aim, spec §9.2).
      if (G.keyPress && KEY_TO_SLOT[e.code] !== undefined && KEY_TO_SLOT[e.code] === G.keyPress.slotIdx) {
        const kp = G.keyPress;
        G.keyPress = null;
        clearTimeout(kp.timer);
        if (kp.aiming) releaseAim(true);
        else tryCast(kp.def, null);
      }
    });
    window.addEventListener("pointermove", e => {
      G.mouseClient = { x: e.clientX, y: e.clientY };
      if (G.aim && G.keyPress && G.keyPress.aiming) updateAimToMouse();
    });
    window.addEventListener("blur", () => {
      G.moveKeys.clear();
      setDefend(false);
      if (window.TL2 && TL2.setManualInput) TL2.setManualInput(null);
      if (G.aim) releaseAim(false);
      G.keyPress = null;
    });
  }

  // ---- Skill-button press machine: tap = instant cast, hold >= 180ms =
  // AIMING (drag to aim, release to cast, drag-off/cancel = no cost).
  // Buttons are bound to a SLOT (HUD2): the skill a slot casts is read
  // from G.skillSlots at press time, so panel swaps take effect at once.
  const AIM_CANCEL_RADIUS = 16; // px of drag: inside it, release cancels
  function bindSkillPress(el, slotIdx) {
    let press = null;
    const defNow = () => SKILL_BY_ID[G.skillSlots[slotIdx]];
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch {}
      press = { x: e.clientX, y: e.clientY, aiming: false, dx: 0, dy: 0 };
      press.timer = setTimeout(() => {
        if (press && beginAim(defNow())) press.aiming = true;
      }, 180);
    });
    el.addEventListener("pointermove", e => {
      if (!press) return;
      const dx = e.clientX - press.x, dy = e.clientY - press.y;
      press.dx = dx; press.dy = dy;
      if (press.aiming) {
        // Sliding back inside the cancel radius arms the cancel zone;
        // updateAimVector keeps the last real direction meanwhile.
        if (G.aim) G.aim.cancel = Math.hypot(dx, dy) < AIM_CANCEL_RADIUS;
        if (Math.hypot(dx, dy) >= AIM_CANCEL_RADIUS) updateAimVector(dx, dy);
      }
      else if (Math.hypot(dx, dy) > 26 && beginAim(defNow())) press.aiming = true;
    });
    const end = commit => e => {
      if (!press) return;
      clearTimeout(press.timer);
      const wasAiming = press.aiming;
      const cancelled = wasAiming && Math.hypot(press.dx, press.dy) < AIM_CANCEL_RADIUS;
      const def = defNow();
      press = null;
      if (e) e.preventDefault();
      if (wasAiming) releaseAim(commit && !cancelled);
      else if (commit) tryCast(def, null);
    };
    el.addEventListener("pointerup", end(true));
    el.addEventListener("pointercancel", end(false));
    el.addEventListener("contextmenu", e => e.preventDefault());
  }

  const KEY_TO_SLOT = { KeyQ: 0, KeyE: 1, KeyR: 2, KeyF: 3, KeyG: 4 };
  function keySkillPress(slotIdx) {
    const def = SKILL_BY_ID[G.skillSlots[slotIdx]];
    if (!def || G.keyPress) return;
    const kp = { def, slotIdx, aiming: false };
    kp.timer = setTimeout(() => {
      if (G.keyPress === kp && beginAim(def)) {
        kp.aiming = true;
        updateAimToMouse();
      }
    }, 180);
    G.keyPress = kp;
  }
  function updateAimToMouse() {
    if (!G.aim || !G.mouseClient || !window.TL2) return;
    const s = TL2.state();
    const wx = s.cam[0] + (G.mouseClient.x - window.innerWidth / 2) / s.zoom;
    const wy = s.cam[1] + (G.mouseClient.y - window.innerHeight / 2) / s.zoom;
    const def = G.aim.def;
    const dx = wx - P.x, dy = wy - P.y;
    const d = Math.hypot(dx, dy) || 1;
    G.aim.angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const cl = Math.min(d, def.range);
    G.aim.point = { x: P.x + dx / d * cl, y: P.y + dy / d * cl };
  }

  function makeHudButton(id, cls, icon, label, keyHint, title) {
    const b = document.createElement("button");
    b.id = id;
    b.className = "hud-btn " + cls;
    b.title = title || label;
    b.innerHTML = `
      <span class="hb-ring"></span>
      <img class="hb-icon" src="${icon}" alt="">
      <span class="hb-label">${label}</span>
      ${keyHint ? `<span class="hb-key">${keyHint}</span>` : ""}
      <span class="hb-cd"><span class="hb-cd-text"></span></span>
    `;
    return b;
  }

  const slotBtns = []; // slot index -> button element (SK1..SK4, ULT)
  const SLOT_NAMES = ["SK1", "SK2", "SK3", "SK4", "ULT"];
  // Short button labels per skill (kept terse so the gold frame stays
  // readable at phone size); the full name lives in the title + panel.
  const SKILL_SHORT = {
    sk_thaicuc_chuong: "Thái Cực", sk_kimcang_quyen: "Kim Cang",
    sk_philong_cuoc: "Phi Long", sk_batquai_chuong: "Bát Quái",
    ult_nguhanh_quyen: "Ngũ Hành", sk_hoavan_toan: "Hỏa Vân",
    sk_bangphong_chuong: "Băng Phong", sk_loidinh_kich: "Lôi Đình",
    sk_thienphong_bo: "Thiên Phong", sk_voanh_lienhoan: "Vô Ảnh",
  };
  function refreshSlotButtons() {
    for (const id of Object.keys(btnRefs)) {
      if (SKILL_BY_ID[id]) delete btnRefs[id];
    }
    G.skillSlots.forEach((sid, i) => {
      const b = slotBtns[i];
      if (!b) return;
      const def = SKILL_BY_ID[sid];
      btnRefs[sid] = b;
      const img = b.querySelector(".hb-icon");
      if (img && img.getAttribute("src") !== def.icon) img.src = def.icon;
      const lbl = b.querySelector(".hb-label");
      if (lbl) lbl.textContent = SKILL_SHORT[sid] || def.name_vi;
      b.title = def.name_vi + " (" + SLOT_NAMES[i] + ")";
    });
  }

  function buildCombatCluster() {
    if (document.getElementById("combatCluster")) return;
    const cluster = document.createElement("div");
    cluster.id = "combatCluster";
    cluster.className = "combat-cluster";

    const slotKeys = ["Q", "E", "R", "F", "G"];
    for (let i = 0; i < 5; i++) {
      const isUlt = i === 4;
      const b = makeHudButton(
        isUlt ? "btnUlt" : "btnSkill" + (i + 1),
        (isUlt ? "ult" : "skill sk" + (i + 1)),
        "", "", slotKeys[i], "");
      cluster.appendChild(b);
      slotBtns[i] = b;
      bindSkillPress(b, i);
    }
    refreshSlotButtons();

    const dodge = makeHudButton("btnDodge", "dodge", "assets/hud/icon_dodge.png", "Né", "Space", "Né tránh (Space)");
    dodge.addEventListener("pointerdown", e => { e.preventDefault(); doDodge(); });
    dodge.addEventListener("contextmenu", e => e.preventDefault());
    cluster.appendChild(dodge);
    btnRefs.dodge = dodge;

    const defend = makeHudButton("btnDefend", "defend", "assets/hud/icon_defend.png", "Thủ", "Shift", "Phòng thủ — giữ để đỡ (Shift)");
    defend.addEventListener("pointerdown", e => { e.preventDefault(); setDefend(true); });
    defend.addEventListener("pointerup", () => setDefend(false));
    defend.addEventListener("pointercancel", () => setDefend(false));
    defend.addEventListener("pointerleave", () => setDefend(false));
    defend.addEventListener("contextmenu", e => e.preventDefault());
    cluster.appendChild(defend);
    btnRefs.defend = defend;

    const atk = makeHudButton("mobileAtkBtn", "atk mobile-atk-btn", "assets/hud/icon_basic.png", "Đánh", "J", "Đánh thường (J)");
    atk.addEventListener("pointerdown", e => { e.preventDefault(); playerAttack(); });
    atk.addEventListener("contextmenu", e => e.preventDefault());
    cluster.appendChild(atk);
    btnRefs.atk = atk;

    const interact = makeHudButton("btnInteract", "interact", "assets/hud/icon_interact.png", "Tương tác", "", "Tương tác");
    interact.style.display = "none";
    interact.addEventListener("pointerdown", e => { e.preventDefault(); pressInteract(); });
    interact.addEventListener("contextmenu", e => e.preventDefault());
    cluster.appendChild(interact);
    btnRefs.interact = interact;

    document.body.appendChild(cluster);
  }

  // ---- Skill panel (HUD2, spec §6.3): all ten skills, swap into
  // SK1–SK4, ULT locked. Swapping is refused in combat; a skill's
  // cooldown belongs to the skill, never to the slot.
  function inCombatNow() {
    if (G.casting || G.pendingSkill) return true;
    if (G.target && targetAlive(G.target)) return true;
    if (G.boss && G.bossEngaged && !G.boss.isDead) return true;
    for (const m of G.monsters.values()) {
      if (!m.isDead && Math.hypot(m.x - P.x, m.y - P.y) < 460) return true;
    }
    return false;
  }
  const TARGET_TYPE_VI = {
    single: "Đơn mục tiêu", directional: "Theo hướng",
    area: "Diện rộng", self: "Thân pháp",
  };
  function buildSkillPanel() {
    if (document.getElementById("skillPanelBtn")) return;
    const btn = document.createElement("button");
    btn.id = "skillPanelBtn";
    btn.className = "chip skill-panel-btn";
    btn.textContent = "Kỹ năng";
    btn.title = "Bảng kỹ năng — thay chiêu vào các ô SK1–SK4";
    document.body.appendChild(btn);
    btn.addEventListener("click", () => {
      if (G.skillPanelOpen) closeSkillPanel(); else openSkillPanel();
    });

    const overlay = document.createElement("div");
    overlay.id = "skillPanel";
    overlay.className = "skill-panel-overlay";
    overlay.style.display = "none";
    overlay.innerHTML = `
      <div class="skill-panel-card">
        <div class="skill-panel-head">
          <div class="skill-panel-title">Bảng Kỹ Năng</div>
          <button class="chip skill-panel-close" id="skillPanelClose">Đóng</button>
        </div>
        <div class="skill-panel-note">Chạm nút ô để gắn chiêu vào SK1–SK4. Tuyệt kỹ Ngũ Hành Quyền ở ô ULT là cố định. Chỉ thay được khi ngoài chiến đấu; hồi chiêu tính theo chiêu, không theo ô.</div>
        <div class="skill-panel-list" id="skillPanelList"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("pointerdown", e => { if (e.target === overlay) closeSkillPanel(); });
    overlay.querySelector("#skillPanelClose").addEventListener("click", closeSkillPanel);
  }
  function openSkillPanel() {
    const overlay = document.getElementById("skillPanel");
    if (!overlay) return;
    G.skillPanelOpen = true;
    renderSkillPanel();
    overlay.style.display = "flex";
  }
  function closeSkillPanel() {
    const overlay = document.getElementById("skillPanel");
    if (!overlay) return;
    G.skillPanelOpen = false;
    overlay.style.display = "none";
  }
  function renderSkillPanel() {
    const list = document.getElementById("skillPanelList");
    if (!list) return;
    list.innerHTML = "";
    for (const def of SKILLS) {
      const slotIdx = G.skillSlots.indexOf(def.skill_id);
      const row = document.createElement("div");
      row.className = "skill-row" + (slotIdx >= 0 ? " slotted" : "");
      row.dataset.skillId = def.skill_id;
      const cost = def.energy_cost > 0 ? "Năng lượng 100" : `MP ${def.mana_cost}`;
      const meta = `${TARGET_TYPE_VI[def.target_type] || def.target_type} · ${cost} · Hồi chiêu ${def.cooldown} giây · Sát thương ${def.damage.replace("atk", "công")}`;
      let actions;
      if (def.skill_id === "ult_nguhanh_quyen") {
        actions = `<span class="skill-slot-badge ult">ULT · Cố định</span>`;
      } else if (slotIdx >= 0) {
        actions = `<span class="skill-slot-badge">${SLOT_NAMES[slotIdx]} · Đang gắn</span>`;
      } else {
        actions = `<span class="skill-assign-label">Gắn vào:</span>` +
          [0, 1, 2, 3].map(i =>
            `<button class="skill-assign-btn" data-skill="${def.skill_id}" data-slot="${i}">${SLOT_NAMES[i]}</button>`).join("");
      }
      const actCls = (def.skill_id !== "ult_nguhanh_quyen" && slotIdx < 0)
        ? "skill-row-actions assign" : "skill-row-actions";
      row.innerHTML = `
        <img class="skill-row-icon" src="${def.icon}" alt="">
        <div class="skill-row-main">
          <div class="skill-row-name">${def.name_vi}</div>
          <div class="skill-row-meta">${meta}</div>
        </div>
        <div class="${actCls}">${actions}</div>`;
      list.appendChild(row);
    }
    list.querySelectorAll(".skill-assign-btn").forEach(b => {
      b.addEventListener("click", () => {
        assignSkillToSlot(b.dataset.skill, Number(b.dataset.slot));
      });
    });
  }
  function assignSkillToSlot(skillId, slotIdx) {
    if (slotIdx < 0 || slotIdx > 3) return false; // ULT slot is locked
    const def = SKILL_BY_ID[skillId];
    if (!def || def.energy_cost > 0) return false;
    if (G.skillSlots[slotIdx] === skillId) return true;
    if (inCombatNow()) {
      addFloatingText(P.x, P.y - 95, "Chỉ thay chiêu khi ngoài chiến đấu!", "#ff8a65");
      return false;
    }
    const cur = G.skillSlots.indexOf(skillId);
    if (cur >= 0 && cur < 4) G.skillSlots[cur] = G.skillSlots[slotIdx];
    G.skillSlots[slotIdx] = skillId;
    refreshSlotButtons();
    renderSkillPanel();
    saveState();
    addFloatingText(P.x, P.y - 95, `${def.name_vi} → ${SLOT_NAMES[slotIdx]}`, "#ffd75a");
    return true;
  }

  function buildJoystick() {
    if (document.getElementById("joyPad")) return;
    const pad = document.createElement("div");
    pad.id = "joyPad";
    pad.className = "joy-pad";
    const base = document.createElement("div");
    base.id = "joyBase";
    base.className = "joy-base";
    base.style.display = "none";
    const knob = document.createElement("div");
    knob.className = "joy-knob";
    base.appendChild(knob);
    document.body.appendChild(pad);
    document.body.appendChild(base);

    let joy = null;
    const MAX_PULL = 56;
    pad.addEventListener("pointerdown", e => {
      if (joy) return;
      joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, engaged: false };
      try { pad.setPointerCapture(e.pointerId); } catch {}
    });
    pad.addEventListener("pointermove", e => {
      if (!joy || e.pointerId !== joy.id) return;
      const dx = e.clientX - joy.x0, dy = e.clientY - joy.y0;
      const len = Math.hypot(dx, dy);
      if (!joy.engaged && len > 10) {
        joy.engaged = true;
        G.joyActive = true;
        base.style.display = "block";
        base.style.left = (joy.x0 - 60) + "px";
        base.style.top = (joy.y0 - 60) + "px";
      }
      if (joy.engaged && window.TL2 && TL2.setManualInput) {
        const frac = Math.min(1, len / MAX_PULL);
        const cl = Math.min(len, 44);
        knob.style.transform = `translate(${len ? dx / len * cl : 0}px, ${len ? dy / len * cl : 0}px)`;
        if (frac < 0.16 || len < 0.01) TL2.setManualInput(null);
        else TL2.setManualInput(dx / len, dy / len, Math.round(90 + 128 * frac));
      }
    });
    const end = e => {
      if (!joy || e.pointerId !== joy.id) return;
      const wasEngaged = joy.engaged;
      joy = null;
      G.joyActive = false;
      base.style.display = "none";
      knob.style.transform = "";
      if (window.TL2) {
        if (wasEngaged) TL2.setManualInput(null);
        // A touch that never dragged is a tap: replay it through the
        // game's own tap path (talk / attack / gather / tap-to-move).
        else if (TL2.tapAt) TL2.tapAt(e.clientX, e.clientY);
      }
    };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
  }

  function updateHUDQuestTracker() {
    const el = document.getElementById("questTracker");
    if (!el) return;
    const q = currentQuest();
    if (!q) {
      el.innerHTML = `
        <div class="qt-badge">TIÊN LỘ</div>
        <div class="qt-title">Toàn bộ nhiệm vụ hoàn tất</div>
        <div class="qt-desc">Vertical Slice hoàn thành!</div>
      `;
      return;
    }

    let progressText = "";
    if (G.questState === "not_accepted") {
      progressText = `Tới gặp: ${G.activeTarget ? G.activeTarget.label : "Người giao nhiệm vụ"}`;
    } else if (G.questState === "active") {
      if (q.id === "q3_luyen_kiem_nhap_mon") progressText = `Trúc Yêu: ${G.questProgress}/5`;
      else if (q.id === "q4_thu_thap_linh_thao") progressText = `Linh thảo: ${G.herbsCount}/5`;
      else progressText = q.objective;
    } else if (G.questState === "ready_to_turn_in") {
      progressText = `✓ Sẵn sàng trả nhiệm vụ (${G.activeTarget ? G.activeTarget.label : "Báo công"})`;
    }

    el.innerHTML = `
      <div class="qt-badge">NHIỆM VỤ CHÍNH (${q.n}/${G.questData.quests.length})</div>
      <div class="qt-title">${q.name}</div>
      <div class="qt-desc">${progressText}</div>
      <div class="qt-hint">Nhấn để tự động dẫn đường →</div>
    `;
  }

  function syncHUDStats() {
    // Character plate: update the static DOM in place.
    const ps = document.getElementById("playerStatus");
    if (ps) {
      const p = G.player;
      const lvRow = levelRowForXp(p.xp).row;
      const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
      set("psLevel", el => { el.textContent = realmNameForLevel(p.level, lvRow); });
      set("psHpFill", el => { el.style.width = `${Math.max(0, p.hp / p.maxHp) * 100}%`; });
      set("psHpText", el => {
        el.textContent = `${Math.ceil(p.hp)} / ${p.maxHp} HP · ${Math.round(Math.max(0, p.hp / p.maxHp) * 100)}%`;
      });
      set("psMpFill", el => { el.style.width = `${Math.max(0, p.mp / p.maxMp) * 100}%`; });
      set("psMpText", el => {
        el.textContent = `${Math.floor(p.mp)} / ${p.maxMp} MP · ${Math.round(Math.max(0, p.mp / p.maxMp) * 100)}%`;
      });
      set("psSub", el => { el.textContent = S.map === "xichviem" ? `🔥 Viêm tinh: ${G.questProgress}/5 · EXP: ${p.xp}` : `🌿 Linh thảo: ${G.herbsCount}/5 · EXP: ${p.xp}`; });
    }
    document.body.classList.toggle("dialogue-open", G.dialogue.open);
    syncCombatButtons();

    // Boss Bar
    const bs = document.getElementById("bossStatus");
    if (bs) {
      const showBoss = !!(G.boss && (S.map === "hauson" || S.map === "xichviem") && G.bossEngaged && !G.boss.isDead);
      // Lets the phone layout stack the top HUD rows while the boss bar is up.
      document.body.classList.toggle("boss-active", showBoss);
      if (showBoss) {
        bs.style.display = "block";
        const b = G.boss;
        const ratio = Math.max(0, b.hp / b.maxHp);
        const phaseNames = b.id === "boss_xichviem" ? {
          1: "Giai Đoạn 1: Liệt Diệm Trảm",
          2: "Giai Đoạn 2: Liệt Hỏa Địa Chấn",
          3: "Giai Đoạn 3: Xích Viêm Liêu Nguyên",
        } : {
          1: "Giai Đoạn 1: Đánh Thường",
          2: "Giai Đoạn 2: Gầm Chấn Động",
          3: "Giai Đoạn 3: Cuồng Phộ Lao Bổ",
        };
        bs.innerHTML = `
          <div class="boss-title">${b.name}</div>
          <div class="boss-phase">${phaseNames[b.phase]}</div>
          <div class="boss-bar-bg">
            <div class="boss-bar-fill" style="width: ${ratio * 100}%"></div>
            <span class="boss-bar-text">${b.hp} / ${b.maxHp}</span>
          </div>
        `;
      } else {
        bs.style.display = "none";
      }
    }
  }

  // Per-frame combat-button state: cooldown sweep + seconds, ULT energy
  // ring + full-energy glow, casting/aiming highlights, defend stance,
  // dodge cooldown, context-interact visibility. DOM writes are cached
  // per button so a steady state costs nothing.
  function setCdOverlay(el, frac, text) {
    const cd = el.querySelector(".hb-cd");
    if (!cd) return;
    const show = frac > 0;
    if (el._cdShow !== show) { el._cdShow = show; cd.style.display = show ? "flex" : "none"; }
    if (show) {
      const bg = `conic-gradient(rgba(5, 9, 11, 0.80) ${Math.round(frac * 360)}deg, rgba(5, 9, 11, 0.30) 0deg)`;
      if (el._cdBg !== bg) { el._cdBg = bg; cd.style.background = bg; }
      const tx = cd.querySelector(".hb-cd-text");
      if (tx && el._cdText !== text) { el._cdText = text; tx.textContent = text; }
    }
  }
  function cdText(cd) { return cd >= 2 ? String(Math.ceil(cd)) : cd.toFixed(1); }

  function syncCombatButtons() {
    const p = G.player;
    for (const def of SKILLS) {
      const el = btnRefs[def.skill_id];
      if (!el) continue;
      const cd = skillCdLeft(def);
      setCdOverlay(el, def.cooldown > 0 ? Math.min(1, cd / def.cooldown) : 0, cdText(cd));
      el.classList.toggle("casting", !!(G.casting && G.casting.def === def));
      el.classList.toggle("aiming", !!(G.aim && G.aim.def === def));
      el.classList.toggle("cant-afford",
        def.energy_cost > 0 ? p.energy < def.energy_cost : p.mp < def.mana_cost);
      if (def.energy_cost > 0) {
        // ULT energy ring + glow at full (spec §3.5/§5.2).
        const ring = el.querySelector(".hb-ring");
        if (ring) {
          const bg = `conic-gradient(rgba(255, 190, 60, 0.95) ${Math.round(p.energy * 3.6)}deg, rgba(255, 255, 255, 0.10) 0deg)`;
          if (el._ringBg !== bg) { el._ringBg = bg; ring.style.background = bg; }
        }
        el.classList.toggle("ult-ready", p.energy >= def.energy_cost);
      }
    }
    const dodge = btnRefs.dodge;
    if (dodge) {
      const cd = Math.max(0, G.dodgeReadyAt - S.t);
      setCdOverlay(dodge, Math.min(1, cd / DODGE_COOLDOWN), cdText(cd));
      dodge.classList.toggle("dodging", !!G.dodge);
    }
    const defend = btnRefs.defend;
    if (defend) defend.classList.toggle("active", G.defending);
    const atk = btnRefs.atk;
    if (atk) atk.classList.toggle("swinging", G.player.isAttacking);
    const interact = btnRefs.interact;
    if (interact) {
      const t = G.dialogue.open ? null : findContextTarget();
      const show = !!t;
      if (interact._shown !== show) {
        interact._shown = show;
        interact.style.display = show ? "" : "none";
      }
      if (show && interact._lbl !== t.label) {
        interact._lbl = t.label;
        interact.title = "Tương tác: " + t.label;
      }
    }
  }

  function showBanner(title, sub) {
    const el = document.getElementById("gameBanner");
    if (!el) return;
    el.innerHTML = `
      <div class="banner-title">${title}</div>
      <div class="banner-sub">${sub || ""}</div>
    `;
    G.banner.t = G.banner.duration;
    el.style.opacity = "1";
  }

  function addFloatingText(x, y, text, color) {
    G.floatingTexts.push({
      x, y, text,
      color: color || "#ffffff",
      t: 0,
      duration: 1.1,
    });
  }

  // --------------------------------------------------------------------------
  // Automation Test Hooks (§5c)
  // --------------------------------------------------------------------------
  return {
    init,
    update,
    renderGroundVFX,
    renderWorldVFX,
    renderScreenUI,
    drawActor,
    drawCastFrame,
    isCasting,
    movementLocked,
    handlePointerClick,
    playerAttack,
    triggerInteraction,
    advanceDialogue: nextDialogue,
    resetGame,

    // Test Inspection API
    isReady: () => G.initialized,
    getQuestState: () => ({
      ready: G.initialized,
      index: G.questIndex,
      quest: currentQuest() ? currentQuest().id : null,
      name: currentQuest() ? currentQuest().name : null,
      state: G.questState,
      progress: G.questProgress,
      herbs: G.herbsCount,
      playerHp: G.player.hp,
      dialogueOpen: G.dialogue.open,
      bossHp: G.boss ? G.boss.hp : null,
      bossPhase: G.boss ? G.boss.phase : null,
      activeTarget: G.activeTarget ? G.activeTarget.label : null,
    }),

    interactWith: (objId) => triggerInteraction(objId),
    teleportTo: (px, py) => setPlayerPx(px, py),

    // GD3 online hooks (driven by js/net.js; inert in local mode)
    netSetOnline: (on) => { G.online = !!on; },
    netSetRemotePlayers: (list) => {
      G.remotePlayers = new Map((list || []).map(p => [p.id, p]));
    },
    netApplyYouState,
    netApplyCastResult,
    netApplyWorld,
    netApplyHitEvent: (msg) => applyServerHits(msg.hits),
    damageBoss: (amt) => G.boss && damageBoss(G.boss, amt !== undefined ? amt : G.player.atk),

    // Read-only combat inspection for the input-driven playtest driver
    // (decisions from visible state; actions only via real input events).
    inspectCombat: () => ({
      px: Math.round(P.x), py: Math.round(P.y),
      playerHp: G.player.hp, playerDead: G.player.isDead,
      playerMaxHp: G.player.maxHp, playerAtk: G.player.atk,
      playerDef: G.player.def, playerLevel: G.player.level || 1,
      playerMp: Math.floor(G.player.mp), playerMaxMp: G.player.maxMp,
      energy: Math.round(G.player.energy),
      casting: G.casting ? G.casting.def.skill_id : null,
      defending: G.defending, dodging: !!G.dodge,
      target: G.target ? G.target.kind : null,
      xp: G.player.xp, inventory: [...G.inventory],
      gathering: G.gathering.active,
      gathered: [...G.gatheredNodes],
      online: G.online,
      remotePlayers: [...G.remotePlayers.values()].map(r => ({
        id: r.id, name: r.name, x: Math.round(r.x), y: Math.round(r.y),
        hp: r.hp, maxHp: r.maxHp, dead: !!r.dead,
      })),
      monsters: [...G.monsters.values()].map(m => ({
        id: m.id, key: m.cfgKey, x: Math.round(m.x), y: Math.round(m.y),
        hp: m.hp, maxHp: m.maxHp, dead: m.isDead, state: m.state,
      })),
      boss: G.boss ? {
        x: Math.round(G.boss.x), y: Math.round(G.boss.y),
        hp: G.boss.hp, maxHp: G.boss.maxHp, phase: G.boss.phase,
        state: G.boss.state, dead: G.boss.isDead, engaged: G.bossEngaged,
      } : null,
    }),

    // Read-only skill-system inspection for the HUD harness: pack load
    // state, per-skill machine state, live cast frame (direction row +
    // phase), aim state, dodge/defend state.
    inspectSkills: () => ({
      packsLoaded: Object.fromEntries(Object.keys(PACK_FILES).map(k => [k, !!PACKS[k]])),
      casting: G.casting ? {
        skill: G.casting.def.skill_id,
        frame: Math.min(7, Math.floor(G.casting.t / G.casting.def.cast_time * 8)),
        row: G.casting.row, angle: Math.round(G.casting.angle),
        hitApplied: G.casting.hitApplied,
      } : null,
      aiming: G.aim ? { skill: G.aim.def.skill_id, angle: Math.round(G.aim.angle), cancel: !!G.aim.cancel } : null,
      slots: [...G.skillSlots],
      skillPanelOpen: G.skillPanelOpen,
      target: G.target ? {
        kind: G.target.kind,
        id: G.target.kind === "monster" ? G.target.m.id : (G.boss ? G.boss.id : "boss"),
      } : null,
      skills: SKILLS.map(def => ({
        id: def.skill_id,
        state: G.casting && G.casting.def === def ? "casting"
          : skillCdLeft(def) > 0 ? "cooldown" : "ready",
        cdLeft: Math.round(skillCdLeft(def) * 10) / 10,
        manaCost: def.mana_cost, energyCost: def.energy_cost,
      })),
      dodgeCdLeft: Math.round(Math.max(0, G.dodgeReadyAt - S.t) * 10) / 10,
      defending: G.defending,
      dodging: !!G.dodge,
      pendingSkill: G.pendingSkill ? G.pendingSkill.def.skill_id : null,
    }),
  };
})();
