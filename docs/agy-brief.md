# AGY BRIEF — Tiên Lộ: Mở rộng lát cắt — MAP MỚI + CHUỖI NHIỆM VỤ MỚI + QUÁI MỚI + BOSS 002

Bạn là đội xây chính cho đợt này. Làm việc CHỈ trong cây này
(`~/workspace/game-tien-lo-agy2/`). Đọc brief này trọn vẹn trước khi sửa bất kỳ tệp nào.
Brief của đợt lát cắt đầu tiên được lưu tại `docs/agy-brief-slice1.md` — đọc để nắm
luật gốc; khi brief cũ và brief này khác nhau, **brief này thắng** (trạng thái cây đã khác).

> **ĐỊNH DANH DỰ ÁN (người dùng chốt 10:01 ngày 2026-11-09): "Tên là Tiên Lộ, thực chất nó là
> Ngũ Hành Vô Địch."** Bản build này là MỘT game duy nhất: tên hiển thị trong game là
> **Tiên Lộ**, còn thực chất là Ngũ Hành Vô Địch — nhân vật chính Hà Nhân, thế giới tông môn
> Thanh Vân, và căn tính hệ thống cốt lõi là tu luyện NGŨ HÀNH (năm đường Kim/Mộc/Thủy/Hỏa/
> Thổ, vòng tương sinh). Mọi tên gọi/chỉ số/phần thưởng bạn chạm tới phải bám căn tính ngũ
> hành đó, KHÔNG phát minh một hệ song song khác.

## 1. Tài liệu chuẩn bắt buộc áp dụng (đọc trước khi làm)

Trong `docs/standards/`:

1. `Tien-Lo-Art-Bible-1.0.pdf` — Art Bible: MỘT phong cách 2D HD fantasy tu tiên cho toàn bộ
   tài nguyên; TUYỆT ĐỐI không trộn pixel art / 3D render / anime phẳng / sơn dầu / bán hiện
   thực trong cùng khu vực; một góc nhìn + một hướng sáng; tỉ lệ và silhouette nhất quán giữa
   các frame (không phình/teo, không nhảy pivot); tên file theo cấu trúc
   `nhóm_tên_hướng_hành_động_phiên_bản`; **không đạt Art Bible = không đưa vào bản build**.
2. `Quy-chuan-Tien-Lo-Map-Quai-Boss.pdf` — chuẩn Map/Quái/Boss, đặc biệt §28–29:
   quái phải phân biệt được khi chỉ nhìn bóng đen; có màu chủ đạo + điểm nhấn theo hệ;
   **telegraph**: tư thế/vùng báo trước đòn, người chơi có thời gian phản ứng;
   **hitbox theo hành vi và frame tấn công**, không lấy toàn bộ hình làm vùng sát thương;
   quái chết / biến mất / rơi vật phẩm là các trạng thái tách rõ. Boss chủ lực: **2–3 phase**,
   mỗi phase đổi hành vi rõ; đòn mạnh báo trước bằng tư thế, **vùng cảnh báo trên đất**, âm
   thanh hoặc hiệu ứng; arena có không gian né, đường tiếp cận, điểm hồi sinh, lối thoát;
   bộ hoạt ảnh boss tối thiểu gồm idle, move, telegraph từng đòn chính, attack từng kỹ năng,
   hit/stagger, phase transition, death.
3. `Tien-Lo-Boss-Production-Workflow-1.0.md` (+ bản PDF cùng tên) — **Quy trình sản xuất
   Boss 1.0 của người dùng, áp trọn cho Boss 002 của đợt này**: đường ống khóa từng bước,
   không nhân rộng lỗi hình sang hướng/hoạt ảnh khác: khóa concept → khóa turnaround 8 hướng
   (duyệt từng hướng) → Idle → Walk → Run → Combat → VFX/Hitbox → Atlas/JSON → tích hợp → QA.
   Chuẩn: iso 2:1, 2D HD; 8 hướng phối cảnh THẬT (cấm lật ngang giả hướng khi chi tiết bất
   đối xứng); PNG RGBA trong suốt thật; pivot ĐO theo điểm tiếp đất; VFX tách khỏi thân;
   hitbox/hurtbox và thời điểm sát thương cấu hình độc lập; 3 phase theo HP; telegraph
   tối thiểu 700ms là giá trị khởi điểm. Đặt tên khung:
   `boss_<slug>_002__{animation}__{direction}__{frame:03}.png`; thư mục bàn giao
   `Tien_Lo/Boss/Boss_002_<Tên>/` với cấu trúc 01–09 theo văn bản quy trình.
