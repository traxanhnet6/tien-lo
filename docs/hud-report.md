# Báo cáo đợt HUD2 — Tiên Lộ (bản isometric): đóng nợ Giai đoạn 1 + làm Giai đoạn 2

- Lệnh: Bui, 00:52 ngày 2026-11-10 — "Làm thêm giai đoạn sau".
- Bản chuẩn: `game-ngu-hanh-design/Tien-Lo-He-Thong-Nut-Bam-Ky-Nang-1.0.md` (Mục 9 là thứ tự triển khai; cấu hình khóa: điện thoại + PC · 4 kỹ năng + 1 tuyệt kỹ · cả hai cách ngắm · tự chọn quái gần nhất).
- Cây làm việc: `game-tien-lo-hud2/` — bản sao thật (`cp -a`, không hardlink) từ `game-tien-lo-agy2/`. Không sửa cây agy1, không sửa cây agy2, không sửa dữ liệu nhiệm vụ/phần thưởng, không đụng nội dung Antigravity (map Xích Viêm, Q9–Q13, Boss 002) ngoài việc lái kiểm chứng.
- Không triển khai đi đâu khác: bản isometric chưa có bản live riêng; cây hud2 là nơi bàn giao.

## 1. Kiểm kê đầu đợt (đúng như mô tả của parent)

- `data/Map_Quests.json`: 13 nhiệm vụ (Q1–Q13).
- `assets/skills/`: 5 atlas GĐ1 (thaicuc, kimcang, philong, batquai, nguhanhquyen) + fx_thaicuc_ring.png.
- `assets/hud/`: 9 icon GĐ1.
- Mã HUD GĐ1 có nguyên vẹn từ agy1: mô hình MP/năng lượng, SKILLS 5 chiêu schema 14 trường, máy trạng thái thi triển (giữ-ngắm ≥180ms, pendingSkill đi vào tầm 7 giây, ngắt chiêu theo tiền lệ K2: đòn nặng ≥10% máu tối đa trước điểm trúng → hủy + hoàn nửa mana + hồi chiêu 2 giây), né 150px/0.22s hồi 3s, thủ giữ giảm 60% sát thương — mọi con số đều provisional từ GĐ1.

## 2. Việc 1 — Đóng nợ kiểm chứng Giai đoạn 1

### 2.1 Harness phần A chạy lại: 41 PASS / 0 FAIL — "ALL CHECKS PASS"

Log thật: `proof/hud-verify/hud-harness-partA-final.log` (harness: `tools/hud-harness-hud2.mjs`, biến môi trường HUD_PART=a).

Cụm thiếu-mana của SK4 (nợ GĐ1: 36 PASS/7 FAIL do dàn cảnh harness) đã PASS thật, không nới khẳng định: xả MP bằng cách mượn bảng kỹ năng thay ba chiêu tung-tức-thì-không-cần-mục-tiêu vào các ô (Hỏa Vân Toàn 24 MP → SK1, Thái Cực Chưởng 12 MP → SK2, Thiên Phong Bộ 14 MP → SK3), tung liên tiếp ba chiêu (50 MP trong ~2 giây, nhanh hơn hồi 3,5 MP/giây) đưa MP xuống dưới 22 trong khi SK4 chưa hề dùng (hồi chiêu 0). SK4 bị từ chối đúng luật: nháy báo thiếu mana, không thi triển, không trừ MP. Sau đó các ô được trả về mặc định. Toàn phần A còn gồm: bảng trạng thái 60/60 MP, joystick 8 hướng, WASD, tung SK1–SK4 có khung gói chạy thật + trừ MP + lớp phủ hồi chiêu, SK3 lướt tới, 0 lỗi trang.

### 2.2 Harness phần B: 27 PASS / 0 FAIL — "ALL CHECKS PASS"

Log thật: `proof/hud-verify/hud-harness-partB-final.log` (HUD_PART=b). Gồm:

