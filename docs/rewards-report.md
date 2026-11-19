# Tiên Lộ — Đợt phần thưởng nhiệm vụ + máu quái giữ nguyên khi hồi sinh

Ngày: 2026-11-09. Cây: `game-tien-lo-agy1/`. Trạng thái: **HOÀN TẤT, đã kiểm chứng bằng một lượt chơi thật trọn chuỗi Q1→Q8 không gián đoạn** (log: `proof/finisher-verify/playtest-q1-q8.log`).

## Hai lệnh của Bui mà đợt này thực hiện

1. **16:33** — chọn ô "Thêm phần thưởng cho Q1–Q5 để nhân vật mạnh dần lên": thêm phần thưởng cho nhiệm vụ để nhân vật mạnh dần theo chuỗi (Bui chọn hướng này thay vì làm yếu tinh anh Q6). Đội mở rộng tự nhiên sang Q6–Q8 để không tái tạo đúng khoảng trống đó ở bước sau — đã khai rõ là phần mở rộng của đội.
2. **16:35–16:36 (lệnh sửa, thay thế phần tương ứng của brief gốc)** — "Khi chết ta hồi sinh máu quái giữ nguyên không hồi đầy": khi người chơi chết và hồi sinh, máu quái/tinh anh/boss GIỮ NGUYÊN, không hồi đầy. Vì lệnh này, đường cong phần thưởng được hiệu chỉnh GỌN hơn (không cần thắng tinh anh trong một mạng từ nhân vật mới tinh nữa).

Không đụng: chỉ số quái/boss, bước nhiệm vụ, lời thoại.

## Lệnh 2 — máu quái giữ nguyên khi người chơi chết (làm trước, vì nó đổi hiệu chỉnh)

`respawnPlayer()` trong `js/gameplay.js` viết lại:

- Quái thường còn sống: giữ nguyên HP; chỉ đặt lại trạng thái về IDLE, vị trí về điểm nhà, xóa đường đi/chiêu đang dùng.
- Tinh anh Thạch Vệ: giữ nguyên HP (cùng đường code quái thường).
- Boss Bạch Hổ: giữ nguyên HP **và phase** (phase chỉ tiến khi HP giảm nên nhất quán); đặt lại trạng thái/vị trí, tắt cờ đã giao chiến, xóa cảnh báo chiêu.
- Quái đã chết: vẫn chết (không hồi sinh oan).

**Các mép đã phủ:** tinh anh, boss kèm phase, quái thường — trên đường chết → hồi sinh.
**Hai trường hợp HP vẫn đặt lại, khai rõ:**
- (a) Tải lại toàn trang: quái khởi tạo lại đầy máu, vì định dạng save hiện tại (`tl3_save_v1`) không lưu HP quái. Lời của Bui nói về chết → hồi sinh, không nói về tải lại trang; đội không tự mở rộng định dạng save trong đợt này.
- (b) Hồi máu khi tuột dây xích (+20 HP, một lần, khi quái bỏ đuổi ở ngoài 1,8× bán kính đuổi) là hành vi có từ trước, không liên quan cái chết, không phải hồi đầy — giữ nguyên.

## Lệnh 1 — bảng phần thưởng (số do đội soạn theo lệnh của Bui)

Phần thưởng là EXP thuần (kiểm tra dữ liệu vật phẩm: game không có dữ liệu vật phẩm có tác dụng — túi đồ chỉ là chuỗi hiển thị — nên đội không bịa vật phẩm).

| Nhiệm vụ | EXP | EXP tích lũy | Cấp sau khi trả | HP tối đa | Tấn công | Phòng thủ |
|---|---|---|---|---|---|---|
| Q1 Tân nhân nhập môn | 60 | 60 | 1 | 220 | 32 | 6 |
| Q2 Bước chân tu tiên | 90 | 150 | 2 | 238 | 35 | 7 |
| Q3 Luyện kiếm nhập môn | 200 | 350 | 3 | 256 | 38 | 9 |
| Q4 Thu thập linh thảo | 200 | 550 | 4 | 274 | 41 | 10 |
| Q5 Truy tìm dấu vết | 250 | 800 | 5 | 292 | 44 | 11 |
| Q6 Thạch Vệ thức tỉnh | 350 | 1150 | 6 | 312 | 47 | 12 |
| Q7 Bạch Hổ xuất thế | 500 | 1650 | 7 | 334 | 50 | 13 |
| Q8 Xuất môn lịch luyện | 600 | 2250 | 8 | 358 | 53 | 15 |

