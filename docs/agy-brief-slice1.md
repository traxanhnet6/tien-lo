# AGY BRIEF — Tiên Lộ: Vertical Slice gameplay trên map Thanh Vân iso3

Bạn là đội xây chính cho đợt này. Làm việc CHỈ trong cây này
(`~/workspace/game-tien-lo-agy1/`). Đọc brief này trọn vẹn trước khi sửa bất kỳ tệp nào.

> **ĐỊNH DANH DỰ ÁN (người dùng chốt 10:01 ngày 2026-11-09): "Tên là Tiên Lộ, thực chất nó là
> Ngũ Hành Vô Địch."** Bản build này là MỘT game duy nhất: tên hiển thị trong game là
> **Tiên Lộ**, còn thực chất là Ngũ Hành Vô Địch — nhân vật chính Hà Nhân, thế giới tông môn
> Thanh Vân, và căn tính hệ thống cốt lõi là tu luyện NGŨ HÀNH (năm đường Kim/Mộc/Thủy/Hỏa/
> Thổ, vòng tương sinh). Mọi tên gọi/chỉ số/phần thưởng bạn chạm tới phải bám căn tính ngũ
> hành đó, KHÔNG phát minh một hệ song song khác. Phạm vi phiên KHÔNG mở rộng: đợt này vẫn
> chỉ là Vertical Slice dưới đây; hệ tu luyện ngũ hành đầy đủ là đợt tiếp nối riêng, không
> nhồi vào phiên này.

## 1. Tài liệu chuẩn bắt buộc áp dụng (đọc trước khi làm)

Trong `docs/standards/`:

1. `Tien-Lo-Art-Bible-1.0.pdf` — Art Bible: MỘT phong cách 2D HD fantasy tu tiên cho toàn bộ
   tài nguyên; TUYỆT ĐỐI không trộn pixel art / 3D render / anime phẳng / sơn dầu / bán hiện
   thực trong cùng khu vực; một góc nhìn + một hướng sáng; tỉ lệ và silhouette nhất quán giữa
   các frame (không phình/teo, không nhảy pivot); tên file theo cấu trúc
   `nhóm_tên_hướng_hành_động_phiên_bản`; quy trình 6 bước, bước cuối là phê duyệt —
   **không đạt Art Bible = không đưa vào bản build**.
2. `Quy-chuan-Tien-Lo-Map-Quai-Boss.pdf` — chuẩn Map/Quái/Boss, đặc biệt §28–29:
   quái phải phân biệt được khi chỉ nhìn bóng đen; có màu chủ đạo + điểm nhấn theo hệ;
   **telegraph**: tư thế/vùng báo trước đòn, người chơi có thời gian phản ứng;
   **hitbox theo hành vi và frame tấn công**, không lấy toàn bộ hình làm vùng sát thương;
   quái chết / biến mất / rơi vật phẩm là các trạng thái tách rõ. Boss chủ lực: **2–3 phase**,
   mỗi phase đổi hành vi rõ; đòn mạnh báo trước bằng tư thế, **vùng cảnh báo trên đất**, âm thanh
   hoặc hiệu ứng; arena có không gian né, đường tiếp cận, điểm hồi sinh, lối thoát;
   bộ hoạt ảnh boss tối thiểu gồm idle, move, telegraph từng đòn chính, attack từng kỹ năng,
   hit/stagger, phase transition, death.
3. `Tien-Lo-Ha-Nhan-Ho-So-Thiet-Ke-Tong-Hop-1.0.pdf` — HỒ SƠ NHÂN VẬT HÀ NHÂN 1.0, chuẩn nhân vật
   riêng của Tiên Lộ (chi tiết tại mục 3.5 của brief này): khóa nhận diện (đầu trắng tròn + mặt
   meme cụ thể + hai tai đen + mũ vàng nâu — KHÔNG phải panda chibi chung chung); hai bộ trang
   phục TUYỆT ĐỐI không trộn (bộ chiến đấu: giáp vảy bạc đen, giáp vai, áo trắng họa tiết đỏ, áo
   trong đen, choàng đỏ họa tiết trắng, KIẾM dài tua đỏ; biến thể áo xanh: áo xanh lam,
   choàng đen, lông trắng hai vai, đai mặt ngọc); luật hoạt hình (chỉ đổi tư thế/góc, cùng một
   nhân vật, KHÔNG lật gương giả hướng — 8 hướng thật có chéo thật); quy trình §5 và checklist
   nghiệm thu §6 của hồ sơ là cổng bắt buộc cho mọi giai đoạn hình nhân vật.
