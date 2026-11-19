# Tiên Lộ iso3 — Báo cáo: đảo Thanh Vân 7 khu + map riêng Hậu Sơn + chuỗi nhiệm vụ tân thủ

Cây: `~/workspace/game-tien-lo-iso3/` — nhân rộng phương pháp tranh-vẽ-nguyên-cảnh của iso2 lên toàn bộ
Thanh Vân Tiên Môn, kèm hai lệnh bổ sung của người dùng: **map nhiệm vụ chuẩn** (09:10) và
**Hậu Sơn là map riêng** (09:12). Chưa deploy; dừng ở cây đã qua cổng chờ parent kiểm.

---

## 1. Cấu trúc hai map

| Map | Nội dung | Nền | Dữ liệu |
|---|---|---|---|
| `island` | 7 khu: Sơn Môn → Quảng Trường → Đại Điện → Luyện Võ Trường → Trúc Linh Lâm → Linh Tuyền → Vân Ẩn Động | 8 tranh vẽ ghép thành một ảnh 4400×2640 (tranh Hậu Sơn dùng làm dải sườn mờ phía sau đảo, không còn là khu chơi được) | `data/island/` |
| `hauson` | Đấu trường boss Bạch Hổ Sơn Quân | Tranh riêng 2240×1120 dùng nguyên bản | `data/hauson/` |

Hai map nối bằng **cổng dịch chuyển** (đài vòng phù phát sáng): cổng đi đặt tại thềm sau phía tây
Đại Điện (biển "⇄ Cổng Hậu Sơn" + bia đá + 2 đèn), cổng về đặt tại thềm vào của map Hậu Sơn
(biển "⇄ Về Thanh Vân"). Kỷ luật chống dội cổng (bài học từ lỗi portal bounce-back ở game khác)
đã cài vào engine và kiểm chứng bằng dữ liệu:

- Điểm tới sau cổng nằm **ngoài** bán kính kích hoạt của cổng về: Hậu Sơn 135px (bán kính 90),
  đảo chính 126px (bán kính 85).
- Sau khi nhảy map có **ân hạn 1,2 giây** cổng không kích hoạt.
- Cổng chỉ "lên nòng" sau khi người chơi đã **rời khỏi** vùng kích hoạt một lần (arm-on-exit).

Engine dùng chung: lưới đẳng cự 2:1 phủ trên tranh, va chạm/điều hướng/vật thể là dữ liệu riêng,
A* 8 hướng cấm cắt góc + đổi tầng chỉ qua ô cầu thang, chạm-để-đi, lia cam, zoom bậc lưu bền,
khóa zoom cử chỉ. Công trình lớn (cổng Sơn Môn, Đại Điện) tách mái/thân để nhân vật đi sau đúng lớp.

## 2. Chuỗi 8 nhiệm vụ tân thủ (tài liệu tổng hợp §G.4 — tên và mục tiêu nguyên văn)

Mọi mục tiêu là **neo dữ liệu** trong `data/Map_Quests.json` (id, map, khu, ô neo, ô đứng được,
tọa độ điểm ảnh) — mũi tên dẫn đường và dấu "!" bind vào neo này, không có tọa độ màn hình cứng.

| # | Nhiệm vụ | Mục tiêu (nguyên văn) | Người giao (neo) | Mục tiêu (neo) | Map/Khu | Tới được |
|---|---|---|---|---|---|---|
| 1 | Tân nhân nhập môn | Gặp chấp sự. | Tiên Đồng `npc_tiendong` | Chấp Sự `npc_chapsu` | island / Quảng Trường | Có |
| 2 | Bước chân tu tiên | Di chuyển và tương tác. | Chấp Sự | Đài Truyền Tống `dais_qt` | island / Quảng Trường | Có |
| 3 | Luyện kiếm nhập môn | Đánh 5 Trúc Yêu. | Trưởng Lão Võ `npc_truonglao` | Bầy 5 Trúc Yêu `mon_trucyeu_1..5` | island / Trúc Linh Lâm | Có (cả 5 con, từng con một) |
| 4 | Thu thập linh thảo | Thu thập 5 linh thảo. | Đan Dược Sư `npc_dansu` | 5 nút linh thảo `herb_node_1..5` | island / Trúc Linh Lâm | Có (cả 5 nút) |
| 5 | Truy tìm dấu vết | Khám phá Vân Ẩn Động. | Chấp Sự | Thủ Vệ `npc_thuve` (điểm kiểm soát) + điểm miệng hang (655,600) | island / Vân Ẩn Động | Có |
| 6 | Thạch Vệ thức tỉnh | Đánh bại tinh anh. | Thủ Vệ | Thạch Vệ Tinh Anh `mon_thachve_elite` | island / Vân Ẩn Động | Có |
| 7 | Bạch Hổ xuất thế | Đánh boss. | Chưởng Môn `npc_chuongmon` | Bạch Hổ Sơn Quân `boss_bachho` qua `portal_to_hauson` | **hauson / Hậu Sơn** | Có |
| 8 | Xuất môn lịch luyện | Mở khu vực kế tiếp. | Chưởng Môn | Đài Truyền Tống `dais_qt` | island / Quảng Trường | Có |