4. `Tien-Lo-Ha-Nhan-Ho-So-Thiet-Ke-Tong-Hop-1.0.pdf` — hồ sơ nhân vật Hà Nhân (đợt này
   KHÔNG sản xuất hình nhân vật; chỉ để không phá nhận diện khi vẽ NPC/quái cùng khung cảnh).
5. `Tien-Lo-Tong-Hop-Toan-Du-An-1.0.pdf` — tài liệu tổng hợp dự án, §G (Thanh Vân Tiên Môn):
   thế giới hiện có 7 khu trên đảo chính + Hậu Sơn. Mọi mục ghi "đề xuất/minh họa" trong tài
   liệu CHƯA phải thông số khóa.

Thêm luật của người dùng, cứng như chuẩn trên:

- Đồ họa isometric 2:1 + 2D HD cho mọi map. **Hậu Sơn là MAP RIÊNG** (đã có sẵn trong cây).
- Mọi vật thể phải khớp nền của nó: cùng phong cách, cùng họ màu, **cùng hướng sáng**, cùng
  phối cảnh; chân đế bám đất đúng vị trí với bóng tiếp xúc theo hướng sáng của cảnh; va chạm
  của vật thể = đúng chân đế nhìn thấy. Tranh nền chỉ chứa mặt đất; vật rắn là vật thể riêng.
- Chỉ dẫn nhiệm vụ phải trỏ tới **mục tiêu thật**: mũi tên + dấu "!" tại đúng neo của bước
  hiện tại, đúng map, qua đúng cổng.
- **LUẬT GHI NHÃN (người dùng nhấn lại 17:25 ngày 2026-11-09)**: mọi sprite chưa nghiệm thu
  phải đánh dấu rõ **CHƯA NGHIỆM THU**; concept sheet KHÔNG phải sprite hoàn chỉnh; trạng
  thái hình phải khai theo từng phần: concept / đang sản xuất / đã qua QA. Trình/bàn giao
  hình chưa nghiệm thu như tài nguyên hoàn chỉnh là lỗi nghiệm thu.

## 2. Trạng thái hiện tại của cây (đã kiểm chứng bởi đội giám sát — coi là sự thật nền)

- Hai map chơi được: `island` (7 khu, nền là 8 tranh vẽ ghép 4400×2640) và `hauson`
  (đấu trường boss Bạch Hổ, tranh riêng 2240×1120), nối bằng cổng dịch chuyển hai chiều có
  kỷ luật chống dội cổng (ân hạn 1,2 giây + arm-on-exit + điểm tới cách cổng về 126–135px).
  Dữ liệu mỗi map là bộ ba `data/<map>/Map_Collision.json`, `Map_Navigation.json`,
  `Map_Objects.json`; engine (`js/main.js`) là lưới đẳng cự 2:1 phủ trên tranh, A* 8 hướng
  cấm cắt góc; `?map=hauson` mở thẳng map boss. Cả hai cổng `python3 tools/audit.py island`
  và `python3 tools/audit.py hauson` đang PASS.
- **Chuỗi nhiệm vụ Q1–Q8 CHƠI ĐƯỢC TRỌN VẸN** (máy trạng thái, thoại NPC, chỉ dẫn mũi tên +
  dấu "!", lưu localStorage khóa `tl3_save_v1`, nút chơi lại): dữ liệu neo sinh từ
  `tools/build_quests.py` → `data/Map_Quests.json` (**KHÔNG sửa tay tệp JSON** — sửa ở bộ
  sinh; `python3 tools/build_quests.py` đang cho WALKTHROUGH: PASS). Lời thoại Q1–Q8 là bản
  nháp đã có.
