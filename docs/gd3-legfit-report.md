# GD3 — Đợt chỉnh tỉ lệ chân hướng ngang (legfit), 2026-11-10

Lệnh của Bui lúc 22:49 ngày 2026-11-10: **"Chân ngang vừa thân"** — chân ở hướng
ngang (Đông/Tây) phải vừa tỉ lệ thân chibi. Làm trên bản chính gd3 sau khi đợt
gộp stride4 đã xong hẳn. **Toàn bộ hình đợt này nhãn CHƯA NGHIỆM THU, chờ Bui
phán — báo cáo này không tự kết luận đạt.**

## 1. Số đo TRƯỚC khi sửa (master px, ô 384; neo = bộ chặng A–D đã duyệt)

| Hàng | Cao | Rộng | Đầu | Chân lộ dưới khối váy (trung vị) | Khoảng hai chân chạm đất (khung tiếp đất 1 / 5) |
|---|---|---|---|---|---|
| Đông — ĐÃ DUYỆT đi bộ | 351,5 | 220 | 138 | ~27 | **92,5** / — |
| Đông — stride4 đi bộ | 352 | 275,5 | **123** | ~38 (dao động 17–71) | **202,0 / 201,5** |
| Đông — stride4 chạy | 352,5 | 295 | 142 | ~37 | — |
| Tây — ĐÃ DUYỆT đi bộ | 350 | 231 | 137 | ~22,5 | 122,5 / 125,5 |
| Tây — stride4 đi bộ | 351 | 255 | 139 | ~38 | — / 151 |
| Tây — stride4 chạy | 351,5 | 292,5 | 153,5 | ~35 | — |

**Chẩn đoán:** phép tính sải của game đòi khoảng cách hai chân chạm đất ≈ bước ×
(352/118) → đi bộ ≈ **84 px**, chạy ≈ **125 px**. Hàng đi bộ Đông của stride4 đo
**202 px = gấp 2,4 lần phép tính của chính nó**; chân lộ dưới váy dài và thất
thường theo khung (17–71 px so với neo đều ~22–27 px); đầu hàng đi Đông nhỏ hơn
neo 11% (123 so với 138). Kết luận: chân hướng ngang **dang quá rộng và lộ quá
dài, không đều** — nhân vật đọc cao gầy, chân không vừa thân. Hướng lệch là
QUÁ DÀI / QUÁ RỘNG, không phải ngắn.

## 2. Cách sửa

- Sinh lại 4 tờ (đi/chạy × Đông/Tây) bằng neo kép như vòng 4/5: neo nhận diện =
  3 khung đã duyệt (đứng yên/đi/chạy 001) của chính hướng; bản đồ tư thế = hàng
  stride4 hiện tại. Brief khóa: chân không dang quá ~1 bề rộng đầu (đi) / ~1,5
  (chạy); hai tấm váy xám dài chấm gần đất che hết đùi, chỉ lộ cẳng chân ngắn +
  giày; đầu to ~2/5 chiều cao thân. Tách khung bằng cùng đường ống stride4
  (khóa tâm đầu theo dãy đã duyệt, tỉ lệ đồng nhất cả tờ, pivot (192, 360)).
- **Hàng đi bộ Đông:** tờ sinh về có 2 khung lệch hàng — khung 1 là tư thế CHẠY
  lạc phong cách, khung 5 là cú bước sải rộng (đo khoảng chân 204 px). Hai khung
  này đúng là hai khung TIẾP ĐẤT của chu kỳ. Đã thay khung 1 và 5 bằng **ô gốc
  của bộ đã duyệt (chặng A–D) nguyên trạng** (ghép theo pivot của chính chúng về
  điểm (192, 360)); 6 khung còn lại là hình sinh mới. Diện tích alpha của hai ô
  duyệt sau khi ghép đúng pivot: 46.172 / 46.010 px — nằm giữa gia đình mới
  (trung vị 40.913, tỉ lệ 1,12). Khoảng chân chạm đất khung 1 sau sửa = **92,5
  px**, khớp đúng neo đã duyệt.
- Đóng gói lại 2 atlas trong gd3, chỉ thay 4 hàng Đông/Tây. 96 khung của 12
  hàng còn lại đối chiếu **khớp từng pixel** với atlas trước đợt. Mã md5 sau
  sửa: walk `0663c683570e2e55b4ffd1911ff37585`, run
  `597388ef74d45775c4dab69abf2c4e45`.

## 3. Số đo SAU khi sửa