4. `Tien-Lo-Tong-Hop-Toan-Du-An-1.0.pdf` — tài liệu tổng hợp dự án, mục §G (Thanh Vân Tiên Môn):
   8 khu, 7 NPC mẫu, quái Trúc Yêu (cận chiến, Trúc Linh Lâm), Linh Lang (nhanh, áp sát theo
   nhóm), Thạch Vệ (tinh anh phòng thủ, Vân Ẩn Động), boss **Bạch Hổ Sơn Quân — ba phase:
   đánh thường → gầm chấn động → lao bổ diện rộng**, và chuỗi 8 nhiệm vụ tân thủ §G.4.
   LƯU Ý luật của chính tài liệu: mọi mục ghi "đề xuất/minh họa" CHƯA phải thông số khóa.
   UI theo hướng: cổ phong ngọc/đồng cổ/gỗ, tối đa hai họ font, trạng thái nút không chỉ bằng màu.

Thêm luật của người dùng, cứng như chuẩn trên:

- Đồ họa isometric 2:1 + 2D HD cho mọi map. **Hậu Sơn là MAP RIÊNG** (đã có sẵn trong cây).
- Mọi vật thể phải khớp nền của nó: cùng phong cách, cùng họ màu, **cùng hướng sáng**, cùng
  phối cảnh; chân đế bám đất đúng vị trí với bóng tiếp xúc theo hướng sáng của cảnh; va chạm
  của vật thể = đúng chân đế nhìn thấy. Tranh nền chỉ chứa mặt đất; vật rắn là vật thể riêng.
- Chỉ dẫn nhiệm vụ phải trỏ tới **mục tiêu thật**: mũi tên + dấu "!" tại đúng neo của bước
  hiện tại, đúng map, qua đúng cổng.

## 2. Trạng thái hiện tại của cây (đã kiểm chứng bởi đội giám sát — coi là sự thật nền)

- Hai map chơi được: `island` (7 khu, nền là 8 tranh vẽ ghép 4400×2640) và `hauson`
  (đấu trường boss, tranh riêng 2240×1120), nối bằng cổng dịch chuyển hai chiều có kỷ luật
  chống dội cổng (ân hạn 1,2 giây + arm-on-exit + điểm tới cách cổng về 126–135px). KHÔNG phá.
- Engine `js/main.js` (~585 dòng): lưới đẳng cự 2:1 phủ trên tranh; va chạm/điều hướng/vật thể
  là dữ liệu riêng (`data/<map>/Map_Collision.json`, `Map_Navigation.json`, `Map_Objects.json`);
  A* 8 hướng cấm cắt góc, đổi tầng chỉ qua ô cầu thang; chạm-để-đi; zoom bậc lưu bền; actor được
  vẽ trong cùng lượt sắp xếp chiều sâu với vật thể; engine ĐÃ hỗ trợ actor dạng sprite sheet
  (`actor.sheet` gồm cellW/cellH/frames/fps/pingpong) và nhãn tên trên đầu actor.
- CHƯA có: trạng thái nhiệm vụ chạy thật, hội thoại NPC, chiến đấu, AI quái, thu thập, boss.
  Hiện NPC/quái/boss chỉ là actor đứng yên (có bob nhẹ khi idle).