- **Phần thưởng**: hook `applyQuestRewards` (trong `js/gameplay.js`) chạy khi trả nhiệm vụ;
  EXP thuần (game không có dữ liệu vật phẩm có tác dụng — KHÔNG bịa vật phẩm). Bảng cấp
  `GAME_DATA.levels` trong `js/game_data.js`: 8 cấp, xpNeed tới 2000; sau Q8 người chơi ở
  2250 EXP tích lũy = cấp 8 (358 HP / 53 công / 15 thủ). Chỉ số là hàm thuần của tổng EXP.
- **Luật giữ máu quái (lệnh người dùng 16:35)**: `respawnPlayer()` trong `js/gameplay.js` —
  khi người chơi chết và hồi sinh, quái thường/tinh anh giữ nguyên HP; boss giữ nguyên HP
  **và phase**; chỉ đặt lại trạng thái/vị trí. Quái đã chết vẫn chết. (Mép đã biết, không
  thuộc đợt này: tải lại toàn trang thì quái đầy máu lại vì save không lưu HP quái.)
- **Boss Bạch Hổ (Q7)**: ba phase theo HP (chuyển phase ở 789 và 373 trên 1200 HP trong lượt
  kiểm chứng), thanh máu boss trên HUD, chết → hoàn thành Q7. Q8 kết thúc chuỗi tại Đài
  Truyền Tống với thông báo khu vực kế tiếp đang phong ấn — **đó là điểm nối của đợt này**.
- **HUD chiến đấu giai đoạn 1 — ĐÃ CÀI, ĐANG TẠM DỪNG, TUYỆT ĐỐI KHÔNG PHÁ** (xem mục 2.1).
- Nhân vật người chơi: bộ sinh hình hiện hành (đợt này KHÔNG chạm vào hình nhân vật).

### 2.1 VÙNG ĐÓNG BĂNG — HUD chiến đấu (vi phạm = đợt làm hỏng)

Các phần sau đây đã cài xong và đang chờ đợt kiểm chứng riêng của đội Muse; bạn KHÔNG
được sửa, viết lại, "dọn dẹp" hay đổi hành vi của chúng:

- Trong `js/gameplay.js`: bảng `SKILLS` và toàn bộ máy trạng thái thi triển
  (`tryCast` và các hàm cast/aim/cooldown/năng lượng của nó), xử lý joystick, hàm đồng bộ
  cụm nút chiến đấu, hàm vẽ khung tung chiêu (`drawCastFrame`), mô hình MP/năng lượng.
  (Điểm mở đã biết trong `tryCast` — thứ tự cảnh báo hồi chiêu trước mana — KHÔNG thuộc
  đợt này, không được tự ý "sửa".)
- Khối DOM cụm nút chiến đấu trong `index.html` và các quy tắc CSS của HUD trong
  `css/style.css`.
- Toàn bộ `assets/skills/` (5 gói khung chiêu thật + JSON) và `assets/hud/` (9 icon).
- `tools/hud-harness.mjs`.
- Trong `js/game_data.js`: mọi hàng `levels` hiện có (gồm trường `maxMp`/`mpRegen`) và mọi
  hồ sơ quái hiện có trong `GAME_DATA.monsters` — chỉ được **NỐI THÊM** (xem mục 3.2/3.3).

Tích hợp nội dung mới CHỈ qua đường công khai sẵn có: dữ liệu nhiệm vụ ở
`tools/build_quests.py`, hook `applyQuestRewards`, hệ cổng dịch chuyển, hệ actor quái/boss,
bộ ba dữ liệu map. Nếu một tích hợp bắt buộc phải chạm vùng đóng băng, **DỪNG ở điểm đó,
ghi rõ vào `docs/agy-done.md` và làm tiếp phần khác** — không tự ý viết lại mã HUD.

