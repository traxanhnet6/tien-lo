# Finisher Report — Tiên Lộ Vertical Slice (`game-tien-lo-agy1`)

Date: 2026-11-09. Scope: finish the playability work Antigravity left unwired
(supervisor diagnosis in `docs/agy1-report.md`). Map data, quest anchors and
`data/Map_Quests.json` were NOT touched (md5 re-verified at the end of this
session: `1033a3432bc46f7bdcb6bfe377c17750`, identical to iso3).

## Verdict

All six mandated fixes are implemented and syntax-checked. Five are verified
in a real browser (details per item). The single remaining proof item is one
uninterrupted, fully-logged Q1→Q8 playthrough run (boss phases 1–3 + Q8
ending + boss-HUD screenshot): the driver for it is finished and in-tree
(`tools/finisher-playtest.mjs`), but the run could not be completed in this
session because the sandbox infrastructure degraded mid-session (see
"Playtest status & infrastructure" — /tmp purge, workspace quota, and finally
an exec-sandbox write-block that makes Chrome die at startup). Everything
that could be proven without that final run is proven below.

## 1. Loop wiring (fix 1) — DONE, browser-verified

`js/main.js`:
- `step()` now calls `Gameplay.update(dt)` after `updatePlayer`.
- `render()` calls `Gameplay.renderWorldVFX(ctx, z)` after the atmosphere
  block, while the world transform is still active.
- `render()` ends with `Gameplay.renderScreenUI(ctx)` under
  `ctx.setTransform(DSF,0,0,DSF,0,0)`.
- `pointerup` routes through `Gameplay.handlePointerClick(px, py, e)` first
  and only falls back to `walkToPx` when it returns false.
- `TL2.state()` also returns `cam:[x,y]` and `zoom` (read-only test hooks).

Verified live: monsters move/fight on their own, the attack flag clears
after each swing, herb gathering completes, boss AI runs — all observed in
real-browser runs 10/11/13 with taps only and no update pumping.

## 2. Q5 cave-mouth soft-lock (fix 2) — DONE, browser-verified end-to-end

`js/gameplay.js`: a zone-visit latch (`G.caveMouthArmed`) guards the
cave-mouth auto-dialogue in `update()`: it fires only when the player is
within 80px AND the latch is armed AND no dialogue is open; entering the
radius disarms it; leaving a 110px radius re-arms it. The dialogue can now
be read to the end.

Design discovery (important for future work): the Thủ Vệ stand (728,610) is
only ~74px from the cave mouth point (655,600) — INSIDE the 80px trigger
radius. The intended flow therefore chains: guard dialogue → progress 1 →
cave dialogue opens immediately in the same spot → its completion sets
`ready_to_turn_in` and advances the quest. This was proven in a real
browser with real taps via a seeded-save diagnostic (the game's own save
format, resumed at Q5-active): guard dialogue opened, progress went 0→1,
the "Miệng Vân Ẩn Động" dialogue chained, was read to the end without any
line reset, and the quest completed (index 4 → 5, Q6 offered by Thủ Vệ).
In the broken original this chain soft-locked because the cave dialogue
re-opened every tick and reset its line index.

## 3. NaN gradient at shadowEllipse (fix 3) — DONE

`js/main.js` `shadowEllipse`: returns early on non-finite x/y/w or w <= 0,
and clamps the gradient alpha to [0,1]. No more NaN radius exceptions.

## 4. Quest rewards (fix 4) — HOOK INSTALLED; FLAGGED: data defines none

The chain's data defines **no rewards for any of the 8 quests**:
`Map_Quests.json` entries carry only giver/id/name/objective/targets/type
(+count, via_portal), and `game_data.js` has no reward/XP/item tables.
Per the task rule ("apply what the data defines; invent no numbers"), a
data-driven hook was installed instead of inventing values:

- `G.player.xp` and `G.inventory` now exist and persist in save/load.
- `advanceQuest()` calls `applyQuestRewards(q)`, which reads `q.reward`
  and/or `GAME_DATA.questRewards[q.id]` in the shape `{xp, items[]}` and
  applies them; the completion banner's sub-line shows a grant summary
  only when something was actually granted, otherwise the original banner
  text is untouched.
- The player-status HUD line now reads `🌿 Linh thảo: N/5 · EXP: <xp>`.

**Flag for the parent/Bui:** if real XP/item rewards are wanted, the
numbers must be added to the data (one `reward` object per quest); the
engine side is ready and will apply them verbatim. Until then, completing
quests grants no XP/items — banner text only, exactly as shipped. (XP was
therefore 0 through all playtest runs; that is the shipped data, not a bug.)

## 5. HUD overlaps at 390×844 (fix 5) — DONE; (a),(b) visually verified