- Chuỗi nhiệm vụ đã có dưới dạng DỮ LIỆU neo trong `data/Map_Quests.json` (8 nhiệm vụ, tên và
  mục tiêu nguyên văn §G.4, 21 neo gồm giver/target/stand_tile/anchor_px cho từng mục tiêu).
  `tools/build_quests.py` sinh tệp này và kiểm vòng đi trọn chuỗi: **WALKTHROUGH: PASS**
  (16 chặng, gồm 2 lần nhảy map). Kiểm toán `tools/audit.py island` và `tools/audit.py hauson`:
  **PASS** cả hai (island có 1 warning cũ đã biết: `npc_tiendong: cell 52,47 blocked_by=lantern_sm_r`).
  Cả hai cổng này PHẢI còn PASS sau khi bạn làm xong.
- Actor hiện có (id trong Map_Objects): NPC — npc_tiendong, npc_chapsu, npc_dansu, npc_thoren,
  npc_thuongnhan, npc_chuongmon, npc_truonglao, npc_kiemsi, npc_thuve; quái — mon_trucyeu_1..5
  (sheet `assets/monsters/monster_trucyeu_sheet_v1.png` 800×1100), mon_linhlang_1..2
  (`monster_linhlang_sheet_v1.png` 576×96), mon_thachve_1..2 + mon_thachve_elite
  (`monster_thachve_sheet_v1.png` 576×96); boss — boss_bachho
  (`assets/boss/boss_bachho_sonquan_v1.png` 1824×1278, một tranh đơn).
  NPC là ô đơn 96×120 trong `assets/npc/`.
- Nhân vật người chơi HIỆN TẠI (trạng thái tạm, sẽ được thay theo mục 3.5): hướng đông = dải đi
  sinh hình (`assets/char_gen/walk_east.png`), hướng tây = bản lật gương của dải đó, 6 hướng còn
  lại dùng sheet cũ khác lối vẽ. Bộ tạm này KHÔNG đúng hồ sơ Hà Nhân 1.0 (không phải bộ giáp chiến đấu +
  choàng đỏ theo mẫu gốc, có lật gương giả hướng, 6 hướng khác lối vẽ) — nó chỉ là hình giữ chỗ cho tới khi từng
  giai đoạn của bộ mới qua được checklist §6 của hồ sơ.

## 3. Phạm vi đợt này — Vertical Slice: chuỗi nhiệm vụ chơi được thật

### 3.1 Máy trạng thái nhiệm vụ + tương tác NPC
- Nạp `data/Map_Quests.json` làm nguồn neo duy nhất. Cài máy trạng thái: chưa nhận → đang làm
  (đếm tiến độ) → trả nhiệm vụ → nhận nhiệm vụ kế, chạy trọn 8 nhiệm vụ theo đúng thứ tự §G.4.
  `Map_Quests.json` là tệp do công cụ sinh: KHÔNG sửa tay; dữ liệu chạy thêm (lời thoại, phần
  thưởng, số đếm) đặt ở tệp dữ liệu/code mới riêng của bạn.
- Tương tác: chạm NPC ở gần = mở thoại ngay; ở xa = nhân vật đi tới ô đứng (stand_tile của neo)
  rồi mở thoại đúng một lần. Thoại ngắn, đúng vai từng NPC theo §G.2 (Chấp Sự hướng dẫn nhập
  môn, Trưởng Lão Võ dạy kiếm, Đan Dược Sư giao việc linh thảo, Thủ Vệ gác hang, Chưởng Môn
  giao/trả hai nhiệm vụ cuối). Lời thoại bạn viết là BẢN NHÁP — ghi rõ trong agy-done.md.
- Chỉ dẫn: một mục tiêu hiện hành duy nhất; mũi tên dẫn đường + dấu "!" tại neo của mục tiêu
  (khác map thì chỉ về cổng đúng). Khung nhiệm vụ trên HUD luôn hiển thị tên + tiến độ
  (ví dụ "Trúc Yêu 2/5"); không bao giờ để người chơi không biết phải đi đâu.
- Q2 "Bước chân tu tiên": tương tác với Đài Truyền Tống (`dais_qt`) là hoàn thành.
  Q8 hoàn thành → hiển thị thông báo khu vực kế tiếp chưa mở (khóa tại đài), kết thúc chuỗi
  một cách sạch sẽ. Không xây khu vực mới.
