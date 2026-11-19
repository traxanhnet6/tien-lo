# Báo cáo GỘP DI CHUYỂN STRIDE4 VÀO BẢN CHÍNH GD3 (+ CHỈNH TỐC ĐỘ 22:40)

Thời gian: 2026-11-10. Phán của Bui 22:30: "Đạt, gộp vào bản chính";
lệnh chỉnh ngay sau đó 22:40: **"Sửa được chậm tý nữa"** — tốc độ đi bộ
chậm hơn một ít so với 100 vừa gộp. **Con số cuối của đợt: đi bộ
90 px/giây, chạy 218 px/giây.**

Nguồn gộp: `~/workspace/game-tien-lo-move1-stride4/` (báo cáo
`docs/stride4-report.md` của cây nguồn, đã đóng cả mục khép hàng Đông
Nam). Đích gộp: cây này (`~/workspace/game-tien-lo-gd3/`). Phạm vi: CHỈ
phần di chuyển của nhân vật — không đụng online/WebSocket/máy chủ/
HUD/nhiệm vụ/boss. Không triển khai hosting công khai (chờ quyết định
riêng của Bui).

## 1. Tệp tài sản đã chuyển (sao byte, đối chiếu md5 khớp 100%)

Thư mục mới `assets/char_workflow/` trong gd3:

| Tệp | md5 | Vai trò |
|---|---|---|
| `hanhan_stride4_walk.png` | `4d854c9599fbde5acd59eb014e0a2a65` | Atlas đi bộ vòng 5 (64 khung) |
| `hanhan_stride4_walk.json` | `5add4b81bbf1be01c7ebcdcb616fc9fa` | Khung/pivot đi bộ |
| `hanhan_stride4_run.png` | `4b2b81234af26a362b03992775fb9815` | Atlas chạy vòng 5 (64 khung) |
| `hanhan_stride4_run.json` | `ebe7144a1f8962cfd333840f60836434` | Khung/pivot chạy |
| `hanhan_stage_ab.png` | `41383d47a8e382153fc0d8adbdcb080d` | Atlas gốc A/B — nguồn khung ĐỨNG YÊN |
| `hanhan_stage_ab.json` | `0a8cc1b4d1a9a7a9e0d13a87f19d7dc4` | Khung/pivot đứng yên |

Ghi chú: brief nêu hai atlas đi/chạy; atlas stage A/B bắt buộc phải đi
kèm vì cơ chế của stride4 lấy khung idle từ atlas gốc (bỏ qua walk/run
của nó) — thiếu nó drawPlayer không có khung đứng yên. Đây là đúng cơ
chế nguyên văn của cây nguồn, không phải mở rộng phạm vi.

## 2. Đoạn mã đã chuyển vào `js/main.js` của gd3 (đối chiếu tay, KHÔNG chép đè)

Cấu trúc hai bản main.js khác nhau (gd3 dùng sheet lưới cũ không JSON +
đường riêng genEast cho hướng Đông/Tây; stride4 dùng hệ WORKFLOW), nên
gộp theo từng đoạn:

1. **Hằng số** (đầu tệp): bỏ `CELL_W/CELL_H/ANCH_X/ANCH_Y`, `ROW_OF`,
   `GEN` (chỉ còn được dùng bởi đường vẽ cũ) và thay bằng khối của
   stride4: `WORKFLOW = { charH: 352, walkStride: 7.0, runStride: 10.5,
   idleFps: 8 }`, `WORKFLOW_DIR` (front→S, SE→SE, east→E, NE→NE,
   back→N, NW→NW, west→W, SW→SW), `WORKFLOW_FRAMES = new Map()` — kèm
   khối chú thích phép tính khung/tốc độ (đã cập nhật số 90 ở mục 3).
   `PLAYER_H = 118` và `DIR_NAMES` của gd3 vốn đã trùng stride4.
2. **Nạp atlas** (`init()`): thay 4 lần nạp sheet cũ
   (`assets/char/hanhan_*_8dir_v1.png`, `assets/char_gen/walk_east.png`)
   bằng 6 lần nạp `assets/char_workflow/*` + hàm `ingest(data, page)`
   nguyên văn của stride4 (stage A/B bỏ qua walk/run; hai atlas
   stride4 được gán trường `page`; khung sắp theo tên). Mọi phần nạp
   còn lại của gd3 (bản đồ, vật thể, actor, cổng dịch chuyển, save)
   giữ nguyên.