### Walkthrough kiểm chứng (cổng bắt buộc — `tools/build_quests.py`, kết quả `proof/walkthrough.json`: ĐẠT)

Đi theo đúng thứ tự chuỗi, bằng luật di chuyển của engine, gồm cả hai chặng nhảy map:

| Chặng | Quãng đường | Kết quả |
|---|---|---|
| Điểm xuất hiện Sơn Môn → Tiên Đồng | 2 ô | Có |
| Tiên Đồng → Q1 Chấp Sự | 21 ô | Có |
| Q1 Chấp Sự → Q2 Đài Truyền Tống | 3 ô | Có |
| Q2 Đài → Q3 người giao Trưởng Lão Võ | 20 ô | Có |
| Trưởng Lão Võ → Q3 Trúc Yêu (con đầu) | 50 ô | Có |
| Trúc Yêu → Q4 nút linh thảo (nút đầu) | 1 ô | Có |
| Linh thảo → Q5 Thủ Vệ | 58 ô | Có |
| Thủ Vệ → Q5 miệng Vân Ẩn Động | 1 ô | Có |
| Miệng hang → Q6 Thạch Vệ Tinh Anh | 10 ô | Có |
| Tinh Anh → Cổng Hậu Sơn | 16 ô | Có |
| **Nhảy map** island → hauson | cổng dịch chuyển | Có (điểm tới cách cổng về 135px) |
| Điểm tới Hậu Sơn → Q7 Bạch Hổ Sơn Quân | 9 ô | Có |
| Boss → cổng về | 9 ô | Có |
| **Nhảy map** hauson → island | cổng dịch chuyển | Có (điểm về cách cổng đi 126px) |
| Điểm về → Q8 Chưởng Môn | 15 ô | Có |
| Chưởng Môn → Q8 Đài Truyền Tống | 17 ô | Có |

## 3. Các cổng kiểm toán (đều đọc từ log/dữ liệu thật)

| Cổng | Island | Hậu Sơn |
|---|---|---|
| Tổng số ô lưới | 4.174 | 696 |
| Ô đi được = ô tới được từ điểm xuất hiện | **3.541 = 3.541 (100%)** | **675 = 675 (100%)** |
| Ô bịt kín (túi chết sau dải mép/hồ/vật thể) | 130 (đã niêm phong, không còn là ô "đi được") | 0 |
| Vật thể/actor | 97 (9 NPC, 10 quái, còn lại vật thể) | 8 (boss + cổng về + đồ nghi lễ) |
| Chân đế khớp dữ liệu | 77+ dấu chân kiểm từng cái: mọi ô tâm nằm trong dấu chân đều bị chặn đúng chủ | Đạt |
| Neo nhiệm vụ đứng được + tới được | 21/21 neo (gồm từng con Trúc Yêu, từng nút linh thảo) | boss đạt |

Bằng chứng hình ảnh (`proof/`): ảnh điện thoại 390×844 đủ 7 khu + cổng sau + Hậu Sơn
(`shot_phone_*.png`), ảnh desktop toàn đảo + toàn map Hậu Sơn (`shot_desktop_full.png`,
`shot_desktop_hauson.png`), **bảng kiểm chân đế 16 vật thể** (`base_check_sheet.jpg` — crop phóng to
tại chân: trụ cổng, thềm điện, vách hang, hai đài cổng, sạp rèn, Thợ Rèn, Trúc Yêu, hình nhân,
cây cổ, lư hương ×2, cột đá Linh Tuyền, đèn Vân Ẩn, chân boss, đèn Hậu Sơn — tất cả bám đất),
hai clip đi bộ (`clip_walk.mp4` đi trọn luồng nhiệm vụ trên đảo, `clip_hauson.mp4` từ điểm tới
lên thang vào arena), và clip được quay bằng chính engine (không phải dựng hình).

## 4. Rà soát logic bố cục từng khu (cổng "ghép chuẩn logic" — đối chiếu ảnh chụp cỡ thật)