- Năng lượng ULT tích bằng chiến đấu thật (đánh trúng quái +2, bị đánh trúng +6) lên đủ 100 → nút ULT mang lớp phát sáng sẵn sàng (`ult-ready`) → tung Ngũ Hành Quyền (khung gói chạy 1→7, mục tiêu 85→0 máu, năng lượng 100→14 do cộng dồn trong lúc thi triển) → thước năng lượng hoạt động đúng vòng đời.
- Né bằng nút và phím Space (dàn cảnh ở quảng trường Sơn Môn thoáng — trong rừng cú lướt đâm cây nên bằng 0px, lỗi dàn cảnh, không phải logic).
- Thủ bằng nút giữ và phím Shift.
- Giữ–kéo ngắm hướng Đông Bắc: góc −45°, hàng khung 1.
- Phím Q (tung chiêu), J (đánh thường), Tab (đổi mục tiêu).
- Luật chạm NPC: chạm từ xa → nhân vật đi bộ tới và mở thoại đúng một lần khi đến; chạm gần → mở thoại ngay.

### 2.3 Quyết định điểm mở tryCast (đã cài + đã kiểm chứng)

Khi một chiêu vừa đang hồi chiêu vừa thiếu mana/năng lượng, người chơi thấy lý do THIẾU TÀI NGUYÊN trước, việc chặn thi triển giữ nguyên. Hàm `castBlockReason(def)` trong `js/gameplay.js` trả theo thứ tự ưu tiên: `"energy"` → `"mana"` → `"cooldown"`. Lý do: thiếu tài nguyên là thông tin hành động được (đi cày/hồi phục), còn hồi chiêu chỉ là chờ; hiện hồi chiêu trước sẽ khiến người chơi tưởng chiêu sẵn sàng trong khi thật ra không đủ mana. Khẳng định tương ứng trong harness phần A PASS.

### 2.4 Hồi quy chuỗi nhiệm vụ với HUD hiện diện

Driver: `tools/quest-regression-hud2.mjs` (bản sao của driver finisher agy2, xem lý do ở mục 6). Log chính: `proof/quest-regression-hud2/playtest-q1-q13.log`. Kết quả đọc từ log thật:

- **Kiểm tra phong ấn đài (trước Q8): PASS cả ba khẳng định** — tương tác đài khi chưa đủ điều kiện: bản đồ không đổi, nhiệm vụ không nhích, thoại từ chối có nhắc phong ấn.
- **Q1→Q11: hoàn thành trọn vẹn, mọi khẳng định PASS**, gồm chuỗi thưởng EXP kiểm từng chặng (…→ 350 sau Q3 → 800 sau Q5 → 1150 sau Q6 → 4450 sau Q11, đúng mô hình cấp theo tổng EXP qua applyQuestRewards).
- **Boss Q7 Bạch Hổ Sơn Quân: hạ thành công** (sau 78 lần chết mài mòn — "tường mềm phase 3" đã báo từ đợt rewards, không phải lỗi). **Luật giữ máu/pha boss khi người chơi chết: PASS ở mọi lần kiểm** (ví dụ 1133→1133 pha 1; 266→266 pha 3; 173→173 pha 3). Luật giữ máu cũng PASS ở quái thường và tinh anh (gồm `xichviem_elite`: 141→141 trên 420).
- **Boss 002 Xích Viêm Ma Quân: bị hạ trong lượt chạy chính** ("(h) Boss 002 killed in honest play" PASS, 1600 máu tối đa) và luật giữ máu + giữ pha của nó cũng PASS (179→179, pha 3→3).
- **Điểm gãy của lượt chạy chính — Q12 không khép được trong lượt này:** driver ghi "target dead: xichviem_elite" nhưng trạng thái nhiệm vụ vẫn `active`, tiến độ 0 → 4 khẳng định phía sau FAIL (nộp Q12/+850 EXP, chuyển Q13, nhận Q13, dẫn đường Q13) và lượt chạy kết thúc bằng quá hạn chờ thoại thắng Boss 002 (thoại không mở vì nhiệm vụ đang hoạt động lúc hạ boss là Q12, không phải Q13). Tổng lượt chính: **32 ASSERT PASS / 5 ASSERT FAIL** (khẳng định thứ năm là "đã vào đủ 3 pha của Boss 002" — chỉ thấy pha 3 vì boss đã bị đánh tụt pha từ các trận trại trước khi đoạn Q13 bắt đầu; hệ quả dây chuyền của cùng một điểm gãy, không phải lỗi pha của game).
- **Phân loại điểm gãy bằng các đoạn bổ sung (probe, save chế tác đúng định dạng `tl3_save_v1`, thao tác chạm thật; log ở `proof/quest-regression-hud2/supplementary-*`):**
  - probe13 + probe14: từ save "Q12 đang hoạt động", đánh hạ `mon_xichviem_elite` bằng chạm thật → nhiệm vụ chuyển `ready_to_turn_in`, tiến độ 1 — **đăng ký hạ tinh anh của game ĐÚNG, lặp lại hai lần**.
  - probe15: nộp Q12 tại Thủ Hộ Giả → chuỗi tiến sang Q13 (index 12).
  - probe16: từ save "Q13 đang hoạt động", hạ Boss 002 bằng chạm thật (có dùng nút kỹ năng SK2) → `ready_to_turn_in`, tiến độ 1, thoại thắng mở đúng luật.
  - probe18: nộp Q13 → **index 13, trạng thái "completed", XP 5300 → 6250 đúng +950**.
  - Kết luận: mã game của Q12/Q13 đúng ở mọi mắt xích khi chạy tách riêng. Điểm gãy của lượt chính là rối sổ đếm của driver trong lượt chạy dài: con tinh anh đã bị hạ một lần ngay trong lúc dọn trại của Q11 trên cùng một lần nạp trang (log dòng 487), quái không có cơ chế hồi sinh ngoài nạp lại trang qua cổng, và hàm đếm xác của driver (`fightMonster` đếm số xác theo loại) mất đồng bộ sau các lần nạp lại trang — cú "target dead" ở đoạn Q12 không tương ứng với một lần hạ được game ghi nhận. Đây là lỗi của lượt lái kiểm chứng, không phải lỗi logic nhiệm vụ; chuỗi Q1→Q13 được coi là đã kiểm chứng khép kín qua lượt chính (Q1–Q11 + hạ cả hai boss + luật giữ máu) cộng các đoạn bổ sung (Q12 hạ tinh anh → nộp Q12 → nhận Q13 → hạ Boss 002 trong Q13 → nộp Q13 hoàn thành).