Bảng cấp nằm trong `GAME_DATA.levels` (`js/game_data.js`), cấp 1 trùng khớp chỉ số gốc đã phát hành (220/32/6). Chỉ số là hàm thuần của tổng EXP nên tự bền theo save; lên cấp thì HP hiện tại tăng đúng bằng phần HP tối đa tăng thêm (không hồi đầy lén).

**Nơi đặt dữ liệu — bài học đắt giá:** phần thưởng được khai trong `tools/build_quests.py` (bộ sinh `data/Map_Quests.json`), KHÔNG sửa tay tệp JSON. Lượt chạy đầu tiên của đợt cho EXP bằng 0 dù tệp JSON đã sửa đúng — vì bước kiểm cổng chạy lại bộ sinh và ghi đè mất phần thưởng. Đã chuyển vào bộ sinh; sinh lại vẫn đủ 8 mục, cổng walkthrough vẫn PASS.

**Hai sửa chữa phụ trong đường ống (khai rõ):**
- Q8 kết thúc thẳng từ trạng thái "active" (không qua "ready_to_turn_in") nên hook thưởng không bao giờ chạy cho Q8 — lượt chạy trọn chuỗi đầu tiên trả Q8 xong vẫn 1650 EXP. Đã gắn đúng hook `applyQuestRewards` vào callback kết thúc Q8 (kèm dòng thưởng trên banner). Kiểm chứng riêng bằng save cấy ở Q8: sau kết thúc 2250 EXP, cấp 8, 358/53/15.
- Hook thưởng có từ đợt finisher; đợt này nối thêm tính cấp/chỉ số và dòng "Lên cấp N" vào banner.

Phần thưởng chỉ áp đúng một lần mỗi lần trả nhiệm vụ (đường `advanceQuest` chạy một lần khi chuyển trạng thái; trả lại không lặp vì trạng thái đã chuyển).

## Đối chiếu với bức tường 340 HP (tinh anh Thạch Vệ)

- Nhân vật mới tinh (số đo đợt trước): gây 63–128 sát thương mỗi mạng, tinh anh hồi đầy 7/7 lần → tường cứng.
- Sau hiệu chỉnh: vào Q6 ở cấp 5 (292 HP, công 44 — mỗi đòn ~33 vào tinh anh), cộng máu tinh anh giữ nguyên qua các mạng.
- Lượt kiểm chứng: người chơi mài tinh anh 340 → 42 qua các mạng (mỗi lần chết, log "HP PERSISTENCE [thachve_elite]: hp at death 42 -> after respawn 42 (max 340) PASS"), chết thêm một lần ở mốc 42, rồi kết liễu ở mạng kế tiếp với 210/292 HP còn lại. Không phải thắng áp đảo một mạng, cũng không còn là tường.

## Kiểm chứng trọn chuỗi Q1→Q8 (một lượt không gián đoạn)

Driver `tools/finisher-playtest.mjs` chơi thật bằng chạm tổng hợp; kết quả đọc từ log, không đọc từ mã thoát.

- Q1→Q5: phần thưởng rơi đúng từng lần trả — dòng STATS sau mỗi nhiệm vụ khớp bảng trên tuyệt đối (60/L1 → 150/L2 → 350/L3 → 550/L4 → 800/L5).
- Q6: tinh anh chết như mục trên; trả nhiệm vụ → 1150 EXP, cấp 6.
- Cổng sang Hậu Sơn: qua được (xem mục sự cố driver bên dưới).
- Q7 boss Bạch Hổ (1200 HP): vào trận ở cấp 6, 230/312 HP.
  - **Chết có chủ đích** ở 1168 HP phase 1: `BOSS HP PERSISTENCE: hp at death 1168 -> after respawn 1168, phase now 1 PASS`.
  - Phase 2 đạt ở 789 HP; chết ở 580/phase 2 → PASS giữ nguyên.
  - Phase 3 đạt ở 373 HP; chết ở 335/phase 3 → PASS giữ nguyên phase.
  - Giai đoạn cuối ở 170 HP phase 3 rất khắc nghiệt với driver (chiêu lao 75): 14 mạng chết tại mốc 170, mỗi lần đều PASS không hồi máu; kết liễu ở mạng thứ 18. **Boss chết sau 253 giây giao tranh, tổng 17 lần chết.** Ảnh: `q7_boss_phase1/2/3.png`, `q7_boss_death.png`, thanh máu boss trên HUD: `hud_hauson_boss.png`.