- **Sơn Môn — ĐẠT.** Cổng paifang đứng trên bậc nam của bệ đá vẽ sẵn, đúng trục vào; Tiên Đồng
  đứng cạnh cột phải (điểm chào nhiệm vụ); đèn đá hai bên đường lên; bia đá hai bên bệ; cây/đá ở
  mép cỏ. Tỉ lệ: cổng cao ~5 lần nhân vật (đúng tầm cổng tông môn), khoảng giữa hai trụ 194px —
  nhân vật (~55px) qua thoải mái.
- **Quảng Trường — ĐẠT.** Đài Truyền Tống nằm trên trục vẽ sẵn của quảng trường, cạnh huy chương
  khắc; Chấp Sự đứng cạnh đài, không bị che. Hàng chợ phía tây (sạp dược + Đan Dược Sư đứng trước
  sạp của mình, sạp thảo mộc), lò rèn phía đông gom cụm đúng nghề (sạp + Thợ Rèn + giá binh khí +
  tạ đá), sạp Thương Nhân phía đông-nam. Đèn hai bên huy chương. Hai chân cầu thang lên Đại Điện
  không bị vật nào chắn.
- **Đại Điện — ĐẠT (sau một vòng sửa).** Điện ba tầng đứng giữa nền móng vẽ sẵn của tranh; Chưởng
  Môn đứng trước điện trên thềm (không bao giờ bị mái che); lư hương hai bên đầu thang lớn; đèn
  hai bên mặt điện. *Vòng rà soát đầu phát hiện cổng sau đặt ngay sau điện bị mái che khuất — đã
  dời sang thềm sau phía tây (đúng hướng từ Vân Ẩn sang), mở rộng thềm, chụp lại đạt.*
- **Luyện Võ Trường — ĐẠT.** Trưởng Lão Võ ở góc tây-bắc vòng đấu; 3 hình nhân phía đông/đông-nam
  trong sân; 2 giá binh khí + tạ đá dọc bờ bắc; Đệ Tử Luyện Võ phía đông-nam vòng; tâm vòng để
  trống cho đấu tập; đèn ở lối vào phía tây.
- **Trúc Linh Lâm — ĐẠT.** 5 Trúc Yêu đứng trong các khoảnh đất trống giữa lùm tre (đúng sinh
  cảnh), 2 Linh Lang gần lối mòn, 5 nút linh thảo nằm ở các khoảnh phát sáng, tre/cây lớn ở rìa
  tạo làn đi rõ; đường mòn vẽ sẵn luôn đi được.
- **Linh Tuyền — ĐẠT (nội dung nhẹ theo đúng tài liệu: khu thu thập).** Các hồ bị chặn như mặt
  nước thật; cột đá đứng trên thềm giữa hai hồ; hoa ở bờ nam; đèn tại cổ đất nối xuống Luyện Võ
  Trường. Không đặt NPC vì tài liệu giao khu này cho thu thập tài nguyên.
- **Vân Ẩn Động — ĐẠT.** Vách hang dựng ở sườn tây-bắc, bậc đá của chính sprite dẫn xuống miệng
  hang; Thủ Vệ đứng trước hang (điểm kiểm soát vào bí cảnh, không bị che); cặp Thạch Vệ + Thạch Vệ
  Tinh Anh (to hơn hẳn, 178px so với 130px) đứng sâu trong tiền sảnh trên nền đá trống; đèn hai
  bên lối vào hang.
- **Hậu Sơn (map riêng) — ĐẠT.** Boss đứng giữa vòng arena vẽ sẵn, quanh boss là một vòng sàn
  trống đủ rộng (không gian né đòn/cảnh báo theo chuẩn boss); lư hương nghi lễ + 2 đèn ngay đầu
  thang vào arena; đài về ở thềm vào, điểm tới nằm ngoài vùng kích hoạt của đài về; bia đá + thông
  + đá ở vành arena.

Thứ tự vẽ luôn theo lưới đẳng cự (vật ở sau không bao giờ chường lên vật ở trước); kiểm chứng
trực tiếp trong các ảnh: nhân vật đi sau cây thông tại cổng sau bị tán cây che đúng phần thân dưới,
đứng sau lư hương ở Hậu Sơn bị che đúng bởi lư hương.

## 5. Nhân vật

- Hướng **đông** dùng dải đi sinh hình đã được duyệt (bản genproto, 8 khung, neo (0,5; 0,9412),
  nhân vật 440px = 4× cỡ điện thoại); hướng **tây** là bản lật gương của chính dải đó; đứng yên
  hướng đông dùng khung đầu của dải đi.