- Ghi chú phụ từ các probe: cú chạm mở thoại đầu tiên ngay sau khi dịch chuyển tạo cảnh đôi khi không mở được thoại (probe15/18 đều cần chạm lần hai) — đây là cùng một hiện tượng mà cơ chế thử lại của `talkAt` trong driver gốc được thiết kế để chịu; người chơi thật chạm lại là xong, không phải khóa mềm.

## 3. Việc 2 — Giai đoạn 2 (Mục 9 của bản chuẩn)

### 3.1 Giữ–kéo–thả để ngắm theo target_type (đã có từ GĐ1, hoàn thiện ở GĐ2)

- Kéo chỉ bắt đầu từ nút kỹ năng (giữ ≥180ms hoặc kéo quá 26px); kéo trên mặt đất vẫn là lia cam/đi bộ như cũ.
- Vùng định hướng vẽ theo target_type của từng chiêu: hướng (directional), điểm (area tại điểm ngắm/đơn mục tiêu), quanh thân (area/self).
- Mới ở GĐ2: vùng hủy ngắm — kéo ngược về trong vòng 16px quanh nút thì ngắm chuyển trạng thái hủy (vẽ elip đỏ tại chân nhân vật); thả trong vùng hủy = hủy ngắm, không tốn mana, không vào hồi chiêu, không thi triển. Kiểm chứng trong harness GĐ2 (mục 3.4).

### 3.2 Bảng kỹ năng đủ 10 chiêu + thay chiêu vào SK1–SK4

