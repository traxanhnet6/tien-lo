# Tiên Lộ (thực chất Ngũ Hành Vô Địch) — Báo cáo đợt Antigravity agy1: Vertical Slice trên map iso3

Cây: `~/workspace/game-tien-lo-agy1/` (nhân bản THẬT từ `game-tien-lo-iso3/`). Giám sát + nghiệm
thu độc lập bởi đội Muse. **Chưa deploy.** Tên hiển thị trong game: **Tiên Lộ**; thực chất là
Ngũ Hành Vô Địch (Hà Nhân, Thanh Vân, căn tính ngũ hành) theo lệnh chốt hợp nhất 10:01
ngày 2026-11-09 — hệ ngũ hành đầy đủ là đợt tiếp nối riêng, không thuộc phiên này.

## 1. Diễn biến phiên Antigravity (khai thẳng)

- Lần chạy 1 (09:53): chết sau ~60 giây, log rỗng — trúng cửa sổ cạn hạn mức đĩa (EDQUOT) đang
  hoành hành trên máy lúc đó.
- Cập nhật brief giữa chừng theo lệnh người dùng: bổ sung Hồ Sơ Hà Nhân 1.0 + luồng nhân vật
  (mục 3.5), đính chính vũ khí bộ chiến đấu = **KIẾM tua đỏ** theo ảnh mẫu gốc
  `docs/standards/ha-nhan-mau-goc-bo-chien-dau-8-huong.jpg` (hồ sơ §2 ghi "trường thương" —
  ảnh gốc là nguồn đối chiếu cao nhất theo chính §7 của hồ sơ nên ảnh thắng chữ), và khối định
  danh "Tên là Tiên Lộ, thực chất là Ngũ Hành Vô Địch". Cả ba cập nhật đều đã vào brief trước
  khi chạy lại.
- Lần chạy 2 (09:57, lần khởi động lại duy nhất theo kỷ luật phiên): làm việc thật ~14 phút
  rồi **tự kết thúc lượt** ở trạng thái "đang chờ tiến trình sinh sheet boss hoàn thành" —
  không phải lỗi hạn mức của agy, mà là phiên print dừng giữa chừng. Hai sản phẩm bắt buộc
  `docs/agy-checks.log` và `docs/agy-done.md` **không được tạo**. Theo kỷ luật phiên, đội giám
  sát không chạy lại lần nữa; mọi kết quả dưới đây là nghiệm thu trên trạng thái cây hiện có.

## 2. Nền trước khi giao (baseline, đã kiểm chứng)

- `tools/audit.py island`: PASS (1 warning cũ đã biết từ iso3: npc_tiendong/lantern).
  `tools/audit.py hauson`: PASS. `tools/build_quests.py`: WALKTHROUGH PASS, clearance cổng
  135px/126px. Sau khi agy làm xong, đội giám sát chạy LẠI cả ba cổng trên dữ liệu của cây
  agy1: **vẫn PASS nguyên trạng**; `data/Map_Quests.json` giống hệt bản iso3 từng byte.
- Đối chiếu cây agy1 với iso3: agy chỉ thêm/sửa đúng phần gameplay — `js/game_data.js` (mới),
  `js/gameplay.js` (mới), `js/main.js` (+3 dòng móc nối), `index.html`, `css/style.css`,
  6 tệp tài sản quái/boss mới, 2 công cụ `tools/build_monster_assets.py`,
  `tools/build_boss_sheet.py`. **Không một tệp dữ liệu map/neo/va chạm nào bị đụng** — giới
  hạn cứng về hình học map được tôn trọng.

## 3. Antigravity đã xây gì (theo tệp)

- `js/game_data.js` (331 dòng): hồ sơ số liệu người chơi/quái/boss (đều ghi nhãn ĐỀ XUẤT trong
  chú thích), lời thoại nháp cho đủ 8 nhiệm vụ theo đúng vai NPC, dữ liệu đài/cổng.
