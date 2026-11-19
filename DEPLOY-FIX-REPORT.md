# Tiên Lộ — Chẩn đoán + sửa "không chơi được" trên live (2026-11-19)

- Live: https://tien-lo-24z6.onrender.com (Render service `tien-lo`, Free, Singapore)
- Repo: traxanhnet6/tien-lo, nhánh master
- Báo lỗi: Bui 21:18 — trang tải được, HUD hiện (Sơn Môn, nút Theo) nhưng nền
  xanh xám phẳng, không thấy đảo/map, không thấy nhân vật.

## Chẩn đoán (đọc từ trình duyệt thật + đĩa, không đoán)

1. Tái hiện đúng ảnh Bui gửi bằng driver CDP (Chrome 156, 390×844, qua relay):
   live-mobile.jpg = nền phẳng + HUD, giống hệt ảnh iPhone của Bui.
   (Dải tối mép phải có dấu "<" trong ảnh Bui KHÔNG có trong ảnh driver —
   đó là nút quay lại của trình duyệt trong app, không phải của game.)
2. Trạng thái live lúc đó: `TL2.ready() = false` sau 30s, `window.__err = null`
   (init KHÔNG lỗi), canvas 300×150 mặc định (resize chưa chạy), 0 zone chip,
   lỗi mạng duy nhất là 404 favicon.ico. Không thiếu file nào.
3. Kiểm toàn bộ file init() tải: 0 file thiếu trên đĩa và trong git
   (40 file sprite đảo + 15 file lõi). Server Render trả file lớn nhanh
   (ground.jpg 3,1 MB trong 2s; stage_ab.png 15,8 MB trong 2,3s qua relay).
4. Probe dài (90s): live CUỐI CÙNG ready=true, map + nhân vật + NPC hiện đủ.
   Kết luận: game không hỏng — `init()` tải 55 MB / 58 file mà KHÔNG CÓ BÁO
   HIỆU GÌ, màn hình giữ màu nền `#9db8c4` suốt lúc tải. Vòng sprite chạy
   tuần tự từng file (47 file `await` nối nhau); qua đường chậm phải 60–90s
   mới sẵn sàng. Bui mở lên thấy màn hình trống nên kết luận không chơi được.
5. Vết thứ hai (tìm ra khi kiểm lại sau đợt sửa 1): `Gameplay.init()` còn
   `await` 2 bảng boss 13 + 9 MB (= 22 MB) TRƯỚC KHI ẩn màn hình chờ và chạy
   vòng lặp — giữ màn hình chờ ở ~95% thêm cả chục giây sau khi thế giới đã
   sẵn sàng. `drawActor` đã có đường lui về `o.img` khi bảng chưa tải xong
   nên việc chờ này là thừa.

## Đợt sửa 1 — commit 6d0808a (đã live)

- `index.html` + `css/style.css`: màn hình chờ `#loading` trong HTML tĩnh
  (hiện ngay từ frame đầu): tên game + thanh tiến độ + dòng trạng thái.
- `js/main.js` (`init`): đếm đủ tổng số file trước (nav + obj + 9 file lô
  đầu + 47 sprite), cập nhật thanh tiến độ theo từng file; vòng sprite và
  split/actor chạy song song bằng `Promise.all` (giữ nguyên thứ tự actor);
  ẩn màn hình chờ khi sẵn sàng; lỗi tải hiện chữ lên màn hình chờ thay vì
  im lặng (không bao giờ còn màn hình trống không lời giải thích).
- `js/gameplay.js` (`loadSkillPacks`): 10 pack kỹ năng (~70 MB) tải song
  song thay vì tuần tự; mỗi pack vẫn lỗi mềm riêng.

## Đợt sửa 2 — commit 3deffc1 (đã live)

- `js/gameplay.js` (`Gameplay.init`): 2 bảng boss + 1 bảng quái (22 MB)
  chỉ hâm nóng nền (fire-and-forget), không `await` nữa.

## Kiểm chứng

- Local (cây đã sửa, cổng 18917): ready 1–2s (trước sửa: chờ cố định 12s
  chưa đo chính xác); màn hình chờ ẩn ngay sau ready, canvas ~300 màu
  (đang vẽ); tap-to-move đi được (2200,2470 → 2248,2459, đang đi);
  WASD/manual input đi được (→ 2245,2450); 0 page error; 404 duy nhất là
  favicon.ico (tiền tồn, vô hại).
- Live sau đợt sửa 1 (mobile 390×844, qua relay chậm): ready 36s (trước
  sửa ~90s); màn hình chờ hiện đúng ở giây thứ 2 (thanh 10%, "Đang tải
  đảo và nhân vật…"); tới 95% thì dừng ở "Đang tải vật thể trên đảo…" —
  chính là vết thứ hai (đợt sửa 2 xử lý).
- Live sau đợt sửa 2: deploy 3deffc1 đẩy lên master nhưng sau ~8 phút
  Render vẫn đang phục vụ bản 6d0808a (đã đối chiếu trực tiếp file
  gameplay.js trên live: có marker tải song song, chưa có marker hâm
  nóng boss). Service vẫn chạy bình thường (index 200). Đã đẩy thêm
  commit chứa chính báo cáo này để kích hoạt lại webhook deploy; đang
  chờ Render triển khai bản mới rồi kiểm lại (màn hình chờ phải ẩn ngay
  sau ready + di chuyển được trên live).

## Trạng thái cuối

- (Cập nhật sau khi kiểm live đợt 2 xong.)
