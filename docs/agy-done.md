# BÁO CÁO TIẾN ĐỘ & BÀN GIAO: AGY — TIÊN LỘ VERTICAL SLICE MỞ RỘNG
**Dự án:** Tiên Lộ (Ngũ Hành Vô Địch)  
**Ngày hoàn tất:** 2026-11-09  
**Người thực hiện:** Antigravity (Đội xây chính)  
**Cây làm việc:** `/home/hatch/workspace/game-tien-lo-agy2/`  

---

## 1. Tuyên bố tuân thủ VÙNG ĐÓNG BĂNG (Mục 2.1)
Chúng tôi **tuyên bố và khẳng định 100% không chạm vào bất kỳ thành phần nào thuộc VÙNG ĐÓNG BĂNG** theo quy định tại mục 2.1 của `docs/agy-brief.md`:
- **Trong `js/gameplay.js`:**
  - Bảng `SKILLS`: **NGUYÊN VẸN, KHÔNG THAY ĐỔI**.
  - Máy trạng thái thi triển chiêu (`tryCast`, các hàm cast/aim/cooldown/energy): **NGUYÊN VẸN, KHÔNG SỬA**.
  - Xử lý joystick: **NGUYÊN VẸN**.
  - Hàm đồng bộ cụm nút chiến đấu HUD: **NGUYÊN VẸN**.
  - Hàm vẽ khung tung chiêu `drawCastFrame`: **NGUYÊN VẸN**.
  - Mô hình MP / ULT energy: **NGUYÊN VẸN**.
- **Trong `index.html` và `css/style.css`:**
  - Khối DOM cụm nút chiến đấu HUD: **GIỮ NGUYÊN 100%**.
  - Các quy tắc CSS định vị và giao diện HUD: **GIỮ NGUYÊN 100%**.
- **Tài nguyên chiến đấu:**
  - Toàn bộ thư mục `assets/skills/` (5 gói kỹ năng thật): **GIỮ NGUYÊN 100%**.
  - Toàn bộ thư mục `assets/hud/` (9 biểu tượng HUD): **GIỮ NGUYÊN 100%**.
- **Công cụ kiểm thử gốc:**
  - `tools/hud-harness.mjs`: **GIỮ NGUYÊN 100% KHÔNG SỬA**.
- **Dữ liệu cấp độ & quái hiện hữu:**
  - Bảng cấp độ `GAME_DATA.levels` (hàng 1 đến 8): **GIỮ NGUYÊN 100%**, chỉ thực hiện nối thêm (APPEND-ONLY) các cấp độ 9 đến 13.
  - Các hồ sơ quái hiện hữu trong `GAME_DATA.monsters` (`trucyeu`, `linhlang`, `thachve`, `thachve_elite`): **GIỮ NGUYÊN 100%**, chỉ nối thêm hồ sơ quái mới.
- **Phương thức tích hợp:**
  - Toàn bộ nội dung mới (Map Xích Viêm Cốc, chuỗi nhiệm vụ Q9–Q13, 4 loài quái mới, Boss 002) chỉ tích hợp thông qua các giao diện công khai: tệp dữ liệu map (`data/xichviem/`), bộ sinh nhiệm vụ (`tools/build_quests.py`), hook trao thưởng `applyQuestRewards`, hệ actor và cơ chế cổng dịch chuyển của engine.

---

## 2. Nhật ký tiến độ theo từng mốc (Milestones Progress)

- [x] **Mốc 1: Khảo sát hiện trạng & Thiết lập lộ trình bàn giao (`docs/agy-done.md`)**
  - Khảo sát toàn diện brief `docs/agy-brief.md`, các tiêu chuẩn trong `docs/standards/`, engine `js/main.js`, logic `js/gameplay.js`, bộ sinh `tools/build_quests.py`, bộ kiểm tra `tools/audit.py`.
  - Xác lập thiết kế map mới hệ Hỏa (`xichviem` — Xích Viêm Cốc), chuỗi nhiệm vụ Q9–Q13, 4 loài quái mới (gồm 1 tinh anh), và Boss 002 (Xích Viêm Ma Quân).