- `js/gameplay.js` (1.815 dòng): máy trạng thái nhiệm vụ Q1→Q8 lấy neo từ Map_Quests.json;
  chỉ dẫn mục tiêu (nhãn dạng "Trúc Yêu (2/5)", "Linh Thảo (4/5)", chỉ về cổng khi khác map);
  chiến đấu người chơi (HP, hồi đòn, số sát thương); AI quái (tuần tra/phát hiện/đuổi/telegraph/
  đánh/trở về vùng nhà; Linh Lang gọi bầy; Thạch Vệ tinh anh có kỹ năng diện rộng); boss 3 phase
  (gầm chấn động vòng đỏ + lao bổ có vùng cảnh báo hướng); kênh hái thảo 1,2 giây; hộp thoại +
  HUD cổ phong (ngọc/đồng); lưu localStorage + nút chơi lại.
- Tài sản: JSON ánh xạ hoạt ảnh cho sheet Trúc Yêu/Thạch Vệ sẵn có; sheet Linh Lang đầy đủ mới
  (8 frame); sheet boss 33 frame + JSON (idle/move/telegraph/attack cho cả 3 đòn, hit,
  chuyển phase, death).

## 4. Nghiệm thu độc lập — cách kiểm

Đội giám sát phục vụ cây bằng máy chủ riêng và lái Chrome headless ở 390×844, chơi qua chính
các hàm tương tác của game (cùng hàm mà nút bấm/sự kiện chạm gọi tới), có ghi trạng thái nhiệm
vụ sau từng bước và chụp ảnh các mốc. **Lưu ý phương pháp quan trọng**: để các hệ thống thời
gian chạy, bộ lái kiểm thử phải tự gọi `Gameplay.update(dt)` theo nhịp — vì lý do ở mục 5.1.
Mọi kết quả "đạt" ở mục 4 đều là khi update được bơm; trạng thái nguyên bản của cây thì xem
mục 5.1.

### Đã kiểm chứng ĐẠT (có log/ảnh)

- Q1→Q4 chạy trọn: nhận/trả đúng người giao, mục tiêu cập nhật kèm đếm tiến độ, banner nhận/
  hoàn thành hiện đúng, dẫn đường trỏ đúng mục tiêu (khác map thì chỉ về cổng — đã thấy ở Q7:
  "Cổng vào Hậu Sơn (Tới mục tiêu)").
- Chiến đấu hai chiều thật: Trúc Yêu 85 HP, ~29 sát thương/đòn, chết sau 3 đòn, đếm 1/5→5/5;
  quái đuổi theo, lên đòn có thời gian báo trước, đánh trúng người chơi (HP 220→188→32 trong
  các trận quanh Trúc Linh Lâm), người chơi chết → hồi sinh giữ nguyên tiến độ đã đếm.
- Hái thảo: kênh 1,2 giây hoàn thành từng nút, 5/5, trạng thái chuyển "chờ trả nhiệm vụ".
- Q5 bước 1 (gặp Thủ Vệ) đạt: tiến độ 0→1, mục tiêu chuyển "Miệng Vân Ẩn Động", hộp thoại hang
  mở đúng khi tới gần.
- Boss (kiểm bằng save đưa tới Q7 — đoạn đường bị chặn ở Q5, xem 5.2): vào arena là kích trận;
  phase 1→2 chuyển đúng ngưỡng 66% (792/1200 HP) kèm banner "BẠCH HỔ NỔI GIẬN" và thanh boss
  đổi nhãn "Giai Đoạn 2: Gầm Chấn Động"; gầm chấn động đánh văng người chơi ~200px và gây sát
  thương nặng (chết nếu đứng yên hứng trọn); người chơi chết → boss về đầy HP + phase 1
  (reset công bằng, đúng brief); vòng lặp này lặp lại ổn định nhiều chu kỳ, không lỗi bơm,
  không ngoại lệ trang trong phiên boss.

### Chưa kiểm chứng được tận nơi