## 3. Phạm vi đợt này

### 3.1 Map mới — khu vực sau cổng phong ấn

- Tạo **MỘT map đẳng cự mới** nối tiếp thế giới Thanh Vân: chính là khu vực mà đoạn kết Q8
  nói "đang phong ấn". Chọn cho map **MỘT hệ nguyên tố chủ đạo** chưa có khu vực riêng
  (các khu hiện có: Trúc Linh Lâm — Mộc, Vân Ẩn Động — Thổ/động, Linh Tuyền — Thủy,
  Bạch Hổ — Kim): Hỏa là lựa chọn trống rõ nhất; nếu chọn hệ khác phải ghi lý do vào
  agy-done.md. Tên map, tên khu và nhận diện hình ảnh phải thuộc thế giới Thanh Vân và bám
  căn tính ngũ hành.
- Hình thức như các map hiện có: tranh nền 2D HD vẽ cùng lối với đảo chính (chỉ mặt đất),
  vật rắn là vật thể riêng có chân đế/bóng tiếp xúc/va chạm đúng; bộ ba dữ liệu
  `data/<map>/Map_Collision.json`, `Map_Navigation.json`, `Map_Objects.json` theo đúng
  khuôn của island/hauson; `python3 tools/audit.py <map>` phải PASS; mọi neo nhiệm vụ và
  điểm đứng phải tới được bằng đường đi thật (kiểm bằng chính điều hướng của engine).
- Kết nối: Đài Truyền Tống (`dais_qt`) thêm một điểm đến tới map mới và map mới có cổng về,
  theo đúng kỷ luật chống dội cổng hiện hành. **Điều kiện mở: chỉ đi được sau khi hoàn
  thành Q8** (phong ấn mở khi chuỗi Bạch Hổ đã xong); trước Q8, cổng báo đang phong ấn như
  đoạn kết hiện tại. Đăng ký map mới vào engine theo đúng khuôn hauson (tham số `?map=` và
  đường nạp dữ liệu) — chỉ sửa điểm đăng ký tối thiểu, không đổi logic di chuyển/cổng/vẽ.
- Trong map có: điểm tới (thềm đáp cổng), vùng săn cho quái mới (mục 3.3), arena cho
  Boss 002 (mục 3.4) có không gian né, đường tiếp cận, lối thoát — arena có thể là vùng
  riêng trong cùng map hoặc map con riêng theo khuôn hauson; chọn một và ghi rõ.

### 3.2 Chuỗi nhiệm vụ mới Q9–Q13 (nối tiếp Q8)

- Thêm **5 nhiệm vụ** (Q9–Q13) vào cùng bảng `QUESTS` của `tools/build_quests.py` (n=9..13,
  id dạng `q9_...`), chạy tiếp sau Q8 trong cùng chuỗi: Q9 mở đầu bằng việc phong ấn mở /
  tới map mới, các nhiệm vụ giữa dẫn người chơi qua map mới (khám phá, săn quái mới, tinh
  anh mới), Q13 (hoặc nhiệm vụ cuối bạn cơ cấu) là trận Boss 002 và trả nhiệm vụ kết chuỗi
  có thông báo kết thúc sạch sẽ. Sinh lại `data/Map_Quests.json` bằng bộ sinh;
  WALKTHROUGH phải PASS cho toàn chuỗi Q1→Q13.
- Quy ước giữ nguyên như Q1–Q8: neo giver/target/stand_tile/anchor_px thật trên dữ liệu
  map; mỗi bước có chỉ dẫn mũi tên + dấu "!" tại mục tiêu thật, đúng map, qua đúng cổng
  (logic chỉ đường xuyên map hiện có trong `js/gameplay.js` cho cặp island↔hauson phải được
  mở rộng theo đúng khuôn cho các cặp map mới — đây là phần tích hợp được phép trong
  gameplay.js, ngoài vùng đóng băng); thoại NPC ngắn đúng vai, là BẢN NHÁP — ghi rõ.