- Nút chip "Kỹ năng" mở bảng `#skillPanel`: đủ 10 chiêu Hà Nhân với icon vẽ thật, tên tiếng Việt, dòng mô tả (loại mục tiêu · MP/năng lượng · hồi chiêu · hệ số sát thương), huy hiệu "SKn · Đang gắn" cho chiêu đang gắn, "ULT · Cố định" cho Ngũ Hành Quyền, và 4 nút gán SK1–SK4 cho chiêu chưa gắn.
- Thay chiêu theo cơ chế hoán đổi: gán một chiêu chưa gắn vào ô đang có chiêu khác thì chiêu cũ rời ô. Chiêu đang gắn không có nút gán (muốn dời phải gán chiêu khác vào ô của nó trước).
- Chỉ thay được khi ngoài chiến đấu — ở gần quái còn sống (trong 460px) hoặc đang có mục tiêu/boss thì bị từ chối với chữ nổi "Chỉ thay chiêu khi ngoài chiến đấu!".
- Lựa chọn lưu vào save (`skillSlots`), khôi phục khi tải lại có kiểm tra hợp lệ: đúng 5 mục, 4 ô đầu khác nhau và không phải tuyệt kỹ, ô 5 luôn là Ngũ Hành Quyền. Hồi chiêu tính theo chiêu, không theo ô.
- Sửa giao diện kèm theo: đầu bảng được ghim (sticky) để nút Đóng luôn với tới được sau khi cuộn sâu; hàng chiêu chưa gắn cho khối nút gán xuống dòng riêng (bản đầu cột chữ bị ép hẹp, xuống dòng từng từ — đã sửa và chụp lại: `proof/hud2-verify/skill_panel_layout_fixed.png`).

### 3.3 Năm chiêu mới — nối gói khung + số provisional

Năm atlas được chép nguyên trạng từ chương trình 576 PNG (`game-ngu-hanh-art-<slug>/atlas/`): hoavan, bangphong, loidinh, thienphong, voanh → `assets/skills/<slug>_atlas.png/.json`; hoạt ảnh tung chiêu chạy qua đúng cơ chế `drawCastFrame` hiện có (8 hàng hướng, pivot đo thật trong JSON của từng gói, không vẽ thêm kiếm khi tung chiêu tay không). Năm icon vẽ bằng đúng thuật toán `tools/build_hud_icons.py` như 9 icon GĐ1 (tổng 14 icon trong `assets/hud/`).

Số liệu (schema 14 trường như 5 chiêu cũ) — TẤT CẢ LÀ PROVISIONAL, đặt theo cùng thang sức mạnh tương đối của 5 chiêu đã có, chờ đợt cân bằng riêng:

| Chiêu | Loại | Hệ số | Hồi chiêu | MP | Tầm | Thời gian tung | Lý do ngắn |
|---|---|---|---|---|---|---|---|
| Hỏa Vân Toàn | Diện rộng quanh thân (r170) | ×1.6 | 13s | 24 | 170 | 0.6s | Diện quanh thân mạnh hơn Bát Quái (×1.4, r175) một bậc nên hệ số cao hơn, hồi chiêu và MP cao nhất nhóm diện |
| Băng Phong Chưởng | Đơn mục tiêu | ×1.7 | 11s | 20 | 300 | 0.5s | Đòn tầm xa vừa: hệ số dưới Kim Cang (×2.2 cận chiến) vì an toàn nhờ tầm 300 |
| Lôi Đình Kích | Đơn mục tiêu | ×2.0 | 9s | 19 | 340 | 0.45s | Đòn xa nhanh: hệ số gần Kim Cang nhưng tung nhanh hơn, bù bằng hồi chiêu ngắn hơn Kim Cang 1s |
| Thiên Phong Bộ | Thân pháp (self — lướt, không sát thương) | ×0 | 8s | 14 | 260 = quãng lướt | 0.5s | Thuần di chuyển: quãng lướt 260px dài hơn né thường (150px) nên có MP và hồi chiêu riêng; lướt kích hoạt ở 40% thời gian tung, theo hướng ngắm/mặt |
| Vô Ảnh Liên Hoàn | Đơn mục tiêu | ×2.4 | 14s | 26 | 170 | 0.7s | Đòn đơn mạnh nhất nhóm thường: hệ số cao nhất (trên Kim Cang ×2.2) đổi bằng hồi chiêu dài nhất, MP cao nhất, tung chậm nhất, tầm ngắn |

Loại `self` (Thiên Phong Bộ) được hỗ trợ mới trong máy thi triển: tung theo hướng mặt/hướng ngắm, không cần mục tiêu, bước lướt dùng `TL2.stepPlayerPx` (có trượt trục khi vướng vật cản như né thường).

### 3.4 Harness GĐ2: ALL CHECKS PASS

Log thật: `proof/hud2-verify/hud2-harness-final.log` (harness: `tools/hud2-harness.mjs`). Gồm:

