# Tiên Lộ — Báo cáo triển khai (deploy)

- Game: Tiên Lộ — Thanh Vân Tiên Môn đủ 8 khu (đẳng cự 2:1), bản GD3
  (client web + server Node authoritative combat, HTTP + WebSocket cùng cổng).
- Repo: https://github.com/traxanhnet6/tien-lo (public), nhánh master.
- Render: service `tien-lo`, plan Free, region Singapore, Blueprint từ
  `render.yaml` (env node, buildCommand rỗng, startCommand `npm start`,
  healthCheckPath `/`).
- **URL live: https://tien-lo-24z6.onrender.com** (Render gán hậu tố -24z6
  vì tien-lo.onrender.com đã có người dùng).
- Deploy đầu: 21:11 ngày 2026-11-19, commit 524f6d4, 1m14s, Service ID
  srv-dbvg5cl6e07s73bnmf60.

## Lịch sử sau deploy đầu

- 21:18 2026-11-19 — Bui báo "Không chơi được" (màn hình trống, chỉ có HUD).
  Chẩn đoán + sửa xem [DEPLOY-FIX-REPORT.md](DEPLOY-FIX-REPORT.md).
- 21:30 2026-11-19 — commit 6d0808a (màn hình chờ có tiến độ + tải song
  song asset) lên live. Kiểm lại bằng trình duyệt thật: chơi được.
- 21:31 2026-11-19 — commit 3deffc1 (bảng boss tải nền) + 57580e6 (báo cáo).
  Tới 21:42 Render vẫn đang phục vụ bản 6d0808a (đối chiếu trực tiếp file
  gameplay.js trên live) — deploy bản mới chưa lên sau ~11 phút, cần kiểm
  trạng thái deploy trên dashboard Render (xem DEPLOY-FIX-REPORT.md §
  "Trạng thái cuối"). Bản 6d0808a đang chạy đã chơi được đầy đủ nên đây
  chỉ là phần hoàn thiện tải, không chặn chơi.

## Trạng thái cuối (kiểm bằng trình duyệt thật, 21:42–21:44 ngày 2026-11-19)

- Mobile 390×844: ready sau 23–40s qua đường relay chậm (trên 5G thật sẽ
  nhanh hơn nhiều); màn hình chờ ẩn ngay sau ready; map + nhân vật + NPC
  hiện; tap-to-move và WASD/manual input đều đi được; 0 page error.
- Desktop 1280×800: ready 37s qua relay; map + nhân vật + NPC + HUD đầy đủ.
- Lỗi duy nhất: 404 favicon.ico (tiền tồn, vô hại — game không có favicon).

## Lưu ý vận hành

- Gói Free ngủ khi không dùng — lần mở đầu sau thời gian dài im lặng có
  thể chậm 50 giây trở lên (giống Vô Sắc). Lần tải đầu tiên tải ~55 MB
  asset (+ ~70 MB pack kỹ năng nền), nên lần đầu vẫn cần chờ màn hình
  "Đang tải…" chạy xong; các lần sau trình duyệt cache lại sẽ nhanh hơn.
- Chưa kiểm chơi thật `?online` (WebSocket multiplayer) trên live.