- **Phần thưởng qua đúng hook `applyQuestRewards`**, EXP thuần, nối tiếp đường cong hiện
  có: sau Q8 là 2250 EXP; đề xuất mỗi nhiệm vụ mới trong khoảng 650–900 EXP, tăng dần theo
  độ khó (số bạn chọn là ĐỀ XUẤT — ghi vào agy-done.md). Nếu tổng EXP vượt các mốc
  `xpNeed` hiện có, **nối thêm hàng cấp** vào `GAME_DATA.levels` theo đúng nhịp tăng hiện
  hành (mỗi cấp: xpNeed tăng dần, HP tối đa +~20, công +3, thủ +1–2, maxMp +15 theo công
  thức đã ghi trong mã, mpRegen +0,5) — không sửa bất kỳ hàng nào đã có.
- Luật giữ máu quái khi chết áp cho MỌI nội dung mới (quái mới, tinh anh mới, Boss 002):
  đi qua đúng đường `respawnPlayer` hiện hành; Boss 002 phải giữ cả HP và phase như
  Bạch Hổ. Không xây cơ chế hồi sinh/phần thưởng song song.

### 3.3 Quái mới cho map mới — 3–4 loài, gồm 1 tinh anh

- Mỗi loài theo chuẩn §28: đọc được bằng silhouette, màu chủ đạo + điểm nhấn theo hệ của
  map, hành vi phân biệt (ít nhất một loài nhanh/áp sát, một loài chậm/đòn nặng có
  telegraph dài hơn, tinh anh to hơn và có thêm một kỹ năng có telegraph riêng).
- Hoạt ảnh: mỗi loài có các trạng thái **idle / move / attack / hit / death PHÂN BIỆT RÕ
  bằng tư thế** trong sheet của mình (khuôn như sheet quái hiện có:
  `assets/monsters/monster_<slug>_sheet_v1.png` + tệp meta `.json` đi kèm); hồ sơ số liệu
  nối thêm vào `GAME_DATA.monsters` theo đúng khuôn hồ sơ hiện có (maxHp/atk/def/speed/
  aggroRadius/attackRange/telegraphDuration ≥ ~0,45 giây/attackCooldown/sheet/meta/h).
  Chỉ rung/bob toàn thân hoặc pulse tỉ lệ KHÔNG tính là hoạt ảnh. Telegraph + hitbox theo
  chuẩn: sát thương chỉ trong cửa sổ frame tấn công và tầm/hướng thật.
- Số liệu phải để nhân vật cuối Q8 (cấp 8: 358 HP / 53 công / 15 thủ — và cao hơn khi nhận
  thưởng Q9+) thắng được một cách trung thực khi né đòn đúng; ghi số đã chọn vào
  agy-done.md dưới nhãn ĐỀ XUẤT. Điểm spawn là neo dữ liệu trong Map_Objects của map mới,
  không di chuyển neo của map cũ.

### 3.4 Boss 002 — theo Quy trình sản xuất Boss 1.0

- Boss mới là chủ của map mới; nhận diện/hệ khớp chủ đề map (mục 3.1). Sản xuất theo đúng
  đường ống của quy trình: **khóa concept → khóa turnaround 8 hướng → Idle → Walk → Run →
  Combat (đòn của từng phase) → VFX/Hitbox → Atlas/JSON → tích hợp → QA**, không nhân rộng
  một lỗi hình sang hướng/hoạt ảnh khác. Bàn giao sản xuất tại
  `Tien_Lo/Boss/Boss_002_<Tên>/` (cấu trúc 01–09 theo quy trình), khung độc lập đặt tên
  `boss_<slug>_002__{animation}__{direction}__{frame:03}.png`; tài nguyên tích hợp vào
  game đặt dưới `assets/` theo khuôn boss hiện có.
