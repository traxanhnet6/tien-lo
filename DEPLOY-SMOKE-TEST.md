# DEPLOY SMOKE TEST — Tiên Lộ GD3 (local, trước khi lên Render)

Ngày kiểm: 2026-11-19 ~20:59 +07 (log server 13:59 UTC). Cây: `~/workspace/game-tien-lo-gd3/` (605 MB, chưa phải git repo).
Chỉ kiểm local — không push, không deploy, không sửa file game nào.

## 1. Node

- Lệnh: `node --version`
- Kết quả: **v24.22.1** — ĐẠT (cần >= 18 cho ESM + WebSocket server này).

## 2. Server local (cổng thử riêng 18917)

- Lệnh: `cd ~/workspace/game-tien-lo-gd3 && TL_PORT=18917 node server/server.mjs` (chạy nền)
- Log boot: `2026-11-19T13:59:19.201Z [BOOT] Tiên Lộ GD3 server on http://127.0.0.1:18917 (HTTP+WS)` — ĐẠT.

### HTTP

| Kiểm tra | Kết quả |
|---|---|
| `GET /` | **200**, nội dung có `TIÊN LỘ`, có tham chiếu `game_data.js` |
| `GET /js/game_data.js` | **200** |
| `GET /js/gameplay.js` | **200** |
| `GET /js/net.js` | **200** |
| `GET /js/main.js` | **200** |
| `GET /assets/ground.jpg` | **200** |
| `GET /data/island/Map_Objects.json` | **200** |
| `GET /css/style.css` | **200** |
| `GET /khong-co-file-nay.xyz` | **404** (đúng — file không có trả 404) |

### WebSocket handshake

- Cách kiểm: script node thuần dùng `node:net` + `node:crypto` (không cài package mới), gửi `Upgrade: websocket` với `Sec-WebSocket-Key` tự sinh tới `/`, đối chiếu `Sec-WebSocket-Accept` tính theo RFC 6455.
- Kết quả: **`HTTP/1.1 101 Switching Protocols`, `Sec-WebSocket-Accept` khớp giá trị kỳ vọng** — ĐẠT.

## 3. GitHub CLI

- Lệnh: `gh auth status`
- Kết quả: **CHƯA đăng nhập** — `You are not logged into any GitHub hosts. To log in, run: gh auth login` (exit 1).
- Hệ quả: **không tạo repo / push qua `gh` được** cho tới khi đăng nhập (cần Bui làm trên trình duyệt hoặc cấp quyền). Tạo repo qua API cũng cần token — chưa có.

## 4. Dọn dẹp

- Server thử đã tắt: tiến trình node thật là PID 32579 (lưu ý: `$!` lúc chạy nền báo 32577 là shell bọc ngoài, không phải tiến trình node — đã xác minh bằng `ss -ltnp` rồi kill đúng PID 32579).
- Sau khi tắt: cổng 18917 đóng (curl trả 000, connection refused), không còn tiến trình `server.mjs`.
- File tạm `/tmp/tl-root.html`, `/tmp/tl-ws-test.mjs`, `/tmp/tl-smoke-18917.log` đã xóa.

## Chưa kiểm

- **Chơi thật trên trình duyệt** (load game, vào map, combat online `?online`): chỉ kiểm tới mức handshake WS, chưa kiểm trao đổi frame WS / join / cast.
- **Render deploy**: chưa có repo GitHub (gh chưa đăng nhập), chưa tạo service Render.
- **Cổng mặc định 8917**: chỉ chạy thử ở 18917 để tránh đụng cổng; server đọc `TL_PORT` đúng như mô tả.
- **Hiệu năng / tải**: không kiểm.
