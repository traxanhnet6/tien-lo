"use strict";
/* Tiên Lộ — Game Data & Quest Configurations.
   All dialogue texts are DRAFT (BẢN NHÁP).
   All gameplay values (HP, stats, ranges, timings) are PROPOSALS (ĐỀ XUẤT).
   Anchors are strictly bound to data/Map_Quests.json.
*/

const GAME_DATA = {
  // Player Base Stats (ĐỀ XUẤT)
  player: {
    name: "Hà Nhân",
    title: "Tân Nhân Đệ Tử",
    maxHp: 220,
    hp: 220,
    atk: 32,
    def: 6,
    speed: 90,
    runSpeed: 218,
    atkRange: 105,       // sword reach in pixels
    atkCooldown: 0.60,   // seconds between attacks
  },

  // Level Curve (ĐỀ XUẤT — team-authored 2026-11-09 under Bui's two
  // rulings: Q1–Q5 quest rewards for progressive growth, AND monster HP
  // persisting across player deaths. Calibrated LEAN on purpose: growth
  // is real but the elite/boss are beaten by growth + attrition across
  // deaths, not by out-statting them in one life.)
  // Stats are DERIVED from total XP: the row with the highest xpNeed that
  // the player's cumulative XP has reached defines maxHp/atk/def.
  // Level 1 reproduces the shipped base stats exactly (220/32/6).
  levels: [
    // maxMp/mpRegen: HUD wave (2026-11-09) — PROVISIONAL team-chosen values
    // pending a balance pass, in the rewards-report tradition. MP is a pure
    // function of level like HP/ATK/DEF: maxMp = 60 + (level-1)*15,
    // mpRegen (per second) = 3 + level*0.5.
    { xpNeed: 0,    maxHp: 220, atk: 32, def: 6,  maxMp: 60,  mpRegen: 3.5, title: "Luyện Khí tầng 1" },
    { xpNeed: 100,  maxHp: 238, atk: 35, def: 7,  maxMp: 75,  mpRegen: 4.0, title: "Luyện Khí tầng 2" },
    { xpNeed: 250,  maxHp: 256, atk: 38, def: 9,  maxMp: 90,  mpRegen: 4.5, title: "Luyện Khí tầng 3" },
    { xpNeed: 450,  maxHp: 274, atk: 41, def: 10, maxMp: 105, mpRegen: 5.0, title: "Luyện Khí tầng 4" },
    { xpNeed: 700,  maxHp: 292, atk: 44, def: 11, maxMp: 120, mpRegen: 5.5, title: "Luyện Khí tầng 5" },
    { xpNeed: 1000, maxHp: 312, atk: 47, def: 12, maxMp: 135, mpRegen: 6.0, title: "Luyện Khí tầng 6" },
    { xpNeed: 1450, maxHp: 334, atk: 50, def: 13, maxMp: 150, mpRegen: 6.5, title: "Luyện Khí tầng 7" },
    { xpNeed: 2000, maxHp: 358, atk: 53, def: 15, maxMp: 165, mpRegen: 7.0, title: "Luyện Khí tầng 8" },
    // Appended for Q9-Q13 Xích Viêm Cốc (ĐỀ XUẤT) - maintaining exact rate of progression
    { xpNeed: 2700, maxHp: 382, atk: 56, def: 17, maxMp: 180, mpRegen: 7.5, title: "Luyện Khí tầng 9" },
    { xpNeed: 3500, maxHp: 408, atk: 59, def: 19, maxMp: 195, mpRegen: 8.0, title: "Trúc Cơ Sơ Kỳ" },
    { xpNeed: 4400, maxHp: 434, atk: 62, def: 21, maxMp: 210, mpRegen: 8.5, title: "Trúc Cơ Trung Kỳ" },
    { xpNeed: 5400, maxHp: 462, atk: 65, def: 23, maxMp: 225, mpRegen: 9.0, title: "Trúc Cơ Hậu Kỳ" },
    { xpNeed: 6500, maxHp: 492, atk: 68, def: 25, maxMp: 240, mpRegen: 9.5, title: "Trúc Cơ Viên Mãn" },
  ],

  // Monster Profiles (§28 ĐỀ XUẤT)
  monsters: {
    trucyeu: {
      species: "Trúc Yêu",
      role: "Cận chiến thường, Trúc Linh Lâm",
      maxHp: 85,
      atk: 14,
      def: 3,
      speed: 78,
      aggroRadius: 250,
      attackRange: 85,
      telegraphDuration: 0.55, // >= 0.45s per brief
      attackCooldown: 1.8,
      sheet: "assets/monsters/monster_trucyeu_sheet_v1.png",
      meta: "assets/monsters/monster_trucyeu_sheet_v1.json",
      h: 190,
      shadowW: 80,
    },
    linhlang: {
      species: "Linh Lang",
      role: "Quái nhanh, áp sát theo nhóm, Trúc Linh Lâm",
      maxHp: 65,
      atk: 15,
      def: 2,
      speed: 142,        // fast!
      aggroRadius: 260,
      attackRange: 75,
      packCallRadius: 360, // alerts sibling Linh Lang
      telegraphDuration: 0.48, // pounce wind-up
      attackCooldown: 1.5,
      sheet: "assets/monsters/monster_linhlang_full_sheet_v1.png",
      meta: "assets/monsters/monster_linhlang_full_sheet_v1.json",
      h: 92,
      shadowW: 60,
    },
    thachve: {
      species: "Thạch Vệ",
      role: "Tinh anh phòng thủ thường, Vân Ẩn Động",
      maxHp: 165,
      atk: 24,
      def: 9,
      speed: 58,
      aggroRadius: 200,
      attackRange: 80,
      telegraphDuration: 0.72, // heavy wind-up
      attackCooldown: 2.2,
      sheet: "assets/monsters/monster_thachve_sheet_v1.png",
      meta: "assets/monsters/monster_thachve_sheet_v1.json",
      h: 130,
      shadowW: 72,
    },
    thachve_elite: {
      species: "Thạch Vệ Tinh Anh",
      role: "Tinh anh phòng thủ cao cấp, Vân Ẩn Động (§28)",
      maxHp: 340,
      atk: 32,
      def: 12,
      speed: 62,
      aggroRadius: 240,
      attackRange: 90,
      telegraphDuration: 0.85,
      attackCooldown: 2.4,
      // Special AoE Skill: Địa Chấn Toái Thạch
      skillCooldown: 6.5,
      skillTelegraphDuration: 1.15,
      skillRadius: 145,
      skillDamage: 52,
      sheet: "assets/monsters/monster_thachve_sheet_v1.png",
      meta: "assets/monsters/monster_thachve_sheet_v1.json",
      h: 178,
      shadowW: 96,
    },
    // New Fire Realm Monsters (§28 ĐỀ XUẤT)
    hoatinh: {
      species: "Hỏa Tinh Thử",
      role: "Quái nhanh, áp sát nhanh, Xích Viêm Cốc",
      maxHp: 90,
      atk: 18,
      def: 3,
      speed: 138,
      aggroRadius: 260,
      attackRange: 75,
      telegraphDuration: 0.48,
      attackCooldown: 1.5,
      sheet: "assets/monsters/monster_hoatinh_sheet_v1.png",
      meta: "assets/monsters/monster_hoatinh_sheet_v1.json",
      h: 95,
      shadowW: 60,
    },
    hoanhamlang: {
      species: "Hỏa Nham Lang",
      role: "Cận chiến thường, Xích Viêm Cốc",
      maxHp: 120,
      atk: 22,
      def: 5,
      speed: 85,
      aggroRadius: 260,
      attackRange: 85,
      telegraphDuration: 0.55,
      attackCooldown: 1.8,
      sheet: "assets/monsters/monster_hoanhamlang_sheet_v1.png",
      meta: "assets/monsters/monster_hoanhamlang_sheet_v1.json",
      h: 110,
      shadowW: 75,
    },
    viemnham: {
      species: "Viêm Nham Khôi Lỗi",
      role: "Quái nặng, phòng ngự, Xích Viêm Cốc",
      maxHp: 210,
      atk: 30,
      def: 12,
      speed: 55,
      aggroRadius: 220,
      attackRange: 85,
      telegraphDuration: 0.75,
      attackCooldown: 2.2,
      sheet: "assets/monsters/monster_viemnham_sheet_v1.png",
      meta: "assets/monsters/monster_viemnham_sheet_v1.json",
      h: 145,
      shadowW: 85,
    },
    xichviem_elite: {
      species: "Xích Viêm Tinh Anh",
      role: "Tinh anh Hỏa Vực cao cấp, Xích Viêm Cốc (§28)",
      maxHp: 420,
      atk: 38,
      def: 15,
      speed: 62,
      aggroRadius: 250,
      attackRange: 95,
      telegraphDuration: 0.85,
      attackCooldown: 2.4,
      // Special AoE Skill: Liệt Hỏa Liêu Nguyên
      skillCooldown: 6.5,
      skillTelegraphDuration: 1.20,
      skillRadius: 160,
      skillDamage: 65,
      sheet: "assets/monsters/monster_xichviem_elite_sheet_v1.png",
      meta: "assets/monsters/monster_xichviem_elite_sheet_v1.json",
      h: 185,
      shadowW: 100,
    },
  },

  // Boss Profile (§29 + §G.3 ĐỀ XUẤT)
  boss: {
    id: "boss_bachho",
    name: "Bạch Hổ Sơn Quân",
    title: "Thánh Thú Hậu Sơn — Ba Giai Đoạn",
    maxHp: 1200,
    def: 14,
    speed: 82,
    dashSpeed: 440,
    aggroRadius: 380,
    attackRange: 120,
    h: 330,
    shadowW: 190,
    sheet: "assets/boss/boss_bachho_sheet_v1.png",
    meta: "assets/boss/boss_bachho_sheet_v1.json",
    // Phase 1 (100% - 66%): basic claw swipe
    phase1: {
      swipeDamage: 30,
      swipeTelegraph: 0.65,
      swipeCooldown: 2.0,
      swipeRange: 125,
    },
    // Phase 2 (66% - 33%): adds Gầm Chấn Động
    phase2: {
      roarDamage: 62,
      roarTelegraph: 1.10, // warning ring on ground ~1.1s
      roarRadius: 230,
      roarCooldown: 7.0,
      knockbackDist: 110,
    },
    // Phase 3 (33% - 0%): adds Lao Bổ Diện Rộng
    phase3: {
      dashDamage: 75,
      dashTelegraph: 0.95, // directional strip/cone ~0.95s
      dashLength: 380,
      dashWidth: 130,
      dashCooldown: 6.5,
    },
  },

  // Boss 002 Profile — Xích Viêm Ma Quân (§29 + §3.4 ĐỀ XUẤT)
  boss_xichviem: {
    id: "boss_xichviem",
    name: "Xích Viêm Ma Quân",
    title: "Chúa Tể Xích Viêm Cốc — Ba Giai Đoạn",
    maxHp: 1600,
    def: 18,
    speed: 84,
    dashSpeed: 450,
    aggroRadius: 400,
    attackRange: 130,
    h: 330,
    shadowW: 200,
    sheet: "assets/boss/boss_xichviem_sheet_v1.png",
    meta: "assets/boss/boss_xichviem_sheet_v1.json",
    // Phase 1 (100% - 66%): Viêm Trảo Trảm
    phase1: {
      swipeDamage: 38,
      swipeTelegraph: 0.70, // >= 700ms per brief
      swipeCooldown: 2.0,
      swipeRange: 135,
    },
    // Phase 2 (66% - 33%): Liệt Hỏa Địa Chấn
    phase2: {
      roarDamage: 75,
      roarTelegraph: 1.15, // ground warning ring >= 700ms
      roarRadius: 240,
      roarCooldown: 6.5,
      knockbackDist: 115,
    },
    // Phase 3 (33% - 0%): Xích Viêm Liêu Nguyên
    phase3: {
      dashDamage: 90,
      dashTelegraph: 1.00, // directional path warning
      dashLength: 420,
      dashWidth: 140,
      dashCooldown: 6.0,
    },
  },

  // Draft Dialogues (BẢN NHÁP) for 8-quest chain
  dialogues: {
    // Q1
    q1_intro: {
      npc: "npc_tiendong",
      name: "Tiên Đồng Thanh Vân",
      role: "Tiên Đồng dẫn lối Sơn Môn",
      lines: [
        "Chào mừng đạo hữu đã vượt qua muôn trùng vân hải để tới Thanh Vân Tiên Môn!",
        "Thanh Vân sơn mạch linh khí dồi dào, là đất lành tu tiên. Xin đạo hữu mau tới Quảng Trường diện kiến Chấp Sự để ghi danh nhập môn."
      ],
      btn: "Tiếp nhận lời dặn"
    },
    q1_complete: {
      npc: "npc_chapsu",
      name: "Chấp Sự Thanh Vân",
      role: "Chấp Sự Ngoại Môn",
      lines: [
        "Hoan nghênh tiểu hữu nhập môn! Căn cốt ngươi thanh kỳ, linh căn vững chắc, thật là mầm mống tốt.",
        "Đây là Lệnh Bài Tân Nhân của Thanh Vân Môn. Từ nay ngươi chính là đệ tử của bổn phái!"
      ],
      btn: "Bái kiến Chấp Sự"
    },

    // Q2
    q2_intro: {
      npc: "npc_chapsu",
      name: "Chấp Sự Thanh Vân",
      role: "Chấp Sự Ngoại Môn",
      lines: [
        "Là đệ tử mới, trước hết ngươi cần thông thuộc đường đi lối lại trong môn phái.",
        "Ngay phía đông Quảng Trường có một tòa Đài Truyền Tống cổ. Hãy lại gần kích hoạt và cảm ngộ trận pháp."
      ],
      btn: "Đi tới Đài Truyền Tống"
    },
    q2_inspect_dais: {
      npc: "dais_qt",
      name: "Đài Truyền Tống Thanh Vân",
      role: "Cổ Trận Pháp",
      lines: [
        "Linh văn dưới chân rực sáng sắc lam ngọc. Từng luồng linh khí cổ xưa lưu chuyển tuần hoàn.",
        "Ngươi đã ghi nhớ cấu trúc truyền tống trận. Bước chân tu tiên từ đây mở lối!"
      ],
      btn: "Lĩnh ngộ trận pháp"
    },

    // Q3
    q3_intro: {
      npc: "npc_truonglao",
      name: "Trưởng Lão Võ",
      role: "Chưởng Quản Luyện Võ Trường",
      lines: [
        "Đến rất đúng lúc! Tu đạo nếu chỉ ngồi tĩnh tọa thì khó mà đứng vững trong giới tu tiên hiểm ác.",
        "Bên dưới Trúc Linh Lâm có bầy Trúc Yêu tác quái, cản trở đệ tử hái thuốc. Hãy cầm kiếm, tiêu diệt 5 con Trúc Yêu về đây bẩm báo!"
      ],
      btn: "Tiếp nhận nhiệm vụ"
    },
    q3_turn_in: {
      npc: "npc_truonglao",
      name: "Trưởng Lão Võ",
      role: "Chưởng Quản Luyện Võ Trường",
      lines: [
        "Kiếm pháp quả nhiên dứt khoát, bộ pháp né đòn vững vàng! 5 con Trúc Yêu đã bị trảm sạch.",
        "Đan Dược Sư ở Quảng Trường đang cần người hỗ trợ thu thập dược liệu. Ngươi hãy mau qua đó giúp đỡ nàng."
      ],
      btn: "Đa tạ Trưởng Lão"
    },

    // Q4
    q4_intro: {
      npc: "npc_dansu",
      name: "Đan Dược Sư",
      role: "Dược Lô Trưởng",
      lines: [
        "Tiểu sư đệ tới thật may mắn! Lò Bồi Nguyên Đan của ta sắp đến giờ kết đan, nhưng linh thảo trong kho lại vừa hết.",
        "Dưới Trúc Linh Lâm có 5 khóm Linh Thảo ngậm sương mai. Phiền ngươi hái đủ 5 phần mang về giúp ta nhé!"
      ],
      btn: "Giúp hái linh thảo"
    },
    q4_turn_in: {
      npc: "npc_dansu",
      name: "Đan Dược Sư",
      role: "Dược Lô Trưởng",
      lines: [
        "Linh thảo tươi nhuận, dược tính bảo toàn trọn vẹn! Cảm ơn sư đệ rất nhiều.",
        "Lọ Linh Dược Hồi Phục này tặng ngươi hộ thân. Vừa rồi Chấp Sự có nhắn tìm ngươi có việc khẩn!"
      ],
      btn: "Nhận linh dược"
    },

    // Q5
    q5_intro: {
      npc: "npc_chapsu",
      name: "Chấp Sự Thanh Vân",
      role: "Chấp Sự Ngoại Môn",
      lines: [
        "Ngươi về đúng lúc lắm! Vừa rồi sườn tây môn phái có chấn động lạ, khói biếc bốc lên từ Vân Ẩn Động.",
        "Thủ Vệ gác hang đang canh giữ ở đó. Ngươi hãy tới gặp Thủ Vệ nắm tình hình rồi thám thính miệng hang xem sao!"
      ],
      btn: "Lên đường điều tra"
    },
    q5_talk_guard: {
      npc: "npc_thuve",
      name: "Thủ Vệ Vân Ẩn Động",
      role: "Thủ Hộ Đệ Tử",
      lines: [
        "Đạo hữu dừng bước! Trong Vân Ẩn Động đang có dị biến cực kỳ nguy hiểm.",
        "Cổ thạch bị tà khí kích động, Thạch Vệ trấn hang bỗng thức tỉnh phát cuồng. Mau thám thính phía trước nhưng tuyệt đối cẩn thận!"
      ],
      btn: "Tiến lại miệng hang"
    },
    q5_cave_mouth: {
      npc: "cave_mouth",
      name: "Miệng Vân Ẩn Động",
      role: "Khu Vực Bí Cảnh",
      lines: [
        "Gió lạnh từ lòng hang thổi ra rát buốt. Dưới nền đá hằn sâu những dấu chân khổng lồ nứt toác.",
        "Một tiếng gầm đá vỡ trầm đục vọng lại — Thạch Vệ Tinh Anh đã xuất hiện phía trước!"
      ],
      btn: "Xác nhận dấu vết"
    },

    // Q6
    q6_intro: {
      npc: "npc_thuve",
      name: "Thủ Vệ Vân Ẩn Động",
      role: "Thủ Hộ Đệ Tử",
      lines: [
        "Chính là nó! Con Thạch Vệ Tinh Anh khổng lồ đang chắn giữ thềm đá phía trước.",
        "Thân nó kết từ đá ngọc ngàn năm, đòn nện đất 'Địa Chấn' có thể đánh nát xương cốt. Hãy né tránh vòng chấn động và đập tan nó!"
      ],
      btn: "Tiêu diệt Thạch Vệ Tinh Anh"
    },
    q6_turn_in: {
      npc: "npc_thuve",
      name: "Thủ Vệ Vân Ẩn Động",
      role: "Thủ Hộ Đệ Tử",
      lines: [
        "Trời đất! Ngươi vậy mà trảm được Thạch Vệ Tinh Anh! Khối linh thạch phong ấn trong ngực nó đã nứt đôi.",
        "Nhưng chuyện này không đơn giản. Chưởng Môn tại Đại Điện triệu kiến ngươi gấp để bàn định đại sự!"
      ],
      btn: "Về Đại Điện yết kiến"
    },

    // Q7
    q7_intro: {
      npc: "npc_chuongmon",
      name: "Chưởng Môn Thanh Vân",
      role: "Thanh Vân Chưởng Môn",
      lines: [
        "Ngươi đã đến. Thạch Vệ phát cuồng chỉ là dấu hiệu đầu tiên của tai kiếp.",
        "Trấn phái thánh thú tại Hậu Sơn — Bạch Hổ Sơn Quân đã bị tà khí Ma Uyên ăn mòn thần trí, xé toang kết giới cổ!",
        "Hậu Sơn là tử địa hiểm trở. Ngươi hãy bước qua Cổng Hậu Sơn ở thềm tây, tiến vào đấu trường chế ngự Sơn Quân. Nhớ kỹ: Cổng về luôn mở nếu ngươi cần rút lui!"
      ],
      btn: "Tiến vào Hậu Sơn diệt trừ dị biến"
    },
    q7_boss_victory: {
      npc: "boss_bachho",
      name: "Bạch Hổ Sơn Quân",
      role: "Thánh Thú Hậu Sơn",
      lines: [
        "Bạch Hổ Sơn Quân gầm lên tiếng cuối cùng, tà khí đen ngòm quanh thân tan rã như sương khói.",
        "Ánh mắt hung bạo dần khôi phục vẻ thanh tịnh uy nghiêm của thánh thú, nằm phục xuống thềm đá nghỉ ngơi.",
        "Ngươi đã hoàn thành đại công hộ môn! Mau qua cổng dịch chuyển trở về Đại Điện báo tiệp cùng Chưởng Môn."
      ],
      btn: "Trở về môn phái"
    },
    q7_turn_in: {
      npc: "npc_chuongmon",
      name: "Chưởng Môn Thanh Vân",
      role: "Thanh Vân Chưởng Môn",
      lines: [
        "Sơn Quân đã quy phục, kết giới Hậu Sơn ổn định trở lại. Ngươi lập đại công hộ môn, lão phu thay mặt toàn phái ghi nhận!",
        "Con đường tu tiên phía trước còn dài. Khi ngươi đã sẵn sàng, hãy tới gặp ta để xuất môn lịch luyện."
      ],
      btn: "Bái tạ Chưởng Môn"
    },

    // Q8
    q8_intro: {
      npc: "npc_chuongmon",
      name: "Chưởng Môn Thanh Vân",
      role: "Thanh Vân Chưởng Môn",
      lines: [
        "Tuyệt hảo! Trận chiến tại Hậu Sơn kinh thiên động địa, ngươi dũng cảm can trường, một mình hàng phục Sơn Quân, cứu vãn toàn phái!",
        "Thanh Vân Tiên Môn đã không còn gì để dạy cho ngươi nữa. Đã đến lúc bậc trượng phu sải cánh thám hiểm Cửu Châu đại lục.",
        "Hãy bước lên Đài Truyền Tống tại Quảng Trường để xuất môn lịch luyện!"
      ],
      btn: "Xuất môn lịch luyện"
    },
    q8_complete_slice: {
      npc: "dais_qt",
      name: "Đài Truyền Tống Cửu Châu",
      role: "Ranh Giới Thanh Vân",
      lines: [
        "Trận đồ Cửu Châu ngân vang thanh âm cổ tích. Kết giới ngoại vi Thanh Vân Tiên Môn đang phát ra ánh hào quang ngút trời.",
        "【THÔNG BÁO】: Khu vực kế tiếp (Bát Châu đại lục) chưa mở — hiện đang trong thời gian cấm chế phong ấn.",
        "Chúc mừng đạo hữu đã hoàn thành xuất sắc toàn bộ Chuỗi 8 Nhiệm Vụ Tân Thủ Tiên Lộ (Vertical Slice)!"
      ],
      btn: "Hoàn tất bản chơi thử"
    },

    // Draft Dialogues for Q9–Q13 (BẢN NHÁP — Xích Viêm Cốc)
    // Q9: Phá ấn nhập cốc
    q9_intro: {
      npc: "dais_qt",
      name: "Đài Truyền Tống Thanh Vân",
      role: "Cổ Trận Pháp — Phong Ấn Giải Trừ",
      lines: [
        "Sau khi Bạch Hổ Sơn Quân quy phục, linh mạch ngũ hành tuần hoàn chấn động, phong ấn cổ xưa tại Đài Truyền Tống đã chính thức tan rã!",
        "Một luồng hỏa tức viễn cổ bốc lên từ trận đồ. Cổng dịch chuyển dẫn thẳng tới Xích Viêm Cốc — vùng đất rực lửa nơi Hỏa Linh ngưng tụ.",
        "Đạo hữu hãy bước qua trận đồ, tiến vào Xích Viêm Cốc thám thính tình hình!"
      ],
      btn: "Tiến vào Xích Viêm Cốc"
    },
    q9_talk_guardian: {
      npc: "npc_xichviem_tientri",
      name: "Thủ Hộ Giả Xích Viêm",
      role: "Trấn Thủ Cổ Cốc",
      lines: [
        "Ngươi... là đệ tử Thanh Vân Tiên Môn sao? Đã trăm năm qua mới lại có người đặt chân tới Xích Viêm Cốc này!",
        "Nơi đây vốn là thánh địa tu luyện Hỏa hành, nhưng gần đây địa hỏa bùng phát, quái vật dị biến cuồng bạo. Ngươi tới thật đúng lúc!"
      ],
      btn: "Tiếp nhận diện kiến"
    },

    // Q10: Trừ diệt Hỏa Tinh Thử
    q10_intro: {
      npc: "npc_xichviem_tientri",
      name: "Thủ Hộ Giả Xích Viêm",
      role: "Trấn Thủ Cổ Cốc",
      lines: [
        "Bên dưới Hỏa Nham Vực, bầy Hỏa Tinh Thử sinh sôi vô số, răng nhọn gặm nhấm rễ hỏa thụ, làm loạn linh mạch.",
        "Ngươi hãy xuống tiêu diệt 5 con Hỏa Tinh Thử để trấn an khu vực ngoại vi!"
      ],
      btn: "Tiếp nhận trảm quái"
    },
    q10_turn_in: {
      npc: "npc_xichviem_tientri",
      name: "Thủ Hộ Giả Xích Viêm",
      role: "Trấn Thủ Cổ Cốc",
      lines: [
        "Xuất sắc! Kiếm pháp nhanh như chớp, lũ chuột lửa đã bị ngươi dẹp sạch.",
        "Linh mạch ngoại vi đã tạm ổn định. Giờ ta cần ngươi giúp một việc quan trọng hơn."
      ],
      btn: "Nhận thưởng & tiếp tục"
    },

    // Q11: Thu thập Viêm Tinh Thạch
    q11_intro: {
      npc: "npc_xichviem_tientri",
      name: "Thủ Hộ Giả Xích Viêm",
      role: "Trấn Thủ Cổ Cốc",
      lines: [
        "Để gia cố phong ấn đàn tế, cần có Viêm Tinh Thạch thuần khiết kết tinh từ nham thạch ngàn năm.",
        "Trong lòng Hỏa Nham Vực có 5 khối Viêm Tinh Thạch rực sáng. Hãy thu thập đủ mang về đây cho ta!"
      ],
      btn: "Lên đường thu thập"
    },
    q11_turn_in: {
      npc: "npc_xichviem_tientri",
      name: "Thủ Hộ Giả Xích Viêm",
      role: "Trấn Thủ Cổ Cốc",
      lines: [
        "Viêm Tinh Thạch đỏ rực, phẩm chất thượng thừa! Có số linh thạch này, trận pháp hộ thể của chúng ta sẽ được tăng cường.",
        "Nhưng nguy hiểm thực sự đang chờ ở thềm đá phía trước..."
      ],
      btn: "Báo cáo tình hình"
    },

    // Q12: Xích Viêm Tinh Anh
    q12_intro: {
      npc: "npc_xichviem_tientri",
      name: "Thủ Hộ Giả Xích Viêm",
      role: "Trấn Thủ Cổ Cốc",
      lines: [
        "Một đầu Xích Viêm Tinh Anh to lớn kết tinh từ dung nham cổ đang trấn giữ lối lên đại đàn.",
        "Nó sở hữu tuyệt kỹ 'Liệt Hỏa Liêu Nguyên', có thể phóng ra bão lửa hủy diệt. Ngươi hãy né tránh vùng báo trước trên đất và hạ gục nó!"
      ],
      btn: "Khiêu chiến Tinh Anh"
    },
    q12_turn_in: {
      npc: "npc_xichviem_tientri",
      name: "Thủ Hộ Giả Xích Viêm",
      role: "Trấn Thủ Cổ Cốc",
      lines: [
        "Tuyệt diệu! Ngay cả Xích Viêm Tinh Anh cũng không cản nổi kiếm khí của ngươi!",
        "Chỉ còn chướng ngại cuối cùng: Chúa tể Xích Viêm Ma Quân trên đỉnh Xích Viêm Đàn đã thức tỉnh!"
      ],
      btn: "Tiến lên Xích Viêm Đàn"
    },

    // Q13: Ma Quân giáng thế (Boss 002)
    q13_intro: {
      npc: "npc_xichviem_tientri",
      name: "Thủ Hộ Giả Xích Viêm",
      role: "Trấn Thủ Cổ Cốc",
      lines: [
        "Xích Viêm Ma Quân là cổ thú thượng cổ bị ma khí phong ấn dưới lòng dung nham, nay phá cấm quấy phá.",
        "Nó có 3 giai đoạn chiến đấu hung hiểm: trảo kích cuồng bạo, dậm đất địa chấn, và phóng hỏa lao kích diện rộng.",
        "Hãy quan sát kỹ vùng cảnh báo trên mặt đất để né tránh! Nếu cần lui binh, cổng truyền tống luôn mở sẵn."
      ],
      btn: "Quyết chiến Xích Viêm Ma Quân"
    },
    q13_boss_victory: {
      npc: "boss_xichviem",
      name: "Xích Viêm Ma Quân",
      role: "Chúa Tể Xích Viêm Cốc",
      lines: [
        "Xích Viêm Ma Quân gầm vang chấn động thung lũng, ngọn lửa hung bạo quanh thân dịu dần thành ánh hào quang ngũ hành thanh khiết.",
        "Cổ ma đã quy phục bản nguyên tu tiên, phong ấn Xích Viêm Cốc hoàn toàn được tái lập vững chắc!",
        "Đạo hữu đã hoàn thành chiến tích kinh thiên động địa, hãy quay về bẩm báo cùng Thủ Hộ Giả!"
      ],
      btn: "Khải hoàn báo tiệp"
    },
    q13_complete_slice: {
      npc: "npc_xichviem_tientri",
      name: "Thủ Hộ Giả Xích Viêm",
      role: "Trấn Thủ Cổ Cốc",
      lines: [
        "Chiến tích bất hủ! Ngươi đã hàng phục Ma Quân, giải trừ mối họa diệt môn cho Thanh Vân và bình định Xích Viêm Cốc!",
        "【THÔNG BÁO HOÀN THÀNH】: Chúc mừng đạo hữu đã chinh phục trọn vẹn Chuỗi 13 Nhiệm Vụ Tiên Lộ (Ngũ Hành Vô Địch) mở rộng!",
        "Bản mở rộng lát cắt hoàn tất thành công. Ngũ hành viên mãn, con đường Tiên Lộ rộng mở thênh thang!"
      ],
      btn: "Hoàn tất chuỗi nhiệm vụ mở rộng"
    }
  }
};

window.GAME_DATA = GAME_DATA;