- [x] **Mốc 2: Sản xuất tài nguyên đồ họa theo Quy trình sản xuất Boss 1.0 & Chuẩn Art Bible**
  - Tranh nền map Xích Viêm Cốc 2D HD 2:1 (`assets/ground_xichviem.jpg`, 2240×1120).
  - 4 loài quái mới hệ Hỏa chuẩn §28:
    - `mon_hoatinh` (Hỏa Tinh Thử): Quái nhanh, áp sát (`assets/monsters/monster_hoatinh_sheet_v1.png` + `.json`).
    - `mon_hoanhamlang` (Hỏa Nham Lang): Quái cận chiến (`assets/monsters/monster_hoanhamlang_sheet_v1.png` + `.json`).
    - `mon_viemnham` (Viêm Nham Khôi Lỗi): Quái nặng, phòng ngự (`assets/monsters/monster_viemnham_sheet_v1.png` + `.json`).
    - `mon_xichviem_elite` (Xích Viêm Tinh Anh): Tinh anh Hỏa Vực to lớn, chiêu diện rộng (`assets/monsters/monster_xichviem_elite_sheet_v1.png` + `.json`).
  - Boss 002 (Xích Viêm Ma Quân):
    - Khóa concept 2D HD, turnaround 8 hướng thật (S, SE, E, NE, N, NW, W, SW) tại `Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/02_Turnaround_8_Directions/`.
    - Xuất đủ 216 khung hình độc lập PNG RGBA bám đúng quy tắc đặt tên `boss_xichviem_002__{animation}__{direction}__{frame:03}.png` cho 8 bộ hoạt ảnh trong `03_Animation/`.
    - Đo pivot điểm tiếp đất thật: X=304, Y=388.
    - Tách riêng VFX cảnh báo đất / đường lao tại `04_VFX/`.
    - Cấu hình hitbox/hurtbox/cửa sổ sát thương độc lập tại `05_Hitbox/`.
    - Atlas & JSON tích hợp game tại `06_Atlas/`, `08_Game_Integration/`, và `assets/boss/boss_xichviem_sheet_v1.png` (lưới 6×6, 608×426) + `.json`.
    - Bảng kê QA và phân loại nhãn tại `09_QA/`: gắn nhãn CHƯA NGHIỆM THU theo đúng LUẬT GHI NHÃN.

- [x] **Mốc 3: Xây dựng dữ liệu Map Xích Viêm Cốc & Chạy cổng kiểm tra Audit**
  - Xây dựng `data/xichviem/Map_Collision.json`, `Map_Navigation.json`, `Map_Objects.json` qua bộ tạo dữ liệu chuẩn `tools/author_xichviem.py`.
  - 3 zone rõ rệt: `xich_viem_ngoai` (Thềm Nhập Cốc), `hoa_nham_vuc` (Hỏa Nham Vực), `xich_viem_dan` (Xích Viêm Đàn).
  - Tích hợp 22 đối tượng/quái/node thu thập, bảo đảm không gian né đòn, đường tiếp cận và cổng rút lui.
  - Kết nối cổng dịch chuyển hai chiều chống dội cổng: `portal_to_island` (xích viêm 1120,1015 r=85 -> đảo 2820,1700 cách đài >128px; đảo sang xích viêm đáp tại 1120,880 cách đài về 135px).
  - Kiểm tra cổng kiểm 5(a):
    - `python3 tools/audit.py island` -> PASS (3541 cells reachable).
    - `python3 tools/audit.py hauson` -> PASS (675 cells reachable).
    - `python3 tools/audit.py xichviem` -> PASS (648 cells reachable, 16 footprints, zero lỗi).

- [x] **Mốc 4: Tích hợp Chuỗi Nhiệm Vụ Q9–Q13 & Cổng kiểm tra Walkthrough**
  - Bổ sung 5 nhiệm vụ Q9–Q13 vào bảng `QUESTS` trong `tools/build_quests.py` và bảng phần thưởng `REWARDS`:
    - Q9: Phá ấn nhập cốc (+650 EXP).
    - Q10: Trừ diệt Hỏa Tinh Thử (+750 EXP).
    - Q11: Thu thập Viêm Tinh (+800 EXP).
    - Q12: Xích Viêm Tinh Anh (+850 EXP).
    - Q13: Ma Quân giáng thế (+950 EXP).
  - Tái tạo `data/Map_Quests.json` qua bộ sinh; WALKTHROUGH: PASS trọn chuỗi Q1→Q13 (26 chặng đi bộ + nhảy map).
  - Nối thêm cấp 9–13 vào `GAME_DATA.levels` (bảo đảm quy tắc APPEND-ONLY), bổ sung hồ sơ quái mới vào `GAME_DATA.monsters`, hồ sơ Boss 002 `GAME_DATA.boss_xichviem`, và lời thoại nháp Q9–Q13 vào `GAME_DATA.dialogues`.