- Bảng mở đủ 10 dòng, đủ 10 tên tiếng Việt.
- Thay Lôi Đình Kích vào SK2: icon + nhãn nút đổi, Kim Cang Quyền rời ô, không trùng chiêu; lựa chọn còn nguyên sau khi tải lại trang.
- Tung Lôi Đình Kích bằng chạm (tự chọn quái gần nhất): khung gói chạy, quái 85→21 máu, trừ đúng 19 MP, hồi chiêu theo chiêu 7,5s tại thời điểm đo.
- Tung Lôi Đình Kích bằng giữ–kéo ngắm hướng Đông Bắc: hàng khung 1 (quái dàn cảnh đúng hướng Đông Bắc của nhân vật; khi quái nằm đúng hướng Đông, điểm ngắm trượt khỏi bán kính chọn 110px và game rơi về mục tiêu đã khóa — logic game đúng, dàn cảnh đã sửa).
- Vùng hủy: kéo về trong 16px → trạng thái hủy bật; thả → không thi triển, không trừ MP, không hồi chiêu.
- Thiên Phong Bộ gán vào SK3, tung bằng chạm: lướt đúng 260px (dx=260), trừ 14 MP (dàn cảnh ở quảng trường Sơn Môn; phía đông ô của Tiên Đồng bị khối xây cổng chặn nên lướt bằng 0 — lỗi địa hình dàn cảnh).
- Từ chối thay chiêu giữa chiến đấu: các ô giữ nguyên.

### 3.5 Thước năng lượng ULT

Đã kiểm chứng trọn vòng ở phần B (mục 2.2): tích +2 mỗi đòn trúng quái, +6 mỗi lần bị đánh trúng; đầy 100 → nút phát sáng trạng thái sẵn sàng; tung được; năng lượng trừ 100 khi tung (số dư 14 trong log là phần cộng dồn trong lúc thi triển).

## 4. Tình trạng gói Thiên Phong Bộ — ĐẠT CÓ ĐIỀU KIỆN, nối nguyên trạng

Gói Thiên Phong Bộ trong chương trình 576 PNG chỉ ĐẠT CÓ ĐIỀU KIỆN: 18/64 khung được fit theo khung hiệu ứng, thân nhân vật cao ~340px thay vì chuẩn 400px. Ở đợt này gói được nối nguyên trạng như bốn gói còn lại (theo đúng lệnh: không tự sinh lại; chỉ sinh lại khi Bui yêu cầu siết riêng). Khi tung trong game, khung hình vẫn chạy đúng pivot đo thật của gói; hiệu ứng gió của gói chiếm phần lớn khung nên ở cỡ thật trong game, nhân vật đọc nhỏ hơn các chiêu khác một chút trong lúc lướt. Ảnh bằng chứng: `proof/hud2-verify/cast_thienphong.png`.

## 5. Ảnh chụp bằng chứng

- `proof/hud2-verify/skill_panel_10.png` — bảng kỹ năng 10 chiêu (bản trước sửa bố cục).
- `proof/hud2-verify/skill_panel_layout_fixed.png` — bảng sau khi sửa bố cục hàng chưa gắn.
- `proof/hud2-verify/cluster_after_swap.png` — cụm nút sau khi thay chiêu (SK2 = Lôi Đình Kích).
- `proof/hud2-verify/aim_loidinh_ne.png` — giữ–kéo ngắm hướng Đông Bắc: đường ngắm + vòng mục tiêu tại quái.
- `proof/hud2-verify/aim_cancel_zone.png` — vùng hủy ngắm (ảnh bị banner hồi sinh che một phần; bằng chứng chính là trạng thái đọc từ log harness).
- `proof/hud2-verify/cast_thienphong.png` — Thiên Phong Bộ đang lướt, MP 47/60 sau khi trừ 14.
- `proof/hud-verify/cast_nguhanh.png` — Ngũ Hành Quyền đang nổ (số sát thương −95 trên quái).
- `proof/hud-verify/hud_phone_idle.png`, `cast_thaicuc/kimcang/philong/batquai.png`, `cooldown_state.png`, `aim_state.png`, `hud_combat.png` — bộ ảnh GĐ1 chạy lại trên cây hud2.

## 6. Ghi chú kỹ thuật của đợt (bài học harness)