- Mục tiêu bộ khung theo quy trình là 126 khung/hướng × 8 hướng. Thực tế một phiên: làm
  tới đâu chắc tới đó theo đúng thứ tự đường ống — **tối thiểu bắt buộc** để tính là đã
  tích hợp: Idle, Walk, đòn chính của cả 3 phase, Hit, Death — mỗi bộ × 8 hướng thật,
  khung PNG độc lập. Phần chưa làm tới phải khai rõ trạng thái (concept / đang sản xuất)
  trong agy-done.md và trong tệp trạng thái đặt tại thư mục bàn giao boss. **LUẬT GHI NHÃN
  áp tuyệt đối**: không phần hình nào của Boss 002 được khai là "đã qua QA" nếu chưa qua
  cổng kiểm của mục 5; trong game, boss dùng đúng tài nguyên đã sản xuất — không hình giữ
  chỗ, không rung/bob thay hoạt ảnh.
- Trận đấu: 3 phase theo HP với ngưỡng và bộ đòn phân biệt (khuôn Bạch Hổ: phase 1 đòn
  thường có telegraph; phase 2 thêm đòn diện có **vùng cảnh báo trên đất** hiện đủ lâu để
  né, telegraph ≥ 700ms; phase 3 thêm đòn lao/diện rộng + tăng nhịp), tín hiệu chuyển phase
  rõ (gầm + hiệu ứng), thanh máu boss trên HUD dùng lại khuôn Bạch Hổ, bắt đầu trận có
  khoảnh khắc xuất hiện không gây sát thương bất ngờ, cổng thoát mở suốt trận, chết trong
  trận → hồi sinh tại thềm tới của map, **boss giữ nguyên HP và phase** (luật giữ máu).
  Boss chết → sự kiện hoàn thành nhiệm vụ boss tại chỗ.
- VFX của boss tách khỏi thân (lớp/tệp riêng); pivot đo theo điểm tiếp đất và ghi số vào
  JSON atlas; hitbox/hurtbox và cửa sổ sát thương cấu hình độc lập theo từng đòn.

### 3.5 Tích hợp — mọi thứ phải chơi được trong lát cắt

- Luồng trọn vẹn phải chạy được: nhân vật đã xong Q8 → nhận Q9 → cổng mở → qua map mới →
  làm trọn chuỗi → đánh Boss 002 → trả nhiệm vụ cuối → kết thúc sạch. Nhân vật CHƯA xong
  Q8 thì cổng vẫn phong ấn.
- Không hồi quy: chuỗi Q1–Q8, phần thưởng, luật giữ máu, cổng island↔hauson, và vùng đóng
  băng HUD (game vẫn khởi động với HUD, 5 chiêu vẫn tung được) phải nguyên vẹn.

## 4. Giới hạn cứng — vi phạm bất kỳ điều nào là đợt làm hỏng

1. KHÔNG thiết kế lại map cũ: không sửa tranh nền, `Map_Collision.json`,
   `Map_Navigation.json`, vị trí/vùng chân đế trong `Map_Objects.json` của island/hauson,
   và không di chuyển bất kỳ neo nào của Q1–Q8 trong `Map_Quests.json`.
2. KHÔNG sửa vùng đóng băng ở mục 2.1. KHÔNG sửa tệp trong `docs/standards/`. KHÔNG sửa
   `tools/audit.py` / `tools/build_quests.py` để làm cổng dễ qua hơn (được thêm DỮ LIỆU
   nhiệm vụ/map mới vào bộ sinh theo đúng khuôn, không được nới kiểm).
3. KHÔNG xây châu lục khác, KHÔNG online/server/đăng nhập/lưu đám mây. Tên hiển thị trong
   game vẫn là **Tiên Lộ**. Không xây hệ tu luyện ngũ hành đầy đủ trong phiên này.
4. Hình mới phải tuân Art Bible: vẽ/sinh hình 2D HD cùng lối vẽ/ánh sáng — cấm pixel art,
   cấm chất liệu render 3D, cấm emoji/hình giữ chỗ, cấm vẽ bằng mã. Nền vẫn chỉ có mặt
   đất; vật rắn vẫn là vật thể riêng có va chạm đúng chân đế.