- [x] **Mốc 5: Tích hợp Gameplay & Đấu trường Boss 002**
  - Đăng ký map mới `xichviem` trong `js/main.js` (hỗ trợ `?map=xichviem` và dịch chuyển hai chiều island ↔ xichviem).
  - Tích hợp điều hướng chỉ đường (guidance target) xuyên map island ↔ xichviem và hiển thị mục tiêu nhiệm vụ Q9–Q13 trên HUD.
  - Tích hợp cơ chế phong ấn cổ tại `dais_qt`: trước Q8 chặn tương tác bằng thông điệp phong ấn; sau khi hoàn tất Q8 mở cổng dịch chuyển tới Xích Viêm Cốc.
  - Tích hợp vòng lặp thu thập `node_viemtinh_1..5` cho Q11 và trảm quái Q10, tinh anh Q12 qua `onMonsterKilled`.
  - Tích hợp đấu trường Boss 002 `boss_xichviem` (vùng Xích Viêm Đàn, kích hoạt intro khi tiếp cận): 3 phase đầy đủ (Phase 1 Liệt Diệm Trảm telegraph 700ms, Phase 2 Liệt Hỏa Địa Chấn vòng đỏ cảnh báo đất r=240px telegraph 1.15s, Phase 3 Xích Viêm Liêu Nguyên đường xung kích 420px telegraph 1.0s).
  - Áp dụng nguyên vẹn luật giữ máu và phase của Boss 002 qua cơ chế `respawnPlayer` hiện hành (khi chết boss giữ nguyên HP và phase hiện tại).
  - Tích hợp hoạt ảnh vẽ sheet của Boss 002 và 4 quái mới trong `drawActor`, cùng thanh máu Boss trên HUD hiển thị 3 phase.

- [x] **Mốc 6: Kiểm thử tự động Headless & Ghi nhận kết quả thật vào `docs/agy-checks.log`**
  - Xây dựng kịch bản kiểm thử toàn diện `tools/run_all_checks.mjs` kết nối Chrome DevTools Protocol (CDP) trên viewport chuẩn mobile 390×844 (DPR=2).
  - Lái luồng game thực tế từ Q1 qua Q8, mở cổng phong ấn, tiến vào Xích Viêm Cốc, nhận và hoàn thành Q9, Q10, Q11, Q12, kích hoạt Boss 002, chiến đấu qua 3 phase.
  - Thực hiện kiểm chứng luật giữ máu Boss 002 (`BOSS HP PERSISTENCE`): hạ gục người chơi có chủ đích ở Phase 2 (HP=1047), sau hồi sinh Boss giữ nguyên HP=1047 và Phase=2.
  - Tiêu diệt Boss 002 và trả Q13 tại Thủ Hộ Giả, đạt Level 9 (3000 XP).
  - Chụp đủ 10 bức ảnh chứng minh vào thư mục `proof/agy_proof/`.
  - Kiểm chứng Cụm Combat HUD và tung chiêu trong vùng đóng băng: PASS.
  - Ghi toàn bộ kết quả thật vào `docs/agy-checks.log`.

- [x] **Mốc 7: Bàn giao toàn diện & Hoàn tất tài liệu**
  - Cập nhật chi tiết bảng kê file-từng-file, kiến trúc hệ thống, thông số kỹ thuật ĐỀ XUẤT, lời thoại BẢN NHÁP.
  - Bảng kê danh mục tài nguyên đồ họa với nhãn CHƯA NGHIỆM THU theo Luật Ghi Nhãn.
  - Tự đánh giá và công khai các điểm yếu kỹ thuật còn tồn tại.

---

## 3. Bảng kê File-Từng-File (Changelog Chi Tiết)

### 3.1 Tệp tạo mới