- Lưu tiến độ bằng localStorage (nhiệm vụ hiện tại + tiến độ + chỉ số người chơi + số linh
  thảo), có nút/luồng chơi lại từ đầu trong phần cài đặt hoặc màn hình bắt đầu.
  Tiến độ nhiệm vụ của người chơi KHÔNG được tính là "server xác nhận" — đợt này client-only.

### 3.2 Chiến đấu của người chơi (đủ để chơi chuỗi một cách trung thực)
- Người chơi có HP, đòn đánh cơ bản (chạm quái ở gần để đánh / nút đánh trên HUD điện thoại),
  tầm đánh và nhịp hồi đòn rõ ràng; trúng đòn có phản hồi (nháy đỏ/số sát thương); chết →
  hồi sinh tại điểm spawn của map hiện tại (Hậu Sơn: thềm tới), giữ nguyên tiến độ đã đếm,
  quái/boss reset công bằng. KHÔNG có chế độ bất tử, nút thắng nhanh, hay đường tắt nào trong
  luồng chơi được giao.

### 3.3 Quái theo chuẩn §28 (AI + hoạt ảnh trạng thái thật)
- Cả ba loài thành actor sống tại đúng vị trí hiện có trong dữ liệu: Trúc Yêu (5 con, Trúc Linh
  Lâm), Linh Lang (2 con, Trúc Linh Lâm), Thạch Vệ (2 con thường + 1 tinh anh `mon_thachve_elite`,
  Vân Ẩn Động). KHÔNG di chuyển điểm spawn của chúng (đó là neo nhiệm vụ).
- Hành vi: tuần tra/chờ trong vùng nhà nhỏ → phát hiện người chơi trong tầm → đuổi theo bằng
  chính luật di chuyển của map (chỉ ô đi được, tôn trọng va chạm và cầu thang) → vào tầm thì
  đánh → mất dấu thì quay về vùng nhà và hồi phục. Linh Lang nhanh hơn và áp sát theo nhóm
  (hai con cùng kích động khi một con bị đánh hoặc khi người chơi vào vùng). Thạch Vệ chậm,
  trâu, đòn nặng; bản tinh anh to hơn, có thêm một kỹ năng có telegraph (xem dưới).
- Hoạt ảnh: mỗi loài có các trạng thái idle / move / attack / hit / death PHÂN BIỆT RÕ bằng tư
  thế — dùng các frame trong sheet hiện có nếu sheet có sẵn frame cho trạng thái đó; nếu thiếu,
  sản xuất thêm frame vẽ cùng phong cách/hướng sáng với sheet gốc (cấm trộn phong cách, cấm
  pixel art, cấm hình vẽ bằng mã). CHỈ rung/bob toàn thân hoặc pulse tỉ lệ thì KHÔNG tính là
  hoạt ảnh. Chết: ngã xuống → mờ dần/biến mất → sự kiện nhiệm vụ rơi ra là lớp riêng.
- Telegraph + hitbox theo chuẩn: mọi đòn của quái có khâu lên đòn (wind-up) nhìn thấy được đủ
  để người chơi né (tối thiểu ~0,45 giây với đòn thường, lâu hơn với đòn nặng của Thạch Vệ);
  sát thương chỉ áp trong cửa sổ frame tấn công và trong tầm/hướng thật của đòn — người chơi
  bước ra khỏi tầm trong lúc wind-up thì không trúng. Thanh HP trên đầu quái khi đang giao chiến.
- Số liệu: chọn bộ số khởi đầu bảo thủ để nhân vật mới thắng được Q3 (5 Trúc Yêu) một cách
  trung thực nhưng vẫn phải né đòn; ghi toàn bộ số đã chọn vào agy-done.md dưới nhãn ĐỀ XUẤT.

### 3.4 Boss Bạch Hổ Sơn Quân tại Hậu Sơn (chuẩn §29 + §G.3: ba phase)
- Boss là actor sống tại neo `boss_bachho`, giữa arena hiện có. Trận đấu bắt đầu khi người
  chơi vào arena (có khoảnh khắc xuất hiện/ngẩng đầu, không gây sát thương bất ngờ lúc mở màn).
