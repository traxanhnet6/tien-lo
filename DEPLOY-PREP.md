# DEPLOY-PREP — Tiên Lộ GD3 lên GitHub + Render

Ngày: 2026-11-19 ~21:00 +07. Trạng thái: **chuẩn bị repo xong, đã commit local — CHƯA push, CHƯA tạo remote, CHƯA deploy.**

## Đã làm

1. **Kiểm tra Tien_Lo/Boss (86 MB)** — Runtime (`js/`, `data/`, `index.html`, `server/`) KHÔNG tham chiếu `Tien_Lo`. Chỉ có tool sản xuất tham chiếu (`tools/build_fire_realm_assets.py`, `tools/run_all_checks.mjs`): tư liệu boss 002 Xích Viêm Ma Quân, 216 khung (8 hướng × 5 bộ), trạng thái CHƯA NGHIỆM THU. File lớn nhất trong đó 9,3 MB — dưới giới hạn 100 MB/file của GitHub. **Giữ trong repo** (hồ sơ dự án).
2. **Kiểm tra docs/standards (71 MB, 7 file)** — file lớn nhất 22,8 MB (`Tien-Lo-Art-Bible-1.0.pdf`); không file nào >100 MB. Giữ nguyên.
3. **Sửa cổng server** — `server/server.mjs` dòng 37: `process.env.TL_PORT || 8917` → `process.env.PORT || process.env.TL_PORT || 8917` (Render cấp `PORT`). Chỉ sửa đúng dòng này + comment. `node --check` đạt.
4. **`.gitignore`** — loại `proof/` toàn bộ (245 MB, gồm cache Chrome 69 MB), `wtest2.txt`, `*.log`, file tạm (`*.tmp`, `*~`, `*.bak`, `*.swp`), `node_modules/`. Giữ `index.html`, `css/`, `js/`, `assets/`, `data/`, `server/`, `docs/`, `tools/`, `Tien_Lo/`.
5. **`package.json`** — name `tien-lo`, `"type": "module"` (server dùng ESM `import`), script `start: node server/server.mjs`, engines node `>=18`, KHÔNG dependency.
6. **`render.yaml`** — 1 web service Node, plan free, region singapore, `buildCommand: ""` (không dependency), `startCommand: npm start`, `healthCheckPath: /`. Không cần envVars (server đã fallback `PORT`).
7. **Git init + commit local** — 2 commit, cây sạch:
   - `7e13437` "Tien Lo GD3: client web iso 2:1 + server Node authoritative combat (Bui duyet dua len Render)" — 684 file.
   - `bfde1b0` "Them bao cao smoke test local truoc khi len Render" — thêm `DEPLOY-SMOKE-TEST.md`.
   - Commit này: `DEPLOY-PREP.md`.
8. **Smoke test local** (xem `DEPLOY-SMOKE-TEST.md`) — Node v24.22.1; server chạy thử cổng 18917: `GET /` 200, các file js/css/data/assets 200, 404 đúng cho file không có, WS handshake 101 + `Sec-WebSocket-Accept` khớp RFC 6455. Server thử đã tắt, file tạm `/tmp` đã xóa.

## Dung lượng

- Cây làm việc: 605 MB (gồm `proof/` 245 MB + `.git` 304 MB).
- **Repo sau khi loại proof/: 685 file, 357,9 MB** (tính theo kích thước file; `.git` 304 MB do nén).
- Đã loại: `proof/` 245 MB (0 file trong staged), mọi `*.log` (0 file trong staged). Không file nào >100 MB trong repo.

## Còn vấn đề trước khi push

1. **Chưa có remote / chưa đăng nhập GitHub** — `gh auth status`: chưa đăng nhập (`gh` không tạo repo/push được). Cần Bui đăng nhập `gh` trên trình duyệt hoặc cấp token, rồi mới tạo repo + push. (Ghi theo `DEPLOY-SMOKE-TEST.md` §3.)
2. **Chưa kiểm chơi thật trên trình duyệt** — smoke test chỉ tới mức handshake WS; chưa kiểm trao đổi frame WS / join / cast / combat online `?online`.
3. **Repo 358 MB là nặng cho lần push đầu** (chủ yếu `Tien_Lo/` 86 MB + `docs/` 71 MB + assets). Nếu push chậm/lỗi, phương án dự phòng: tách `Tien_Lo/` + `docs/standards/` PDF lớn ra khỏi repo chính (giữ local), chỉ push code + assets game. **Chưa làm — chờ parent/Bui quyết.**
4. **Chưa tạo service Render** — cần repo GitHub trước (hoặc deploy từ repo sau khi push).
5. **Chưa kiểm hiệu năng / tải** trên Render free.

## Không đụng tới

Cây deploy Ngũ Hành live, cây costumes, thư viện shadiao. Không mua gì. Không sửa logic game/server ngoài dòng PORT.