| Hàng | Cao | Đầu (neo) | Khoảng chân tiếp đất | Ghi chú |
|---|---|---|---|---|
| Đông đi bộ | 352 | 123 (138) | **92,5** (khung 1, ô duyệt) | khung 1/5 là ô đã duyệt nguyên trạng |
| Đông chạy | 352,5 | 143 (142) | — | đầu khớp neo |
| Tây đi bộ | 351 | **138,5 (137)** | — | đầu khớp neo; chân khuất dưới tấm váy như thiết kế duyệt |
| Tây chạy | 351,5 | 154,5 (145) | 110 (khung 1, trong dải chạy ~125) | đầu to hơn neo ~6,5% |

Lưu ý về thước đo: trên hình mới (tấm váy dài chấm gần đất theo đúng thiết kế
đã duyệt), các thước "khoảng chân" và "chân lộ" đo theo biên dưới của hình sẽ
bắt phải gấu váy/choàng thay vì giày ở nhiều khung — các số đó được giữ trong
log kèm ghi chú, và phán quyết dựa trên bảng khung 118 px + clip + cổng diện
tích, đúng tiền lệ các vòng trước (bộ đo mù một phần trên hình vẽ tay).

## 4. Cổng kiểm chứng (đọc từ log)

- **Cổng chống cụt hình** (quy tắc cứng của dự án, áp lên atlas đã đóng gói
  qua pivot của chính atlas): **ALL PASS — 128/128 khung, 16/16 dải**, gồm cả
  hàng đi bộ Đông sau khi ghép ô duyệt.
- **Bộ kiểm của cây** (`tools/run_all_checks.mjs`): **100% PASS**, log tại
  `tools/legfit/logs/run_all_checks_legfit.log`.
- **Lái thật trên bản gd3 sau sửa** (bước mô phỏng 50 ms, đo độ dời vị trí):
  đi Đông **90,0 px/giây**, đi Tây **90,0**, chạy Đông **218,0**, chạy Tây
  **218,0** — tốc độ bản chính giữ nguyên; khung chân đổi theo pha khi di
  chuyển (thấy rõ trong các khung tĩnh trích từ clip).

## 5. Điểm yếu khai thật

1. Hàng đi bộ Đông: 6 khung sinh mới có đầu nhỏ hơn neo ~11% (trung vị 123 so
   với 138), trong khi khung 1/5 là ô duyệt đầu to đúng neo — trong hàng có
   chênh lệch cỡ đầu nhẹ; ở 118 px và khi chuyển động đọc khá nhẹ nhưng có
   thật.
2. Hàng chạy Tây: đầu to hơn neo ~6,5% (154,5 so với 145).
3. Hàng đi bộ Đông không phải 8/8 khung sinh mới đồng nhất: khung 1/5 là ô đã
   duyệt nguyên trạng (đây là lựa chọn có chủ đích để giữ đúng tư thế tiếp đất
   và tỉ lệ neo; hai khung sinh mới tương ứng bị loại vì lạc phong cách/sải
   quá rộng).
4. Chưa triển khai hosting — bản gd3 vẫn chạy nội bộ như trước đợt này.

## 6. Bằng chứng

- Clip chỉ di chuyển Đông/Tây (đứng yên → đi Đông → đi Tây → chạy Đông → chạy
  Tây) ở tốc độ bản chính: `proof/legfit/legfit-ew-clip.mp4` (118 khung, 5,9
  giây) + bảng tốc độ `proof/legfit/legfit-ew-clip-segments.json`.
- Khung tĩnh trong game trích từ clip: `proof/legfit/clip_stills.png`.
- Bảng 118 px ba đời (đã duyệt | stride4 trước sửa | legfit sau sửa), hàng
  trên là neo đã duyệt: `tools/legfit/boards/trio_walk_E_118.png`,
  `trio_walk_W_118.png`, `trio_run_E_118.png`, `trio_run_W_118.png`.
- Số đo thô: bảng trước sửa ở mục 1 được ghi lại nguyên văn từ lượt đo đầu
  (atlas trước đợt còn nguyên tại `tools/legfit/logs/pre_legfit_walk.png` /
  `pre_legfit_run.png` để đo lại bất cứ lúc nào); số sau sửa tại
  `tools/legfit/logs/measure_after_atlas.json` và `measure_after.json`.
- Đường ống: `tools/legfit/` (separate_stride4.py, pack_legfit.py,
  gate_check4.py, legfit_clip.mjs).

**Nhãn: CHƯA NGHIỆM THU — chờ Bui phán.**