- Ba phase theo ngưỡng HP, mỗi phase đổi hành vi RÕ và có tín hiệu chuyển phase (gầm + hiệu ứng):
  - Phase 1 (100–66%): đánh thường — vồ/cào đơn mục tiêu có wind-up telegraph.
  - Phase 2 (66–33%): thêm GẦM CHẤN ĐỘNG — vòng cảnh báo đỏ trên đất lan từ boss, đứng trong
    vòng khi vòng khép kín thì trúng đòn + bị đẩy lùi; vòng phải hiện đủ lâu để chạy ra (~1 giây).
  - Phase 3 (33–0%): thêm LAO BỔ DIỆN RỘNG — boss lùi lấy đà, một vùng cảnh báo hình
    quạt/đường thẳng hướng về phía người chơi hiện trên đất ~0,9 giây, rồi boss lao qua vùng
    đó; sát thương chỉ trong hành trình lao và vùng đã cảnh báo.
- Hoạt ảnh boss theo bộ tối thiểu của chuẩn: idle, move/turn, telegraph cho từng đòn chính,
  attack cho từng kỹ năng, hit/stagger, chuyển phase, death. Tranh boss hiện là MỘT ảnh đơn
  (1824×1278): bạn phải tạo các tư thế/frame phân biệt cho từng trạng thái bằng cách vẽ thêm
  hoặc tách lớp khớp nối từ chính tranh gốc, giữ nguyên nhận diện và lối vẽ — rung/bob toàn
  thân là KHÔNG đạt. Nếu một trạng thái nào không thể đạt mức phân biệt tư thế, ghi rõ vào
  agy-done.md trạng thái nào còn thiếu thay vì cho qua im lặng.
- Kết trận: boss chết → hoàn thành Q7 tại chỗ (sự kiện nhiệm vụ riêng), cổng về luôn mở suốt
  trận (lối thoát), chết trong trận → hồi sinh tại thềm tới Hậu Sơn, boss về đầy HP.

### 3.5 Nhân vật Hà Nhân theo Hồ Sơ 1.0 (luồng thứ hai — sau gameplay, đúng thứ tự §5 của hồ sơ)

> **ĐÍNH CHÍNH VŨ KHÍ (người dùng, 09:59 ngày 2026-11-09) — ĐỌC TRƯỚC KHI LÀM MỤC NÀY:**
> Chữ "trường thương" trong §2 của hồ sơ là SAI so với ảnh mẫu gốc. Ảnh mẫu gốc của bộ chiến
> đấu — bảng turnaround 8 hướng tại `docs/standards/ha-nhan-mau-goc-bo-chien-dau-8-huong.jpg`,
> chính là nguồn "đối chiếu ưu tiên cao nhất" theo §7 của hồ sơ — cho thấy vũ khí là **KIẾM
> dài có tua đỏ, cầm ở tay phải**. ẢNH GỐC THẮNG CHỮ: vũ khí của bộ chiến đấu là KIẾM tua đỏ
> (mọi chữ "thương" từng còn sót trong brief này đều đọc là thanh kiếm đó). Mẫu gốc 8 hướng
> của bạn phải khớp ảnh này TỪNG HƯỚNG: giáp vảy bạc đen, áo trắng họa tiết đỏ, choàng đỏ họa
> tiết MÂY TRẮNG, mũ vàng nâu đúng dáng, mặt meme, tai đen, kiếm + tua đỏ, và đúng tỉ lệ
> đầu-lớn/thân-nhỏ của ảnh.

Nguồn đối chiếu cao nhất: ảnh tham chiếu gốc ở §7 của hồ sơ (phần nhân vật trong ảnh; bỏ qua
phần giao diện ứng dụng nếu có). Các bảng concept tổng hợp ở §8 của hồ sơ CHỈ là tư liệu hình
ảnh — KHÔNG tích hợp thẳng; hình lệch mẫu gốc phải làm lại từ mẫu gốc.