- **Q5 bước 2 → Q6 → hết Q8 trong một mạch chơi liền**: bị chặn bởi lỗi 5.2. Đánh Thạch Vệ
  tinh anh, phase 3 của boss (lao bổ), sự kiện boss chết và đoạn kết Q8 mới kiểm ở mức đọc mã
  (logic có đủ: ngưỡng phase 3 ở 33%, vùng cảnh báo đường thẳng khi lao, onBossKilled nối vào
  hoàn thành nhiệm vụ). Đội giám sát đã thử tới boss bằng hai chiến thuật lái tự động (đứng
  đánh và đánh-rút lui): cả hai đều chết lặp lại ở phase 2 và boss reset sau mỗi lần chết,
  nên phase 3 và đoạn kết **chưa quan sát trực tiếp được** — không tuyên bố đạt.
- Phần thưởng nhiệm vụ: banner ghi "Nhận thưởng kinh nghiệm & đan dược" nhưng **không có
  XP/vật phẩm nào thực sự được cộng** — chưa có bề mặt kinh nghiệm/túi đồ trong slice để đối
  chiếu; phần thưởng hiện chỉ là dòng chữ.

## 5. Lỗi và thiếu sót (xếp theo mức nặng)

### 5.1 CHẶN ĐỨNG: vòng lặp gameplay không được nối vào engine
`js/main.js` chỉ tham chiếu Gameplay đúng 3 lần (init ở dòng 99, drawActor dòng 299,
renderGroundVFX dòng 367). Các hàm `update(dt)`, `handlePointerClick`, `renderWorldVFX`,
`renderScreenUI` được module xuất ra nhưng **không nơi nào gọi**. Hệ quả trên bản nguyên trạng:
quái và boss đứng yên vĩnh viễn, đòn đánh của người chơi kẹt sau cú vung đầu tiên (cờ
isAttacking chỉ được gỡ trong update), hái thảo không bao giờ hoàn thành, tự mở thoại khi đi
tới nơi không xảy ra — **người chơi thật không thể chơi trọn slice**. Đây là thiếu sót tích
hợp, không phải thiếu logic: toàn bộ logic đã có và chạy đúng khi update được gọi. Việc sửa
thuộc loại nhỏ (gọi update trong step của engine + nối sự kiện chạm), nhưng CHƯA được làm.

### 5.2 CHẶN ĐỨNG: thoại miệng hang Q5 tự mở lại mỗi tick — nguy cơ khóa mềm
Trong `update()` (gameplay.js ~dòng 1414), khi nhiệm vụ Q5 đang active, tiến độ = 1 và người
chơi đứng trong 80px quanh điểm (655,600), game gọi `openDialogue(...)` **mỗi tick mà không
có cờ "đã hiện"**; mà `openDialogue` đặt lại `lineIdx = 0` mỗi lần gọi. Đứng trong vùng đó
thì hội thoại bị đặt lại liên tục, không thể đọc tới dòng cuối để hoàn thành bước. Đã quan sát
thực tế: ba phiên nói chuyện × 16 lần bấm tiếp tục vẫn không qua được bước này. Người chơi
may ra thoát bằng cách chạm đi ra khỏi vùng giữa chừng rồi quay lại bấm — hành vi không thể
coi là đạt chuẩn nhiệm vụ.

### 5.3 Hình boss: 33 frame là biến dạng thủ tục từ MỘT tranh gốc
Cắt frame đối chiếu (idle / attack_swipe / attack_roar / attack_dash / death từ
`boss_bachho_sheet_v1.png`): cùng một tư thế hổ gốc trong mọi frame — đòn vung chỉ thêm vài
vệt trắng, gầm là vòng đỏ bị cắt ở mép frame, lao bổ là **kéo giãn/nén cả thân hình** (đầu hổ
méo rõ), frame death gần như trùng frame idle (không có tư thế ngã chết). Cấu trúc JSON đúng
chuẩn (đủ trạng thái, 33 frame), nhưng chất lượng hoạt ảnh **không đạt** yêu cầu tư thế phân
biệt của brief §3.4 và bộ hoạt ảnh tối thiểu của chuẩn boss §29.2.