- Mỗi harness dùng cổng và hồ sơ Chrome riêng theo PID + hook thoát để dọn cây Chrome của chính nó: cổng/hồ sơ cố định từng khiến lượt chạy sau nối vào Chrome mồ côi của lượt chết trước (triệu chứng: trạng thái khởi động lạ như MP 44, năng lượng 100 sẵn).
- Đo thi triển bằng bộ ghi phía trang (`window.__castRec`, lấy mẫu 30ms) vì vòng lặp CDP dưới tải máy ảo chậm hơn cửa sổ tung chiêu 0,5s; khẳng định không đổi.
- Bản đồ trạng thái chết: game không có hồi máu theo thời gian — harness phải tự đảm bảo nhân vật còn sống trước mỗi phép đo (chết thì mọi chiêu bị từ chối đúng luật).
- Điểm yên tĩnh để thay chiêu: cạnh Tiên Đồng (2405, 2425) — quái sống gần nhất cách 1413px; điểm (1200, 1300) chỉ cách quái 220px nên bị luật "ngoài chiến đấu" từ chối đúng.
- Chuỗi hồi quy nhiệm vụ chạy bằng driver riêng `tools/quest-regression-hud2.mjs` (xem mục 2.4): driver finisher gốc của agy2 kẹt cứng renderer tại đúng thao tác tương tác đài phong ấn trong 6 lượt chạy liên tiếp trên máy ảo này (renderer đứng ở futex, CDP và Debugger đều câm, thử cả chuột lẫn chạm, cả hai cấu hình GPU), trong khi mọi mảnh riêng lẻ (thoại phong ấn, tìm đường A*, chạm) đều khỏe trong các probe độc lập, và họ harness HUD — vốn tạo cảnh bằng dịch chuyển rồi chạm thật — chạy sạch hơn 15 phiên cùng ngày. Bản hồi quy giữ nguyên toàn bộ khẳng định, đối thoại, chiến đấu, cổng dịch chuyển (tải lại trang thật) của driver gốc; chỉ thay các chặng đi bộ dài bằng dịch chuyển tạo cảnh tới cách đích ~300px, đoạn cuối vẫn đi bộ thật và chạm thật. Bản sao finisher đã chỉnh phục vụ điều tra (`tools/finisher-playtest-hud2.mjs`: cổng/hồ sơ riêng theo PID, thử lại khi CDP quá hạn, chế độ chạm, đo thời gian CDP) được giữ lại trong cây để đối chiếu, không phải driver bàn giao.

## 7. Ngoài phạm vi / còn chờ

- Toàn bộ số liệu kỹ năng (cả 5 chiêu cũ lẫn 5 chiêu mới) vẫn là provisional, chờ đợt cân bằng riêng.
- Gói Thiên Phong Bộ: chờ Bui quyết có siết lại 18 khung fit-hiệu-ứng hay không.
- Đợt này không triển khai lên live (bản isometric chưa có địa chỉ live riêng).

## 8. Bổ sung LAYOUT01 — lỗi cột chữ bị ép xuống dòng từng từ trong bảng kỹ năng (sửa sau bàn giao)

### 8.1 Đính chính bối cảnh hai ảnh đối chứng

Cặp ảnh parent dùng đối chứng KHÔNG phải hai trạng thái cuộn của cùng một mã nguồn:

- `proof/hud2-verify/skill_panel_10.png` (19:50:44 UTC) và `cluster_after_swap.png` (19:50:48 UTC) thuộc cùng lượt harness TRƯỚC sửa — và ngay trong `skill_panel_10.png`, ở đầu bảng (chưa cuộn, chưa hoán đổi), hàng Hỏa Vân Toàn đã bị ép cột chữ. Lỗi tồn tại ở MỌI vị trí cuộn trong trạng thái mã đó, không phụ thuộc cuộn.
- `css/style.css` được sửa lúc 20:15:29 UTC (bản sửa bố cục trong đợt); `skill_panel_layout_fixed.png` chụp 20:16:18 UTC — là trạng thái SAU sửa. Nhật ký harness đạt (19:52) chạy TRƯỚC bản sửa CSS này, nên trước LAYOUT01 chưa từng có lượt harness đầy đủ nào chạy trên CSS sau sửa.

### 8.2 Nguyên nhân gốc (đã tái hiện bằng thực nghiệm, không suy đoán)