Thứ tự sản xuất bắt buộc, làm tới đâu nghiệm thu tới đó:

1. **Khóa mẫu gốc 8 hướng** của BỘ CHIẾN ĐẤU (bộ dùng trong slice: giáp vảy bạc đen, giáp vai,
   áo trắng họa tiết đỏ, áo trong đen, choàng đỏ họa tiết trắng, KIẾM dài tua đỏ):
   8 hướng thật — đông, đông nam, nam, tây nam, tây, tây bắc, bắc, đông bắc — mỗi hướng đối
   chiếu riêng với ảnh gốc. Mẫu gốc là nguồn sản xuất, không phải tài nguyên chạy trong game.
2. **Idle 32 frame** (8 hướng × 4) từ mẫu gốc.
3. **Walk 64 frame** (8 hướng × 8) từ mẫu gốc.
4. Nếu thời gian còn: Run 64 → Attack 48 (đòn kiếm: chém/đâm theo quỹ đạo kiếm, tua đỏ đi
   theo chuôi kiếm) → Hit 4 → Death 6 → Skill/VFX. Đòn đánh của người chơi ở mục 3.2 dùng hình Attack
   của bộ này khi giai đoạn Attack đã qua cổng; trước đó dùng tư thế mẫu gốc + hiệu ứng.

Luật cứng cho luồng này:

- **KHÔNG lật gương giả hướng** — hướng tây và các chéo phải sản xuất thật; tay cầm kiếm và
  chi tiết bất đối xứng (giáp vai, tua kiếm, họa tiết choàng) nhất quán đúng giải phẫu.
- **KHÔNG trộn trang phục**: biến thể áo xanh là bộ riêng — đợt này KHÔNG sản xuất, và không
  chi tiết nào của nó (áo xanh, choàng đen, lông vai trắng, đai ngọc) được lọt vào bộ chiến đấu.
- Kiếm bạc tua đỏ ở mọi frame có vũ khí; kiếm/tua/giáp/choàng không biến dạng, không đứt
  đoạn, không đổi chiều dài bất thường giữa các frame kề nhau.
- Kỹ thuật: PNG RGBA; mọi frame cùng kích thước ô; pivot tại chân, đo và ghi số (lệch pivot
  giữa các frame cùng hướng ≤ 2px); atlas 2048×2048 hoặc 4096×4096 + JSON (tên frame, tọa độ,
  kích thước, pivot, thời lượng, tên animation); tên file theo cấu trúc của Art Bible.
  Sản xuất bằng vẽ/sinh hình bám mẫu gốc — cấm vẽ bằng mã, cấm hình giữ chỗ.
- **Cổng §6 của hồ sơ áp cho TỪNG giai đoạn**: đúng mặt meme/tai đen/mũ vàng nâu; đúng bộ không
  trộn; đủ 8 hướng thật gồm chéo; kiếm/tua/giáp/choàng không biến dạng; chân/pivot không
  rung, không trượt bước; PNG RGBA, frame đồng kích thước, JSON đúng; kiểm thử trên map iso
  2:1. Kết quả checklist từng giai đoạn ghi vào `docs/agy-checks.log`.
- **Tích hợp có điều kiện**: chỉ giai đoạn ĐẠT checklist mới ghép vào engine, theo đúng thứ tự
  pipeline. Giai đoạn chưa đạt/chưa làm: engine giữ cách vẽ hiện tại cho phần đó, và
  `agy-done.md` ghi rõ hướng/giai đoạn nào đã là bộ mới, phần nào còn bộ tạm — khai trung thực.
- Ưu tiên trong phiên: **gameplay (3.1–3.4) là sản phẩm chính, làm trước**; luồng nhân vật làm
  sau, làm tới đâu chắc tới đó. Không hy sinh gameplay để chạy số lượng frame.

## 4. Giới hạn cứng — vi phạm bất kỳ điều nào là đợt làm hỏng