### 5.4 HUD chồng lấp ở 390×844 (đã chụp được)
(a) chip "Chơi lại" đè lên chip "Theo" ở góc trên phải; (b) hàng chip khu vực bị nút ĐÁNH tròn
che mất một phần (chip "Trúc Linh…" bị cắt); (c) thanh HP boss đè lên chip tiêu đề khu
"TIÊN LỘ / Hậu Sơn". Cả ba đều thấy ở cỡ điện thoại thật trong các ảnh nghiệm thu.

### 5.5 Các điểm yếu phụ
- Căn tầm/áp sát của boss chưa chuẩn: đứng yên ở tầm đánh xa nhất của người chơi (~102px),
  boss phase 1 không áp sát thêm và đòn vung không chạm tới — vô hại suốt ~18 giây quan sát;
  nhưng khi người chơi ra vào liên tục, boss gây sát thương được trong các cửa sổ tiếp xúc,
  và từ phase 2 boss đuổi + gầm tới cả điểm lùi xa 250px. Bộ lái kiểm thử của đội giám sát
  (đánh-trả đũa và đánh-rút lui) chết tổng cộng 7 lần quanh ngưỡng phase 1/2, boss reset sau
  mỗi lần — độ khó là thật, nhưng hành vi phase 1 ở rìa tầm đánh cần căn lại.
- Một ngoại lệ vẽ xuất hiện 1 lần trong phiên dài: `createRadialGradient` nhận giá trị
  không hữu hạn tại `shadowEllipse` (main.js:252) — trong engine chạy bằng rAF, một ngoại lệ
  trong khung hình có thể làm đứng vòng lặp; không tái hiện ở hai phiên sau, nhưng cần chặn
  NaN ở hàm này.
- Linh Lang: frame telegraph và attack dùng chung frame 4 (theo chính JSON của nó); viền
  alpha còn fringe tím/hồng khá rõ; idle chỉ 1 frame. Thạch Vệ: hoạt ảnh "move" dùng lại các
  frame idle [2,0,1], tư thế các frame khác nhau nhẹ; ô 96px bị phóng lên 130–178px khi hiển
  thị nên hơi mềm. Trúc Yêu là bộ tốt nhất: idle/attack/hit/death là tư thế vẽ phân biệt thật.
- Nợ chữ do đính chính vũ khí giữa phiên: chú thích mã và dữ liệu còn nói "spear/Thương pháp"
  (một câu thoại Trưởng Lão Võ: "Thương pháp quả nhiên dứt khoát…") — vũ khí đúng theo ảnh
  mẫu gốc là KIẾM tua đỏ; không có hình thương nào được sản xuất nên đây là nợ chữ, sửa rẻ.
  Thêm một lỗi chính tả trên banner tiến độ: "Đã trám Trúc Yêu" (phải là "Đã hạ/Đã trảm").
- Nút tấn công dùng ký tự ⚔ trong nhãn — chấp nhận được như ký hiệu nút, nhưng không phải
  icon vẽ theo Art Bible; ghi nhận để đợt UI sau xử lý.

## 6. Luồng nhân vật Hà Nhân (hồ sơ 1.0, mục 3.5 của brief) — CHƯA BẮT ĐẦU

Antigravity kết thúc phiên trước khi chạm tới luồng này: **không có mẫu gốc 8 hướng, không
Idle/Walk frame nào được sản xuất**, `assets/char` và `assets/char_gen` giữ nguyên như iso3.
Chiếu checklist §6 của hồ sơ, từng dòng:

| Dòng checklist §6 | Kết quả |
|---|---|
| Đúng mặt meme, tai đen, mũ vàng nâu | Chưa làm — chưa có sản phẩm để chấm |
| Đúng bộ trang phục, không trộn hai bộ | Chưa làm |
| Đủ 8 hướng thật, đặc biệt góc chéo | Chưa làm |
| Không biến dạng kiếm, tua đỏ, giáp, áo choàng | Chưa làm |
| Chân/pivot không rung, không trượt bước | Chưa làm |
| PNG RGBA, frame đồng kích thước, JSON đúng | Chưa làm |
| Kiểm thử trên map isometric 2:1 | Chưa làm |