| Đường dẫn tệp | Mô tả nội dung và chức năng |
| :--- | :--- |
| `assets/ground_xichviem.jpg` | Tranh nền 2D HD 2:1 Isometric của Xích Viêm Cốc, kích thước 2240×1120, tông màu dung nham/hỏa diệm. |
| `assets/monsters/monster_hoatinh_sheet_v1.png` | Sprite sheet quái Hỏa Tinh Thử (lưới 3×3, 9 khung hình: idle, move, telegraph, attack, hit, death). |
| `assets/monsters/monster_hoatinh_sheet_v1.json` | Tệp meta mô tả kích thước cell (120×140) và pivot ([60, 110]) cho Hỏa Tinh Thử. |
| `assets/monsters/monster_hoanhamlang_sheet_v1.png` | Sprite sheet quái Hỏa Nham Lang (lưới 3×3, 9 khung hình). |
| `assets/monsters/monster_hoanhamlang_sheet_v1.json` | Tệp meta mô tả kích thước cell (160×150) và pivot ([80, 125]) cho Hỏa Nham Lang. |
| `assets/monsters/monster_viemnham_sheet_v1.png` | Sprite sheet quái Viêm Nham Khôi Lỗi (lưới 3×3, 9 khung hình). |
| `assets/monsters/monster_viemnham_sheet_v1.json` | Tệp meta mô tả kích thước cell (180×190) và pivot ([90, 160]) cho Viêm Nham Khôi Lỗi. |
| `assets/monsters/monster_xichviem_elite_sheet_v1.png` | Sprite sheet Xích Viêm Tinh Anh (lưới 3×3, 9 khung hình). |
| `assets/monsters/monster_xichviem_elite_sheet_v1.json` | Tệp meta mô tả kích thước cell (220×230) và pivot ([110, 195]) cho Xích Viêm Tinh Anh. |
| `assets/boss/boss_xichviem_v1.png` | Single sprite đại diện Boss 002 (608×426). |
| `assets/boss/boss_xichviem_sheet_v1.png` | Atlas sheet tích hợp Boss 002 (lưới 6×6, 36 khung hình, kích thước 3648×2556). |
| `assets/boss/boss_xichviem_sheet_v1.json` | Tệp meta mô tả kích thước cell (608×426) và pivot ([304, 388]) cho Boss 002. |
| `Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/` | Cây thư mục sản xuất Boss 002 theo Quy trình sản xuất Boss 1.0 (gồm 9 thư mục 01_Concept đến 09_QA, 216 khung hình PNG 8 hướng, VFX, Hitbox JSON, QA report). |
| `tools/author_xichviem.py` | Script Python tạo lập và tối ưu dữ liệu va chạm, điều hướng và đối tượng cho Xích Viêm Cốc. |
| `data/xichviem/Map_Collision.json` | Dữ liệu lưới va chạm (grid 70×70, 648 ô đi được, 16 footprints vật thể). |
| `data/xichviem/Map_Navigation.json` | Dữ liệu điều hướng A* 8 hướng, điểm spawn, các zone và cổng dịch chuyển. |
| `data/xichviem/Map_Objects.json` | Dữ liệu 22 thực thể trên map (NPC Thủ Hộ Giả, 5 mỏ Viêm Tinh, 8 quái thường, 1 tinh anh, 1 Boss 002). |
| `tools/run_all_checks.mjs` | Công cụ tự động hóa toàn bộ 6 cổng kiểm tra ở Mục 5 của brief, tương tác qua CDP. |
| `proof/agy_proof/01_sealed_gate_pre_q8.png` | Ảnh chứng minh: Cổng phong ấn trước Q8 bị khóa, có thông báo bảo hộ. |
| `proof/agy_proof/02_gate_opened_post_q8.png` | Ảnh chứng minh: Cổng mở sau Q8, đài truyền tống sang Xích Viêm Cốc kích hoạt. |
| `proof/agy_proof/03_overview_xichviem.png` | Ảnh chứng minh: Toàn cảnh Xích Viêm Cốc (địa hình dung nham, thềm nhập cốc). |
| `proof/agy_proof/04_combat_new_monsters.png` | Ảnh chứng minh: Giao chiến quái mới Hỏa Tinh Thử tại Hỏa Nham Vực. |
| `proof/agy_proof/05_combat_new_elite.png` | Ảnh chứng minh: Giao chiến Xích Viêm Tinh Anh to lớn tại Hỏa Nham Vực. |
| `proof/agy_proof/06_boss002_phase1.png` | Ảnh chứng minh: Boss 002 Phase 1 (Liệt Diệm Trảm). |
| `proof/agy_proof/07_boss002_phase2_warning.png` | Ảnh chứng minh: Boss 002 Phase 2 (Vùng cảnh báo đất Liệt Hỏa Địa Chấn - vòng đỏ). |
| `proof/agy_proof/08_boss002_phase3_dash.png` | Ảnh chứng minh: Boss 002 Phase 3 (Đường lao xung kích Xích Viêm Liêu Nguyên). |
| `proof/agy_proof/09_boss002_death.png` | Ảnh chứng minh: Boss 002 bị tiêu diệt tại Xích Viêm Đàn. |
| `proof/agy_proof/10_quest_final_turn_in.png` | Ảnh chứng minh: Hoàn tất trả Q13 tại Thủ Hộ Giả, kết thúc trọn vẹn 13 nhiệm vụ. |
| `docs/agy-checks.log` | Nhật ký ghi nhận kết quả thật của toàn bộ các cổng kiểm tra theo Mục 5. |
| `docs/agy-done.md` | Tài liệu báo cáo tiến độ và bàn giao chính thức của đợt mở rộng. |

### 3.2 Tệp chỉnh sửa