1. KHÔNG thiết kế lại map: không sửa tranh nền, không sửa `Map_Collision.json`,
   `Map_Navigation.json`, vị trí/vùng chân đế trong `Map_Objects.json`, và không di chuyển
   bất kỳ neo nào trong `Map_Quests.json` (tệp này do công cụ sinh — không sửa tay).
   Bạn ĐƯỢC thêm trường dữ liệu chạy mới cho actor (HP, AI, sheet trạng thái) trong tệp dữ
   liệu/code mới của mình.
2. Nhân vật người chơi: theo mục 3.5 — thay bằng bộ Hà Nhân theo hồ sơ CHỈ ở các giai đoạn đã
   qua checklist §6; ngoài điều đó không tự ý thay hình nhân vật.
3. KHÔNG xây 8 châu còn lại, KHÔNG xây online/server/đăng nhập/lưu đám mây. Q8 kết thúc ở
   trạng thái "chưa mở" tại Đài Truyền Tống. Tên/thương hiệu hiển thị trong game (màn hình
   bắt đầu, tiêu đề) là **Tiên Lộ**; không xây hệ tu luyện ngũ hành đầy đủ trong phiên này —
   chỉ căn chỉnh tên gọi theo khối định danh ở đầu brief.
4. Hình thêm mới phải tuân Art Bible: vẽ 2D HD cùng lối vẽ/ánh sáng của cảnh — cấm pixel art,
   cấm chất liệu render 3D, cấm emoji/hình giữ chỗ, cấm vẽ bằng mã. Nền vẫn chỉ có mặt đất;
   vật rắn vẫn là vật thể riêng có va chạm đúng chân đế.
5. KHÔNG sửa các tệp trong `docs/standards/`. KHÔNG sửa `tools/audit.py` /
   `tools/build_quests.py` để làm cổng dễ qua hơn.
6. Mọi con số gameplay bạn chọn đều là ĐỀ XUẤT (tài liệu chưa khóa) — ghi vào agy-done.md,
   không tuyên bố là thông số chính thức.

## 5. Sản phẩm bàn giao bắt buộc

- Game chơi được tại `index.html` (cả hai map, qua cổng trong game hoặc `?map=hauson`).
- `docs/agy-checks.log`: đầu ra THẬT của các lần kiểm, gồm tối thiểu:
  (a) `python3 tools/audit.py island` và `python3 tools/audit.py hauson` — phải PASS;
  (b) `python3 tools/build_quests.py` — WALKTHROUGH: PASS;
  (c) một kịch bản chơi thử tự động bằng trình duyệt headless (theo mẫu `tools/shoot.mjs`)
  lái trọn chuỗi Q1→Q8 bằng chính luồng chơi thật (đi bộ, thoại, đánh quái, hái thảo, qua
  cổng, đánh boss) và in tiến độ từng nhiệm vụ — kèm ảnh chụp ở các mốc: nhận Q1, đánh Trúc
  Yêu, hái linh thảo, đánh Thạch Vệ tinh anh, boss hiện vòng cảnh báo phase 2, boss lao bổ
  phase 3, trả Q8. Kịch bản kiểm thử được phép gọi hàm của engine qua console như một bộ lái
  kiểm thử, nhưng KHÔNG được thêm nút/chế độ gian lận nào vào giao diện chơi;
  (d) checklist §6 của hồ sơ cho từng giai đoạn hình nhân vật đã làm (đạt/không đạt từng dòng,
  kèm số đo pivot/kích thước frame).
- `docs/agy-done.md`: kể file-từng-file đã tạo/sửa gì; bộ số gameplay đã chọn (nhãn ĐỀ XUẤT);
  lời thoại là bản nháp; giai đoạn nhân vật nào đã qua §6 và đã ghép, phần nào còn bộ tạm;
  và mọi điểm yếu còn lại bạn tự biết — khai thật, không giấu.
- Làm việc tới khi xong toàn bộ hoặc tới khi gặp lỗi không tự vượt qua được; nếu dừng giữa
  chừng, agy-done.md phải ghi rõ đã xong tới đâu và còn thiếu gì.