3. **Vẽ nhân vật** (`drawPlayer()`): giữ nguyên câu móc riêng của gd3
   ở đầu hàm (`Gameplay.drawCastFrame` — khung tung chiêu của hệ kỹ
   năng HUD, giống hệt câu móc stride4 cũng có), thay toàn bộ thân sau
   đó bằng bản WORKFLOW của stride4: chọn `animation|direction` trong
   `WORKFLOW_FRAMES`, chỉ số khung = `floor(P.dist / stride) % len`
   khi di chuyển (stride = 10,5 khi chạy / 7,0 khi đi bộ),
   `floor(P.idleT * 8)` khi đứng yên, vẽ theo `f.rect`/`f.pivot` với
   tỉ lệ `PLAYER_H / 352` từ `S.sprites[f.page]` (đi/chạy) hoặc
   `S.sprites.workflow` (đứng yên). Từ đây cả 8 hướng đều có khung
   thật riêng — hướng Tây hết lật gương.
4. **Tốc độ đi theo đường** (`updatePlayer()`): xem mục 3.

## 3. CHỈNH TỐC ĐỘ THEO LỆNH 22:40 — ĐI BỘ 90 PX/GIÂY

Bản gộp ban đầu mang sang 100 px/giây của stride4; lệnh "chậm tý nữa"
được áp ngay trong cùng đợt, chọn **90** (giảm đúng một tý — 10% —
đủ cảm nhận được khi đi thường nhưng không đổi tính chất; chạy giữ
218 nên tương phản đi/chạy tăng lên 2,42 lần). Ba điểm chạm:

1. `js/main.js` — `updatePlayer()`: `P.running ? 218 : 100` →
   **`P.running ? 218 : 90`** (biểu thức tốc độ thực thi của đường
   đi theo lộ trình/chạm).
2. `js/game_data.js` — `GAME_DATA.player.speed`: 100 → **90**
   (`runSpeed` giữ 218) — chỉ số khai báo tương ứng.
3. `js/gameplay.js` — cần điều khiển analog: `round(100 + 118 * frac)`
   → **`round(90 + 128 * frac)`**. Lý do phải chạm điểm này: dải tốc
   độ của cần vốn bám đúng [đi bộ chuẩn, chạy] = [100, 218]; nếu giữ
   sàn 100 thì cú đẩy cần nhẹ nhất đã nhanh hơn đi bộ chuẩn mới 90 —
   mâu thuẫn thẳng với lệnh "chậm hơn". Sàn mới 90, trần giữ 218,
   ngưỡng tính chạy (> 200) không đổi. Đây là ánh xạ nhất quán của
   cùng một con số, không phải thay đổi cảm giác điều khiển nào khác.

Hệ quả hình học: engine tiến khung theo quãng đường
(`floor(P.dist / 7,0)`) nên chân chống vẫn quét khớp mặt đất ở tốc độ
mới; chu kỳ đi bộ 56 px ở 90 px/giây kéo dài 56/90 ≈ 0,62 giây →
**nhịp bước đi bộ ~3,2 bước/giây** (chạy không đổi: chu kỳ 84 px ở
218 ≈ 0,39 giây, ~5,2 bước/giây). Khối chú thích WORKFLOW trong
main.js đã cập nhật theo các số này.

Máy chủ (`server/server.mjs`) không chứa logic tốc độ di chuyển nào
(chỉ giữ HP boss/pha, sát thương, mana, hồi chiêu) — không cần ánh
xạ. Người chơi từ xa (online) vẫn vẽ bằng hình hiện diện đơn giản
trong `Gameplay.renderWorldVFX` như trước — ngoài phạm vi đợt này.

Các tệp sprite nhân vật cũ (`assets/char/*`, `assets/char_gen/*`)
không còn được tham chiếu ở bất kỳ đâu (đã grep toàn cây: js/
index.html/tools/server) nhưng được GIỮ NGUYÊN trên đĩa — xóa hay
không là quyết định dọn dẹp riêng, không tự ý làm trong đợt gộp.

## 4. Kiểm chứng (đọc từ log thật)