- Sáu hướng còn lại vẫn dùng sheet FLA cũ (đầu đọc nhỏ hơn, khác lối vẽ) — **việc thay trọn bộ
  hoàn tất khi bộ sinh hình đầy đủ sẵn sàng**: bộ `~/workspace/game-ngu-hanh-art-gen/` đã xuất hiện
  trong lúc xây (đi bộ đủ 8/8 hướng) nhưng còn thiếu 2 dải chạy (nam, đông nam — lỗi công cụ sinh
  hình, đang chờ quyết định chạy lại) và đứng chờ mới có 3/8 hướng, nên chưa đạt mức "bộ đầy đủ" để
  thay theo đúng điều khoản của brief. Khi bộ đó đủ, cần một lượt engine đọc dải-riêng-theo-hướng
  (ô 512×476) thay cho sheet 96×120 hiện tại.

## 6. Điểm yếu thành thật (theo khu vực/toàn cục)

1. **Đảo đọc như các bậc nổi liên hoàn hơn là một khối đất liền**: mỗi tranh khu tự chứa vách đá
   ở mọi mép, nên tại biên giữa các khu vẫn thấy các dải vách/mây của từng tranh (đã feather làm
   mềm). Đúng ngôn ngữ "quần đảo nổi" của tài liệu, nhưng chưa phải một địa hình liền mạch tuyệt đối.
2. **Hai trục nghi lễ lệch nhau**: trục Đại Điện (x≈2200) và trục vẽ sẵn của Quảng Trường (x≈2820)
   lệch ~600px vì hai tranh sinh độc lập. Đã xử bằng HAI cầu thang đều có thật trong tranh (thang
   lớn phía tây + thang đông của quảng trường). Bài học cho các tranh sau: brief sinh hình phải
   khóa tọa độ trục trước.
3. Tranh Sơn Môn và Quảng Trường bị kéo giãn dọc khi ghép vào cửa sổ quá rộng (tỉ lệ cửa sổ
   4,1–4,8 so với tranh 2:1): địa hình chịu được, huy chương tròn thành elip — lại đúng phối cảnh
   đẳng cự 2:1 nên không lộ.
4. **Nền dưới đài cổng sau là dải sườn mờ** (tranh Hậu Sơn làm mờ) nên độ bám đất của đài mềm hơn
   chỗ lát đá; đài + bia + đèn vẫn đọc rõ là một cụm cổng sau.
5. Linh Lang (standee sói xanh sẫm dùng lại từ iso1) hơi "dán" so với nền rừng xanh — khác biệt
   lối vẽ nhẹ, chấp nhận được ở cỡ điện thoại nhưng là ứng viên vẽ lại đầu tiên của khu rừng.
6. Vách hang có vệt fringe sáng rất nhẹ ở mép alpha bên phải khi nhìn kỹ ở cỡ điện thoại.
7. Linh Tuyền là khu nhỏ nhất về đất đi được (174 ô) vì phần lớn tranh là nước/vách — đúng vai
   trò khu suối, nhưng nếu sau này cần nhiệm vụ phụ dày hơn ở đây sẽ cần nới đất bờ nam.
8. Sprite công trình sinh hình (điện, hang, đài) hơi bóng/polish hơn nền màu nước một chút — cùng
   họ sáng trên-trái, cùng bảng màu, nhưng chưa phải cùng một tay vẽ tuyệt đối.
9. Ở map Hậu Sơn trên màn hình desktop rộng, dòng gợi ý điều khiển ở góc dưới-trái nằm trên nền
   trời sáng nên khó đọc (chỉ là lớp chữ HUD, không ảnh hưởng chơi trên điện thoại).

## 7. Tệp chính

- Chơi thử: `index.html` (mặc định island; Hậu Sơn qua cổng trong game, hoặc `?map=hauson`).
- Engine: `js/main.js` (hai map, cổng dịch chuyển có kỷ luật chống dội, chip khu sinh từ dữ liệu).
- Dữ liệu: `data/island/`, `data/hauson/`, `data/Map_Quests.json`.
- Công cụ: `tools/compose_ground.py`, `tools/author_data.py`, `tools/audit.py` (chạy theo map),
  `tools/build_quests.py` (neo nhiệm vụ + walkthrough), `tools/shoot.mjs` (bộ chụp bằng chứng).
- Bằng chứng: thư mục `proof/` (ảnh 2 map, bảng chân đế, 2 clip, `audit_island.json`,
  `audit_hauson.json`, `walkthrough.json`).