Nhân vật trong game hiện vẫn là bộ tạm cũ (đông = dải sinh hình, tây = lật gương, 6 hướng
sheet cũ) — KHÔNG khớp bộ chiến đấu của hồ sơ (không giáp vảy, không choàng đỏ họa tiết mây,
không kiếm tua đỏ). Không giai đoạn nào được ghép thêm, đúng kỷ luật "chỉ ghép khi qua §6".

## 7. Chấm phong cách (đối chiếu cỡ điện thoại thật)

- Quái trong cảnh: Trúc Yêu hòa vào Trúc Linh Lâm tự nhiên như một phần của tranh; Thạch Vệ
  khớp nền hang đá; Linh Lang vẫn hơi "dán" như iso3 từng ghi, cộng fringe tím ở viền.
- Boss trong arena: chính là tranh gốc của Hậu Sơn nên khớp tuyệt đối về lối vẽ/ánh sáng.
- Lớp UI mới (hộp thoại, thẻ nhiệm vụ, banner, thanh boss): một họ cổ phong tối + vàng đồng
  nhất quán, không trộn pixel art/hiệu ứng 3D/emoji giữ chỗ. Trừ các lỗi chồng lấp ở 5.4,
  trình bày đạt hướng UI của tài liệu tổng hợp.
- Không phát hiện tài nguyên mới nào phá vỡ luật "nền chỉ có mặt đất, vật rắn tách riêng" —
  agy không thêm vật thể rắn mới vào map.

## 8. Kết luận và việc tiếp nối

Đợt này cho ra **một bộ khung gameplay gần như đầy đủ nhưng chưa nối điện**: máy nhiệm vụ,
chiến đấu, AI quái, boss 3 phase, hái thảo, lưu tiến độ đều đã có mã và đã được nghiệm thu
chạy đúng khi vòng lặp được gọi; nhưng bản nguyên trạng chưa chơi trọn được vì thiếu đúng
phần nối vòng lặp (5.1) và lỗi khóa mềm Q5 (5.2). Thứ tự việc tiếp nối đề xuất:

1. Nối `Gameplay.update(dt)` + sự kiện chạm vào engine (việc nhỏ, mở khóa toàn bộ slice),
   kèm cờ chống mở-lại cho thoại miệng hang Q5 và chặn NaN ở shadowEllipse.
2. Chơi thử trọn mạch Q1→Q8 trên bản đã nối, gồm tinh anh, phase 3 và đoạn kết Q8.
3. Làm lại hoạt ảnh boss bằng tư thế vẽ phân biệt thật (bỏ đường biến dạng thủ tục).
4. Luồng nhân vật Hà Nhân theo hồ sơ 1.0 (khóa mẫu gốc 8 hướng bộ chiến đấu — KIẾM tua đỏ —
   rồi Idle 32 → Walk 64), từng giai đoạn qua checklist §6 mới ghép.
5. Đợt tiếp nối đã đặt tên theo định danh hợp nhất: **chuyển hệ tu luyện NGŨ HÀNH (năm đường
   tương sinh) của Ngũ Hành Vô Địch vào bản Tiên Lộ này** — đây là căn tính hệ thống cốt lõi,
   làm sau khi Vertical Slice chơi trọn được.
6. Dọn HUD chồng lấp ở cỡ điện thoại và các nợ chữ (thương→kiếm, "Đã trám").

Bằng chứng đã lưu kèm cây tại `proof/agy1-verify/`: log chơi trọn mạch Q1→Q5
(`playtest-full-chain.log`), log hai phiên boss (`probe-boss-q7.log`,
`probe-boss-hitandrun.log`), ảnh dẫn đường Q1, trận Trúc Yêu, hái thảo 5/5, thoại miệng
hang Q5, arena boss và banner phase 2, cùng dải frame cắt từ sheet boss
(`boss-sheet-frames-0-10-15-20-29.jpg`) làm căn cứ cho mục 5.3.