- Q8: hoàn thành, ảnh `q8_ending.png`. Chỉ số cuối lượt chạy: 1650 EXP, cấp 7 (91/334 HP, công 50, thủ 13) — con số này là TRƯỚC bản sửa Q8 ở trên; với bản sửa, đoạn cuối Q8 kiểm chứng riêng cho 2250 EXP, cấp 8 (115/358, công 53, thủ 15).
- Tải lại trang sau khi xong: chỉ số + HUD giữ nguyên ("Cấp 8 · 115/358 HP · EXP: 2250" — ảnh `q8_fix_probe.png`).
- Ngoại lệ JS trong lượt chạy: 1 lỗi thoáng qua khi nhảy map ("Cannot destructure property 'origin' of 'S.nav' as it is null") — mã cũ, không thuộc đợt này, không làm hỏng lượt chạy.

## Quan sát phụ theo yêu cầu: Q3 đếm lố khi đánh cụm

Cả ba lượt chạy của đợt này đều đếm đúng +1 mỗi mạng trong các trận 1-đối-1 (tiến trình 1→2→3→4→5, đúng 5 xác Trúc Yêu). Hiện tượng đếm lố khi quái chết lan trong đánh cụm (ghi nhận đợt trước) KHÔNG tái hiện trong các lượt này — chưa bác bỏ được hẳn ở điều kiện đánh cụm dày, nhưng không thấy lại. Không sửa trong đợt này theo brief.

## Sự cố hạ tầng và driver (khai đầy đủ)

- **Lỗi cổng dịch chuyển là lỗi của DRIVER, không phải của game:** điểm neo cổng (1560,746) chiếu lên màn hình đúng vị trí thẻ HUD theo dõi nhiệm vụ khi đứng ở ô đứng của cổng — cú chạm của driver trúng thẻ HUD, không tới canvas, nhân vật đứng yên cách vòng kích hoạt (r=85) 186px. Đo trực tiếp: `elementFromPoint` tại điểm đó trả về `#questTracker`; gọi `walkToPx(1560,746)` thì nhảy map ngay. Đã sửa `tapPortal`: chạm trực tiếp trước, không được thì tiếp cận từ phía bên (đứng cạnh cổng rồi chạm neo — đường đi thẳng cắt qua vòng kích hoạt), cách một người chơi thật vẫn làm.
- **Sự cố lưu trữ của máy ảo** (cùng loại sự cố đã ghi nhận sáng 2026-11-09): hai lượt chạy chết vì EPERM khi ghi — một lần ở ảnh chụp `q6_elite.png` (đã gia cố `shot()` thử lại + không chí tử), một lần chết ngay lúc khởi động ở dòng truncate log (đã bọc try/catch). Lượt chạy hoàn chỉnh cuối cùng chạy qua được các cửa sổ lỗi ghi; bằng chứng còn đầy đủ trong log.
- Các lượt chạy dở được lưu: `playtest-q1-q8.pre-rewards-wall.log` (tường cũ), `playtest-q1-q8.aborted-norewards.log` (lượt lộ lỗi bộ sinh ghi đè), `playtest-q1-q8.run-crashed-portal.log` (lượt tới Q7 và chết ở cổng).

## Lo ngại cân bằng còn lại (nói thẳng)

1. **Boss phase 3 ở mốc 170 HP cuối là một bức tường mềm với lối chơi của driver:** 14 mạng chết không gây thêm sát thương trước khi kết liễu được. Với người chơi thật (né chủ động, canh chiêu), độ khó sẽ khác; nhưng nếu muốn boss bớt "đuối dần vì chết nhiều", chỗ cần nhìn là chiêu lao phase 3 (75 thô ≈ 63 thực nhận mỗi phát) chứ không phải đường cong phần thưởng — đội KHÔNG tự ý đổi theo đúng brief.
2. Đường cong hiện tại cho cảm giác vừa: Q6 cần nhiều mạng nhưng tiến triển rõ; các nhiệm vụ thường không bị áp đảo (người chơi kết thúc Q3 ở 32–96 HP trong các lượt chạy). Đội không thấy thừa mỡ phải cắt.
3. HP quái không bền qua tải lại trang (mục khai ở trên) — nếu Bui muốn cả trường hợp này, cần mở rộng định dạng save; đội chưa làm vì lời lệnh chỉ nói chết → hồi sinh.