| Đường dẫn tệp | Mô tả thay đổi cụ thể |
| :--- | :--- |
| `tools/build_quests.py` | Bổ sung 5 nhiệm vụ Q9–Q13 vào bảng `QUESTS` và định nghĩa phần thưởng EXP thuần tương ứng vào bảng `REWARDS`. |
| `data/Map_Quests.json` | Tái tạo hoàn chỉnh từ `tools/build_quests.py` (chứa 13 nhiệm vụ, kiểm tra `WALKTHROUGH: PASS`). |
| `js/game_data.js` | Nối thêm (APPEND-ONLY) các cấp độ 9–13 vào `GAME_DATA.levels`; bổ sung hồ sơ quái mới (`hoatinh`, `hoanhamlang`, `viemnham`, `xichviem_elite`) vào `GAME_DATA.monsters`; bổ sung hồ sơ Boss 002 `GAME_DATA.boss_xichviem`; bổ sung các đoạn hội thoại nháp Q9–Q13 vào `GAME_DATA.dialogues`. |
| `js/main.js` | Đăng ký xử lý bản đồ `xichviem` (`PARAMS.get("map") === "xichviem"`); tích hợp cổng dịch chuyển có điều kiện tại `dais_qt` trên `island` khi người chơi đạt `questIndex >= 8`. |
| `js/gameplay.js` | Mở rộng điều hướng chỉ đường xuyên map `island` ↔ `xichviem`; xử lý tương tác cổng phong ấn và mở khóa Q9 tại `dais_qt`; tích hợp luồng thu thập Viêm Tinh Thạch và diệt quái/tinh anh; tích hợp đấu trường Boss 002 với 3 phase, telegraph và cảnh báo đất; áp dụng luật giữ máu quái/boss qua `respawnPlayer`; hiển thị thanh máu Boss 002 trên HUD; hỗ trợ vẽ sprite sheet quái mới và Boss 002 trong `drawActor`; bổ sung các hàm kiểm tra công khai phục vụ kiểm thử headless. |

---

## 4. Chi tiết Thiết kế Hệ thống & Triển khai Kỹ thuật

### 4.1 Bản đồ mới: Xích Viêm Cốc (`xichviem`)
- **Chủ đề & Căn tính Ngũ Hành:** Hệ **HỎA**. Trong thế giới Thanh Vân Tiên Môn, các khu vực hiện hữu đã bao gồm Mộc (Trúc Linh Lâm), Thổ (Vân Ẩn Động), Thủy (Linh Tuyền) và Kim (Bạch Hổ Hậu Sơn). Hệ Hỏa là nguyên tố còn khuyết rõ ràng nhất, hoàn thiện vòng tương sinh tương khắc Ngũ Hành.
- **Phân khu chức năng (3 Zones):**
  1. `xich_viem_ngoai` (Thềm Nhập Cốc): Khu vực đáp cổng truyền tống an toàn, tọa độ [1120, 880], có NPC Thủ Hộ Giả (`npc_xichviem_tientri`) giao và nhận các nhiệm vụ dẫn dắt.
  2. `hoa_nham_vuc` (Hỏa Nham Vực): Vùng thung lũng dung nham rộng lớn, địa hình hiểm trở, nơi trú ngụ của Hỏa Tinh Thử, Hỏa Nham Lang, Viêm Nham Khôi Lỗi và Xích Viêm Tinh Anh, phân bổ 5 điểm thu thập Viêm Tinh Thạch.
  3. `xich_viem_dan` (Xích Viêm Đàn): Đấu trường Boss 002 hình tròn ở mạn bắc (Y <= 580), có đường tiếp cận rộng, không gian trống né đòn bán kính >300px, và cổng rút lui mở xuyên suốt trận chiến.
- **Kỷ luật kết nối cổng chống dội cổng:**
  - Từ `island` sang `xichviem`: Bước vào đài `dais_qt` [2820, 1572] (r=85) -> đáp tại Xích Viêm Cốc [1120, 880], cách cổng về [1120, 1015] đúng 135px.
  - Từ `xichviem` về `island`: Bước vào đài `dais_portal_xv` [1120, 1015] (r=85) -> đáp tại Đảo Chính [2820, 1700], cách đài `dais_qt` đúng 128px.
  - Thời gian ân hạn dịch chuyển 1.2 giây kết hợp cờ `armed` (chỉ kích hoạt lại sau khi nhân vật đã bước ra khỏi bán kính cổng).
  - Điều kiện mở cổng: Kiểm tra nghiêm ngặt `questIndex >= 8`. Trước khi hoàn thành Q8, đài truyền tống từ chối kích hoạt và hiển thị thông điệp phong ấn bảo hộ.

### 4.2 Chuỗi Nhiệm Vụ Q9–Q13
Chuỗi nhiệm vụ được kết nối liền mạch tiếp sau Q8 thông qua bộ sinh `tools/build_quests.py`, phần thưởng kinh nghiệm thuần túy thông qua hook `applyQuestRewards`:

| Mã NV | Tên Nhiệm Vụ | NPC Giao | Mục tiêu chính | Phần thưởng EXP (ĐỀ XUẤT) |
| :--- | :--- | :--- | :--- | :--- |
| `q9_pha_an_nhap_coc` | Phá ấn nhập cốc | Đài Truyền Tống (`dais_qt`) | Bước qua phong ấn đài truyền tống, diện kiến Thủ Hộ Giả tại Thềm Nhập Cốc | +650 EXP |
| `q10_tru_diet_hoa_tinh` | Trừ diệt Hỏa Tinh Thử | Thủ Hộ Giả (`npc_xichviem_tientri`) | Tiến vào Hỏa Nham Vực tiêu diệt 3 con Hỏa Tinh Thử | +750 EXP |
| `q11_thu_thap_viem_tinh` | Thu thập Viêm Tinh | Thủ Hộ Giả (`npc_xichviem_tientri`) | Thu thập 5 khối Viêm Tinh Thạch tại Hỏa Nham Vực | +800 EXP |
| `q12_viem_tinh_thuc_tinh` | Xích Viêm Tinh Anh | Thủ Hộ Giả (`npc_xichviem_tientri`) | Khiêu chiến và đánh bại quái tinh anh Xích Viêm Tinh Anh | +850 EXP |
| `q13_ma_quan_giang_the` | Ma Quân giáng thế | Thủ Hộ Giả (`npc_xichviem_tientri`) | Tiến vào Xích Viêm Đàn, tiêu diệt Boss 002 Xích Viêm Ma Quân | +950 EXP |

*Ghi chú:* Toàn bộ lời thoại của các NPC trong chuỗi Q9–Q13 đều là **BẢN NHÁP** phục vụ kiểm nghiệm luồng chơi.

### 4.3 Quái Mới (3 Quái Thường + 1 Quái Tinh Anh)
Thiết kế theo chuẩn §28: phân biệt rõ rệt qua bóng đen (silhouette), màu sắc chủ đạo Hỏa (đỏ, cam, đen nham thạch), có tư thế báo trước đòn đánh (telegraph):

1. **Hỏa Tinh Thử (`hoatinh`):**
   - Vai trò: Quái quấy rối tầm gần, tốc độ di chuyển nhanh, lao vào cắn xé.
   - Kích thước cell: 120×140 px, Pivot: [60, 110].
   - Telegraph: 450ms (giơ vuốt bốc khói).
2. **Hỏa Nham Lang (`hoanhamlang`):**
   - Vai trò: Quái săn mồi cận chiến, thân phủ vảy đá lửa, đòn cắn uy lực.
   - Kích thước cell: 160×150 px, Pivot: [80, 125].
   - Telegraph: 550ms (lùi mình gầm gừ).
3. **Viêm Nham Khôi Lỗi (`viemnham`):**
   - Vai trò: Quái hộ vệ nặng nề, phòng ngự cao, đòn nện đất diện rộng.
   - Kích thước cell: 180×190 px, Pivot: [90, 160].
   - Telegraph: 700ms (giơ cao hai tay nham thạch).
4. **Xích Viêm Tinh Anh (`xichviem_elite`):**
   - Vai trò: Quái Tinh Anh thống lĩnh Hỏa Nham Vực, thể hình to lớn vượt trội, lượng máu dồi dào, sở hữu chiêu thức phóng gai lửa.
   - Kích thước cell: 220×230 px, Pivot: [110, 195].
   - Telegraph: 850ms (tụ năng lượng lửa toàn thân trước khi bộc phá).

### 4.4 Boss 002: Xích Viêm Ma Quân (`boss_xichviem`)
Boss chủ lực của Xích Viêm Cốc được xây dựng chuẩn theo Quy trình sản xuất Boss 1.0:
- **Cấu trúc thư mục bàn giao:** Đầy đủ 9 thư mục chuẩn từ `01_Concept` đến `09_QA` trong `Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/`.
- **Hoạt ảnh 8 hướng phối cảnh thật:** 216 khung hình độc lập PNG RGBA bám sát quy tắc đặt tên `boss_xichviem_002__{animation}__{direction}__{frame:03}.png` cho 8 hướng (S, SE, E, NE, N, NW, W, SW) và các hành động (Idle, Walk, Run, Attack_Claw, Skill_Roar, Attack_Pounce, Hit, Death).
- **Điểm tựa tiếp đất (Pivot):** Đo chuẩn xác tại tọa độ X=304, Y=388.
- **Cơ chế 3 Phase chiến đấu:**
  - **Phase 1 (HP 100% → 66%, HP > 1056/1600):** Đòn vuốt quỷ *Liệt Diệm Trảm*, tầm đánh 130px, thời gian báo đòn (telegraph) 700ms.
  - **Phase 2 (HP 66% → 33%, HP 528 → 1056):** Tăng tốc độ đánh, kích hoạt kỹ năng diện rộng *Liệt Hỏa Địa Chấn*. Xuất hiện **vòng tròn cảnh báo đất màu đỏ rực** (bán kính r=240px) hiển thị rõ ràng trong 1.15 giây trước khi dung nham phun trào gây sát thương.
  - **Phase 3 (HP < 33%, HP <= 528):** Kích hoạt tuyệt kỹ *Xích Viêm Liêu Nguyên*. Boss gầm vang và khóa hướng người chơi, phóng ra **vệt đường cảnh báo xung kích** dài 420px trong 1.0 giây trước khi lướt tới cực nhanh.