Khi khối nút gán ("Gắn vào:" + 4 nút SK, bề rộng nội dung ~226px) nằm CHUNG MỘT DÒNG flex với cột chữ và hàng không được xuống dòng, cột chữ `.skill-row-main` (`flex: 1 1 170px`, co được, không có sàn bề rộng) phải gánh toàn bộ phần tràn (biểu tượng 46 + cột chữ 170 + khối gán 226 + khoảng cách 20 = 462px so với 300px khả dụng) và sụp xuống bề rộng từng từ; hàng phình cao ~350px, khối gán giữ nguyên 226px nằm giữa hàng theo chiều dọc. Hàng đã gắn chỉ có huy hiệu ~107px tranh chỗ nên chỉ bị ép nhẹ (cột chữ ~131px, mô tả 3 dòng — khớp hàng Thái Cực trong `skill_panel_10.png`).

- Tái hiện trên cây hiện tại bằng harness `tools/layout01-repro.mjs`, tiêm ghi đè ép `.skill-row { flex-wrap: nowrap }` + khối gán `flex: none`: hàng chưa gắn sụp đúng chữ ký lỗi (cột chữ 12px, tên 3 dòng, mô tả ~275px, hàng cao 336–371px, khối gán 226px cùng dòng ở giữa hàng) — ảnh `proof/layout01-verify/layout01_nowidth_mid_afterswap.png` trùng khớp ảnh lỗi gốc `cluster_after_swap.png`.
- Cây trước LAYOUT01 chỉ tránh được lỗi nhờ cặp `flex-wrap: wrap` + quy tắc `.skill-row-actions:has(.skill-assign-btn) { flex: 1 1 100% }`: chỉ cần mất xuống dòng là mọi hàng xuống cấp ngay (cắt thử: cột chữ 131/86px), và quy tắc `:has()` bị loại bỏ lặng lẽ trên mọi trình duyệt/WebView không hỗ trợ `:has()`.

### 8.3 Bản sửa (tối thiểu, đúng cơ chế lỗi)

- `css/style.css` — `.skill-row-main`: `min-width: 0` → `min-width: 150px`. Cột chữ có sàn cứng, không trạng thái flex nào ép được nó xuống từng từ nữa.
- `css/style.css` — `.skill-row-actions:has(.skill-assign-btn)` → `.skill-row-actions.assign` (giữ nguyên khai báo `flex: 1 1 100%; justify-content: flex-start; margin-top: 2px`): bỏ phụ thuộc vào `:has()`.
- `js/gameplay.js` (`renderSkillPanel`) — hàng chưa gắn (không phải tuyệt kỹ, chưa vào ô) nay nhận lớp `assign` tường minh ngay trong DOM (`skill-row-actions assign`); hàng đã gắn và hàng tuyệt kỹ giữ nguyên lớp cũ. Không đổi nội dung, số liệu hay hành vi thay chiêu.

### 8.4 Kiểm chứng sau sửa

- Harness đo bố cục `tools/layout01-repro.mjs after`: 0 hàng lỗi ở cả bốn trạng thái (đầu bảng / giữa bảng đúng khung hình ảnh lỗi / cuối bảng / giữa bảng sau khi gắn Lôi Đình Kích vào SK2); hình học giữ nguyên trạng thái tốt: cột chữ 248px, tên 19px một dòng, mô tả 32px, khối gán ở dòng riêng. Ảnh: `proof/layout01-verify/layout01_after_top.png`, `layout01_after_mid.png`, `layout01_after_bottom.png`, `layout01_after_mid_afterswap.png`.
- Phép thử miễn nhiễm (`immune`): ép `.skill-row { flex-wrap: nowrap }` lên cây ĐÃ sửa — vẫn 0 hàng lỗi; cột chữ đứng đúng sàn 150px, tên vẫn một dòng 19px ở mọi hàng. Cơ chế sụp cột chữ đã bị bịt ở mức cấu trúc.
- Harness giai đoạn 2 chạy lại đầy đủ (`node tools/hud2-harness.mjs`, nhật ký `proof/hud2-verify/hud2-harness.log`): **ALL CHECKS PASS**, 0 ngoại lệ trang — đây là lượt đạt đầy đủ đầu tiên trên mã sau bản sửa CSS 20:15 (nhật ký `hud2-harness-final.log` cũ chạy trước bản sửa đó).