### 4.1 Sau gộp (ở 100 px/giây)
- **Bộ kiểm của cây** — `tools/run_all_checks.mjs`: PASS toàn bộ các
  cổng mục 5, 0 dòng FAIL (`docs/agy-checks.log` lượt đầu): toàn vẹn
  3 bản đồ, Q1–Q13 thông suốt, giữ máu Boss 002 (912 → 912), vùng
  đóng băng HUD/kỹ năng, bảng kê hình ảnh.
- **Máy chủ + harness hai client** — `tools/gd3-online-harness.mjs`:
  **ALL ONLINE CHECKS PASS, đủ 18/18** như đợt GD3 (hai client kết
  nối, thấy nhau đúng vị trí, HP quái đồng nhất từng bước, hạ quái
  hợp tác, MP máy chủ giữ, không ngoại lệ trang; nhật ký
  `proof/gd3-verify/gd3-online-harness.log`). Lượt này chạy trước
  chỉnh tốc độ; chỉnh 22:40 chỉ đổi hằng số tốc độ phía client nên
  không ảnh hưởng giao thức/máy chủ — và bộ kiểm cây + lái thật đã
  chạy lại đầy đủ sau chỉnh (mục 4.2).

### 4.2 Sau chỉnh 90 px/giây (bản cuối)
- **Lái thật** — probe CDP riêng, máy chủ GD3 phục vụ chính bản cuối:
  **MERGE PROBE: ALL PASS**
  - Bảng khung: idle/walk/run đủ 8 hướng × 8 khung; mọi khung walk
    mang `page = "stride4_walk"`; hai atlas 3072×3072; hằng số
    WORKFLOW = 7,0 / 10,5 / charH 352.
  - **Đi bộ** (bấm chuột thật trên canvas, đường ngắn < 620 nên không
    tính chạy; đo theo đồng hồ game `S.t` qua `P.dist`): **đúng
    90,0 px/giây**; 46 mẫu đang di chuyển, chỉ số khung chân chạy đủ
    cả chu kỳ (0, 1, 5, 6, 7, 2, 3, 4 — cả 8 khung phân biệt), không
    mẫu nào bị gắn cờ chạy; ảnh chụp hai thời điểm giữa chặng đi
    khác nhau rõ ở vùng nhân vật (chênh lệch mẫu byte = 366).
  - **Chạy** (giữ phím D thật — bề mặt WASD của game nạp 218): **đúng
    218,0 px/giây**; cờ chạy bật, hoạt ảnh "run", khung chạy chạy
    đủ 8 khung (7, 1, 2, 3, 4, 5, 6, 0). Không ngoại lệ trang.
  - Ảnh bằng chứng: `proof/merge-stride4/walk_frame_a.png`,
    `walk_frame_b.png`, `walk_scene.png` (lượt lái ở bản cuối 90).
- **Bộ kiểm của cây chạy lại** — `tools/run_all_checks.mjs`: **100%
  PASS, 0 dòng FAIL** (nhật ký `docs/agy-checks.log`, timestamp
  2026-11-10T15:43:21Z — lượt sau chỉnh tốc độ).

## 5. Ghi chú quá trình (trung thực)

- Lượt probe đầu dùng `TL2.setManualInput` một lần rồi chờ: nhân vật
  chỉ đi ~1,7 px rồi dừng. Nguyên nhân đọc từ mã:
  `Gameplay.updateSkills` gọi `setManualInput(null)` mỗi khung khi
  không có phím di chuyển nào được giữ và cần điều khiển rảnh — đầu
  vào nạp một lần bị hủy ngay khung kế tiếp (hành vi đúng của game,
  không phải lỗi gộp). Probe đổi sang hai bề mặt lái thật bền vững
  (bấm canvas đi đường ngắn + giữ phím WASD) và đạt toàn bộ.
- Giữa đợt, lớp lưu trữ của máy ảo chặn ghi qua shell lẫn công cụ
  tệp một thời gian ("Disk quota exceeded" dù đĩa còn 43G — sự cố
  hạ tầng đã biết, tự hồi lúc ~22:42); báo cáo này được viết sau
  khi lớp ghi hồi, ảnh bằng chứng đã chép đủ vào `proof/merge-stride4/`.