5. KHÔNG lật gương giả hướng cho boss/quái có chi tiết bất đối xứng; KHÔNG dùng một tư thế
   tĩnh rung/bob thay cho hoạt ảnh trạng thái.
6. Mọi con số gameplay bạn chọn đều là ĐỀ XUẤT — ghi vào agy-done.md, không tuyên bố là
   thông số chính thức. Lời thoại mới là BẢN NHÁP — ghi rõ.
7. KHÔNG thêm nút/chế độ gian lận, bất tử hay đường tắt thắng nhanh vào giao diện chơi.
   Kịch bản kiểm thử được phép lái qua console như bộ lái kiểm thử, như các đợt trước.

## 5. Sản phẩm bàn giao bắt buộc

- Game chơi được tại `index.html`: trọn luồng Q1 → nhiệm vụ cuối của chuỗi mới, gồm
  `?map=<map mới>` mở thẳng map mới.
- `docs/agy-checks.log`: đầu ra THẬT của các lần kiểm, gồm tối thiểu:
  (a) `python3 tools/audit.py island`, `python3 tools/audit.py hauson`,
      `python3 tools/audit.py <map mới>` — phải PASS cả ba;
  (b) `python3 tools/build_quests.py` — WALKTHROUGH: PASS cho toàn chuỗi;
  (c) kịch bản chơi thử tự động bằng trình duyệt headless (theo mẫu `tools/shoot.mjs` /
      `tools/finisher-playtest.mjs`) lái trọn chuỗi từ Q1 (hoặc từ save đã xong Q8 do
      chính kịch bản tạo qua lượt chơi Q1–Q8) tới nhiệm vụ cuối của chuỗi mới bằng luồng
      chơi thật, in tiến độ từng nhiệm vụ — kèm ảnh chụp ở các mốc: cổng phong ấn trước
      Q8 (bị chặn), cổng mở sau Q8, toàn cảnh map mới, giao chiến quái mới, tinh anh mới,
      Boss 002 phase 1, vùng cảnh báo phase 2, đòn lao/diện phase 3, boss chết, trả nhiệm
      vụ cuối;
  (d) kiểm chứng luật giữ máu trên Boss 002: cho nhân vật chết có chủ đích giữa trận, ghi
      dòng đối chiếu HP/phase của boss trước và sau hồi sinh (khuôn dòng "HP PERSISTENCE"
      của đợt phần thưởng);
  (e) kiểm chứng vùng đóng băng: game khởi động, HUD hiện, tung thử ít nhất một chiêu
      trong `assets/skills/` thành công (ghi kết quả thật; nếu dùng
      `tools/hud-harness.mjs` được thì ghi đầu ra của nó);
  (f) bảng kê hình Boss 002 và quái mới: từng bộ hoạt ảnh × số hướng × số khung đã sản
      xuất, số đo pivot, và trạng thái nhãn (concept / đang sản xuất / đã qua QA) của
      từng phần.
- `docs/agy-done.md`: kể file-từng-file đã tạo/sửa gì; thiết kế đã xây (tên/hệ của map và
  cách nối cổng, danh sách nhiệm vụ + EXP từng nhiệm vụ, danh sách quái + số liệu, Boss
  002: tên/hệ/3 phase/bộ đòn); bộ số gameplay đã chọn (nhãn ĐỀ XUẤT); lời thoại là bản
  nháp; **tuyên bố tuân thủ vùng đóng băng** (đã chạm tệp/đoạn nào thuộc vùng đóng băng —
  nếu có — và vì sao, hoặc khẳng định không chạm); trạng thái hình theo luật ghi nhãn; và
  mọi điểm yếu còn lại bạn tự biết — khai thật, không giấu.
- Làm việc tới khi xong toàn bộ hoặc tới khi gặp lỗi không tự vượt qua được; ghi tiến độ
  vào agy-done.md theo từng mốc để nếu phiên bị ngắt, đội khác tiếp quản được đúng điểm
  dừng. Nếu dừng giữa chừng, agy-done.md phải ghi rõ đã xong tới đâu và còn thiếu gì.