`css/style.css`, `@media (max-width:720px)` unless noted:
- (a) `.reset-btn` ("Chơi lại") moved to `top:62px; right:14px` — stacked
  directly under the "◎ Theo" chip instead of overlapping it.
- (b) `@media (max-width:520px)`: `.hud-bottom-left` max-width capped at
  `calc(100vw - 128px)` — the zone-chip rows no longer run under the
  attack button.
- (c) `.boss-status-hud` moved to `top:86px; width:92vw; min-width:0` (was
  covering the zone title chip); `body.boss-active` (toggled by
  `syncHUDStats`) shifts `.player-status-hud` to `top:192px` and
  `.quest-tracker-hud` to `top:286px` while the boss bar is up.
- Nothing was shrunk below tap-target minimums.

Visually verified on the current build's own 390×844 screenshot
(`proof/finisher-verify/hud_island_top.png`, run 13): "Theo" and "Chơi lại"
chips stacked cleanly; zone chips end well clear of the "ĐÁNH" button.
Item (c)'s screenshot (boss bar in Hậu Sơn) is part of the remaining
playtest run; the CSS itself is in place and code-reviewed.

## 6. Wording debt (fix 6) — DONE; typo claim is a misread

Spear → sword (battle set is sword-based per Bui's correction):
- `js/gameplay.js`: header comment and "spear reach" comment corrected.
- `js/game_data.js`: line-19 comment corrected; q3_intro "Hãy cầm trường
  thương" → "Hãy cầm kiếm"; q3_turn_in "Thương pháp quả nhiên dứt khoát" →
  "Kiếm pháp quả nhiên dứt khoát". No player-facing "spear/Thương" text
  remains (tree-wide grep).

Banner typo: **there is no typo.** The string is "Đã trảm Trúc Yêu" — the
vowel is ả (U+1EA3, a with hook), correct Vietnamese for "slain". A
tree-wide grep finds no "trám" (á, U+00E1) anywhere. No edit made;
recorded here so the claim is not re-raised.

## Additional defects found and fixed (not in the supervisor report)

1. **Q7 turn-in branch was entirely missing** (chain-breaking).
   `triggerInteraction` had no branch for Chưởng Môn + Q7
   `ready_to_turn_in`, so after killing the boss the quest could never be
   turned in. Added the branch plus a new `q7_turn_in` dialogue in
   `game_data.js` (2 lines: praises the Bạch Hổ victory, points to the Q8
   meeting). FLAG: this dialogue is a repair addition — no turn-in text
   existed anywhere in the shipped data.
2. **NPC canvas taps could never register.** NPC objects in Map_Objects
   have no `w` key, so the branch-3 tap radius `Math.max(45, o.w*0.5)` was
   NaN and every NPC canvas tap missed. Fixed with `(o.w||100)`. (The
   supervisor's verification called `triggerInteraction` directly, which
   is why this was missed.)
3. **Dais tap-theft.** The Q2 dais anchor (2820,1572) has w=330 → a 165px
   tap radius; Chấp Sự's anchor (2665,1615) is ~161px away, so taps aimed
   at Chấp Sự also fell inside the dais's radius and first-match iteration
   let the dais steal them (this silently ate Q1 turn-in talks in four
   consecutive playtest runs). Branch 3 now selects the NEAREST candidate
   within radius; tapping the dais itself still works (nearest wins both
   ways).

## Observed quirk — NOT fixed (outside the mandated list; parent to judge)

`update()`'s pendingInteract check fires the stored callback when
`d <= 35 || (!P.moving && P.path.length === 0)` — i.e. whenever the player
is idle at ANY distance. If a player taps an NPC, then dies en route (or
the walk is otherwise interrupted), the pending interaction can fire late
from the respawn point and open that NPC's dialogue at the shrine. It does
not break the quest chain (dialogue completions are state-gated), and
human players can simply close the dialogue, but it deviates from the
"walk there, open once on arrival" behaviour. A minimal fix would be to
fire only within ~130px of the stand and drop the pending interaction when
idle beyond that. Left untouched because it was not in the finisher's
mandate; recommend the parent decide.

## Gates & integrity

- `data/Map_Quests.json` md5: `1033a3432bc46f7bdcb6bfe377c17750` —
  byte-identical to iso3, re-verified at the end of this session.
- The three iso gates were all run GREEN earlier in this session against
  this exact game code (`python3 tools/audit.py island` PASS,
  `audit.py hauson` PASS, `tools/build_quests.py` → "WALKTHROUGH: PASS"),
  and no game code or map data has changed since — only
  `tools/finisher-playtest.mjs` (the test driver) and proof artifacts.
- A final redundant re-run was attempted but the audit tools write their
  report JSON into `proof/` and the sandbox's exec writes are currently
  blocked (EPERM), so the re-run dies on the report write, not on any
  check. The two zero-byte `proof/audit_*.json` placeholders that this
  produced were removed to trash (recoverable) so they are not mistaken
  for results; re-running the three commands once exec writes recover
  regenerates them.
- `node --check` clean on all edited JS (`main.js`, `gameplay.js`,
  `game_data.js`, `tools/finisher-playtest.mjs`).

## Playtest status & infrastructure (read before judging the proof gap)

Driver: `tools/finisher-playtest.mjs` — raw CDP over WebSocket, input ONLY
via real taps (canvas, #questTracker, #dialogueAdvanceBtn, #mobileAtkBtn),
state read-only via the game's own `TL2.state` / `Gameplay.getQuestState`
/ `inspectCombat` hooks. No `?manual`, no update pumping, no teleport, no
god-mode. Viewport pinned by `Emulation.setDeviceMetricsOverride`
(390×844, DSF 2) and re-pinned before every screenshot.

What IS proven in a real browser with taps only:
- Q1–Q4 completed end-to-end, twice (runs 10 and 11), including Q3's five
  Trúc Yêu fights (player took real damage; one death in run 7's lineage
  was at full fairness — respawn restores HP, monsters/boss reset, quest
  kill progress persists) and Q4's five herb gatherings.
- Q5's full step chain (guard → cave → complete) via the seeded diagnostic
  described in §2.
- HUD fixes (a) and (b) via run 13's screenshot (in `proof/finisher-verify/`).

What remains unproven: one single uninterrupted logged run through Q6
(elite), Q7 (boss phases 1→2→3 to death), Q7 turn-in, Q8 ending, plus the
boss-HUD screenshot. The driver implements all of it (kite/flee-telegraph
tactics, phase tracking, per-phase screenshots, 45-minute boss budget).

Why it did not finish here — infrastructure failed in sequence:
1. Workspace disk quota (EDQUOT) blocked all workspace writes for a long
   stretch; evidence was staged in /tmp.
2. /tmp (512MB tmpfs) filled to 100% (other waves' Chrome profiles) —
   run 12 died with ENOSPC on its first screenshot write.
3. The /tmp evidence of runs 10/11 (8 + partial screenshots and logs) was
   purged/lost before it could be copied out; their contents are recorded
   in this report and in the session log.
4. Run 13 played normally until its Chrome died silently mid-run; from
   ~06:00 the exec sandbox denies ALL writes (EPERM, even as root, on
   every filesystem) while the file tools still work. Chrome — whichever
   builds were tried (puppeteer's 156 and /opt/meta-chromium 157) — dies
   at startup with SIGTRAP under this block because it cannot write its
   profile. No browser can run from this session's exec anymore.

Handover to run the remaining proof (parent, from a healthy session):
`cd ~/workspace/game-tien-lo-agy1 && node tools/finisher-playtest.mjs`
It serves the tree itself, drives the whole Q1→Q8 chain, and writes
screenshots + `playtest-q1-q8.log` into `proof/finisher-verify/`
(expected shots: hud_island_top, q1_turnin … q8_ending, boss_phase1/2/3,
hud_hauson_boss). A full run took ~10–15 min of wall time under load.

## Balance (as shipped; nothing nerfed)

Player: HP 220, atk 32, def 6, cd 0.60s, range 105. No HP regen except
death respawn (full). Trúc Yêu: 3 hits to kill, deals 8/hit net. Thạch Vệ
elite (Q6): 340 HP, player deals 20/hit (~17 hits), deals 26/hit net with
a telegraphed AoE — kiteable, hard but fair in the attempts observed.
Boss Bạch Hổ: 1200 HP, def 14 → ~19/hit (~63 hits); P1 swipe net 24
(telegraph 0.65s), P2 roar net 56 (radius 230, telegraph 1.10s), P3 dash
net 69 (telegraph 0.95s); boss speed 82 < player run 218, so kiting is
viable on paper. Phase 3 was NOT honestly evaluated (no run reached it
before the infrastructure failed) — the finisher does not certify it
beatable or unbeatable; the handover run will answer it with the shipped
numbers unchanged.

## Files changed

- `js/main.js` — loop wiring (§1), shadowEllipse guard (§3), TL2.state
  cam/zoom.
- `js/gameplay.js` — Q5 latch (§2), rewards hook + xp/inventory (§4),
  Q7 turn-in branch (§A1), NPC tap radius (§A2), nearest-candidate tap
  (§A3), boss-active HUD toggle, `inspectCombat()` read-only export,
  comments (§6).
- `js/game_data.js` — sword wording (§6), new `q7_turn_in` dialogue (§A1).
- `css/style.css` — HUD layout (§5).
- `tools/finisher-playtest.mjs` — the playtest driver (new).
- `docs/finisher-report.md` — this report.