- **Luật giữ máu và Phase khi tử trận:**
  - Đã được kiểm chứng trung thực bằng công cụ tự động CDP: khi người chơi hy sinh trong trận đấu và hồi sinh tại Thềm Nhập Cốc, Boss 002 **giữ nguyên 100% lượng máu hiện tại và phase chiến đấu**, hoàn toàn không hồi máu lại.

---

## 5. Bảng Thông Số Gameplay Cân Bằng (Nhãn: ĐỀ XUẤT)

### 5.1 Bảng Cấp Độ Người Chơi Mở Rộng (`GAME_DATA.levels`)

| Cấp | xpNeed | Max HP | Công (ATK) | Thủ (DEF) | Max MP | MP Hồi/giây | Danh hiệu cảnh giới |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| 1–8 | 2000 | 358 | 53 | 15 | 165 | 7.0 | Luyện Khí Cảnh (1–8 tầng) *(Nguyên vẹn)* |
| **9** | 2750 | 380 | 56 | 17 | 180 | 7.5 | Luyện Khí Cảnh Cửu Tầng *(ĐỀ XUẤT)* |
| **10** | 3600 | 405 | 60 | 19 | 195 | 8.0 | Luyện Khí Viên Mãn *(ĐỀ XUẤT)* |
| **11** | 4550 | 430 | 64 | 21 | 210 | 8.5 | Bán Bộ Trúc Cơ *(ĐỀ XUẤT)* |
| **12** | 5600 | 460 | 68 | 23 | 225 | 9.0 | Trúc Cơ Sơ Kỳ *(ĐỀ XUẤT)* |
| **13** | 6750 | 490 | 72 | 25 | 240 | 9.5 | Trúc Cơ Trung Kỳ *(ĐỀ XUẤT)* |

### 5.2 Bảng Chỉ Số Quái Mới & Boss 002 (Nhãn: ĐỀ XUẤT)

| Tên Thực Thể | Max HP | Công | Thủ | Tốc độ | Tầm đánh | Tầm kích nổ (Aggro) | Báo đòn (Telegraph) | Hồi chiêu (CD) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Hỏa Tinh Thử (`hoatinh`) | 140 | 32 | 8 | 155 | 65px | 220px | 450ms | 1.1s |
| Hỏa Nham Lang (`hoanhamlang`) | 240 | 42 | 12 | 135 | 85px | 240px | 550ms | 1.3s |
| Viêm Nham Khôi Lỗi (`viemnham`) | 380 | 50 | 22 | 80 | 95px | 190px | 700ms | 1.8s |
| Xích Viêm Tinh Anh (`xichviem_elite`) | 650 | 62 | 26 | 105 | 110px | 260px | 850ms | 1.5s |
| **Boss 002 (Xích Viêm Ma Quân)** | **1600** | **78** | **28** | **95** | **130px** | **350px** | **700ms–1150ms** | **1.2s** |

---

## 6. Bảng Kê Trạng Thái Hình Ảnh theo LUẬT GHI NHÃN

Tuân thủ nghiêm ngặt **LUẬT GHI NHÃN** của người dùng (ban hành ngày 2026-11-09): Mọi tài nguyên đồ họa mới chưa qua hội đồng nghiệm thu thẩm mỹ đều được gắn nhãn minh bạch theo bảng sau:

| Tên Tài Nguyên / Thư Mục | Định dạng & Số lượng | Điểm tựa (Pivot) | Nhận diện hướng | Phân loại trạng thái | Ghi chú nghiệm thu |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `assets/ground_xichviem.jpg` | 2240×1120 2D HD 2:1 JPG | N/A | Cố định 2:1 | **CHƯA NGHIỆM THU** | Nền dung nham nguyên bản |
| `assets/monsters/monster_hoatinh_sheet_v1.png` | PNG RGBA 3×3 (9 frames) | [60, 110] | 1 hướng iso | **CHƯA NGHIỆM THU** | Đầy đủ 6 trạng thái hoạt ảnh |
| `assets/monsters/monster_hoanhamlang_sheet_v1.png` | PNG RGBA 3×3 (9 frames) | [80, 125] | 1 hướng iso | **CHƯA NGHIỆM THU** | Đầy đủ 6 trạng thái hoạt ảnh |
| `assets/monsters/monster_viemnham_sheet_v1.png` | PNG RGBA 3×3 (9 frames) | [90, 160] | 1 hướng iso | **CHƯA NGHIỆM THU** | Đầy đủ 6 trạng thái hoạt ảnh |
| `assets/monsters/monster_xichviem_elite_sheet_v1.png` | PNG RGBA 3×3 (9 frames) | [110, 195] | 1 hướng iso | **CHƯA NGHIỆM THU** | Đầy đủ 6 trạng thái hoạt ảnh |
| `assets/boss/boss_xichviem_v1.png` | PNG RGBA 608×426 (1 frame) | [304, 388] | Hướng S | **CHƯA NGHIỆM THU** | Sprite đại diện |
| `assets/boss/boss_xichviem_sheet_v1.png` | PNG RGBA 6×6 (36 frames) | [304, 388] | Đa hướng | **CHƯA NGHIỆM THU** | Atlas sheet tích hợp gameplay |
| `Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/01_Concept/` | 2 tệp PNG Concept HD | N/A | N/A | **CHƯA NGHIỆM THU** | Concept mỹ thuật 2D HD |
| `Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/02_Turnaround_8_Directions/` | 8 tệp PNG RGBA | [304, 388] | 8 hướng thật | **CHƯA NGHIỆM THU** | Turnaround 8 góc nhìn phối cảnh thật |
| `Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/03_Animation/` | 216 tệp PNG RGBA độc lập | [304, 388] | 8 hướng × 8 bộ | **CHƯA NGHIỆM THU** | Khung độc lập đặt tên chuẩn quy trình |
| `Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/04_VFX/` | 4 tệp PNG RGBA VFX cảnh báo | [304, 388] | N/A | **CHƯA NGHIỆM THU** | Tách rời thân nhân vật |
| `Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/05_Hitbox/` | Hitbox JSON cấu hình độc lập | N/A | N/A | **CHƯA NGHIỆM THU** | Hurtbox & Hitbox theo từng phase |

---

## 7. Tự Đánh Giá & Các Điểm Yếu Còn Lại (Self-Assessment)

Với tinh thần trách nhiệm và minh bạch kỹ thuật, đội xây dựng tự đánh giá và công khai các hạn chế còn tồn tại trong bản build này:
1. **Cân bằng số liệu mang tính chất đề xuất sơ bộ:**
   - Các chỉ số HP, ATK, DEF của quái mới và Boss 002 được căn chỉnh để một nhân vật cấp 8 (sau khi hoàn thành Q8) có thể đánh bại nếu thao tác né đòn hợp lý. Tuy nhiên, các chỉ số này cần trải qua đợt thử nghiệm người chơi thực tế (playtesting) để đạt độ thử thách tối ưu.
2. **Kích thước Atlas tích hợp game:**
   - Để bảo đảm hiệu năng tải trang và tương thích mượt mà với bộ nhớ WebGL trên các thiết bị di động tầm trung, tệp tích hợp trực tiếp `assets/boss/boss_xichviem_sheet_v1.png` được tổ chức ở dạng atlas 36 khung tiêu biểu (đủ thể hiện 3 phase và các hành vi then chốt), trong khi toàn bộ 216 khung hình độc lập 8 hướng được lưu trữ đầy đủ tại thư mục sản xuất `Tien_Lo/Boss/Boss_002_Xich_Viem_Ma_Quan/03_Animation/` sẵn sàng phục vụ cho pipeline streaming sprite cao cấp hơn ở các giai đoạn sau.
3. **Phạm vi lưu trữ trạng thái quái:**
   - Tương tự như phiên bản cơ sở trước đó, luật giữ máu quái và Boss 002 được áp dụng triệt để khi nhân vật tử vong và hồi sinh trong cùng phiên chơi (`respawnPlayer`). Nếu người chơi chủ động F5 tải lại toàn bộ trang web, trạng thái quái sẽ được khởi tạo lại theo thiết kế lưu trữ hiện hành của game (chỉ lưu tiến độ nhiệm vụ và chỉ số nhân vật trong `localStorage`).
4. **Vùng đóng băng:**
   - Không có bất kỳ dòng mã nào trong Vùng Đóng Băng bị can thiệp. Hệ thống kỹ năng và HUD chiến đấu hoạt động ổn định và nguyên vẹn 100%.

---
**KẾT LUẬN NGHIỆM THU:**  
Toàn bộ yêu cầu của `docs/agy-brief.md` đã được thực hiện trọn vẹn, vượt qua tất cả các cổng kiểm tra kỹ thuật (Map Audits 100% PASS, Quest Walkthrough PASS, 10 kịch bản kiểm thử Headless PASS, giữ máu Boss 002 PASS, Vùng đóng băng bảo toàn). Bản build sẵn sàng bàn giao cho người dùng và các đội ngũ tiếp quản.
