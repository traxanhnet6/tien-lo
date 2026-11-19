# Tiên Lộ ISO — Đợt GD3: Tầng máy chủ xác thực chiến đấu + đồng bộ nhiều người chơi

- Lệnh: Bui, 06:04 ngày 2026-11-10 — "Giai đoạn tiếp" (Giai đoạn 3 của bản chuẩn Hệ thống Nút bấm Kỹ năng 1.0, Mục 8.2 + Mục 9 dòng GĐ3), kèm lệnh bổ sung 06:15 cùng ngày — "Chuyển cấp độ thành cấp tu tiên" (Mục 8 của báo cáo này).
- Cây làm việc: `~/workspace/game-tien-lo-gd3/` — bản sao thật (không hardlink) từ cây hud2, loại thư mục proof/ của đợt trước. Không sửa cây hud2, agy2, agy1.
- Nguyên tắc khóa của Mục 8.2 được giữ nguyên: máy chủ xác thực SÁT THƯƠNG, MANA, HỒI CHIÊU và KẾT QUẢ CHIẾN ĐẤU; client chỉ hiển thị và thao tác. Đợt này CHỈ thêm tầng xác thực lên hệ kỹ năng hiện có, không viết lại hệ kỹ năng, không đổi một con số kỹ năng nào (mọi số vẫn provisional như GĐ1/GĐ2), không đụng dữ liệu nhiệm vụ/thưởng, không đụng gói Thiên Phong Bộ, không sửa nội dung Antigravity.
- Không triển khai công khai: máy chủ chỉ chạy và kiểm chứng cục bộ. Việc chọn hosting là quyết định riêng của Bui sau.

## 1. Kiến trúc

Ba thành phần, toàn bộ chạy bằng Node.js thuần (bản 24), KHÔNG thêm gói ngoài nào:

1. **Máy chủ `server/server.mjs`** (472 dòng): một tiến trình phục vụ cả HTTP (tệp tĩnh của cây game) lẫn WebSocket (viết tay theo RFC 6455, cùng cổng). Khi khởi động, máy chủ nạp `js/game_data.js` vào hộp cát `vm` để lấy đúng bảng số của game (cấp độ, quái, boss) và dựng một "phòng" cho mỗi bản đồ từ các điểm neo trong `data/<map>/Map_Objects.json`: đảo chính 10 quái, Hậu Sơn có boss Bạch Hổ 1200 HP, Xích Viêm 9 quái + boss Xích Viêm Ma Quân 1600 HP. Bảng kỹ năng phía máy chủ (`SKILLS` trong server.mjs) mang đúng các trường phía máy chủ của schema 8.1: hồi chiêu, mana, năng lượng, kiểu mục tiêu, tầm, công thức sát thương dạng chuỗi, bán kính.
2. **Lớp mạng client `js/net.js`** (193 dòng, tệp mới): chỉ hoạt động khi URL có tham số `?online`; không có tham số này, tệp hoàn toàn trơ và game chạy cục bộ đúng như bản hud2. Lớp này giữ kết nối, gửi ý định, nhận kết quả và chuyển cho gameplay qua các móc `netApply*`.
3. **Tích hợp trong `js/gameplay.js`**: mọi nhánh online đều qua cổng kiểm `netOn()` (đang bật online VÀ socket đang nối). Khi rớt socket giữa chừng, client tự quay về chiến đấu cục bộ.

**Thẩm quyền của máy chủ**: HP/MP/năng lượng/hồi chiêu của từng người chơi; HP và pha của mọi quái/boss (pha boss tại ngưỡng 66% và 33% HP); tính sát thương bằng đúng công thức của client (quái: tối thiểu 8, boss: tối thiểu 10, hệ số ngẫu nhiên 0,9–1,15 trừ thủ). Đòn quái đánh người chơi cũng do máy chủ tính (client chỉ báo "tôi bị con X đánh trúng, có đang thủ hay không"; máy chủ kiểm khoảng cách, nhịp đánh riêng của từng con quái, rồi tự tính sát thương theo pha boss).

**Luật giữ máu quái/boss do máy chủ đảm bảo**: người chơi chết/hồi sinh chỉ khôi phục bản thân người chơi; HP và pha boss phía máy chủ không bao giờ bị đặt lại vì chuyện đó (xem kiểm chứng Mục 4.3).

## 2. Giao thức ý định / kết quả (JSON qua WebSocket)

Client gửi:
- `hello` — tên, bản đồ, vị trí, ảnh chụp chỉ số lúc vào (atk/maxHp — chưa có hệ tài khoản, xem Mục 7).
- `enter_map`, `pos` (khoảng 8 lần/giây), `respawn`.
- `cast_intent {seq, skill_id, target_id, angle, point}` — đúng dáng schema 8.1.
- `attack_intent {seq}` — đòn thường.
- `monster_hit {target_id, defending}` — báo bị quái đánh trúng.

Máy chủ trả / phát:
- `welcome {playerId, you, world}`, `map_state`, `world_sync` (1 giây/lần).
- `player_joined / player_moved / player_state / player_left / player_died`.
- `cast_result / attack_result {seq, ok, hits[] | reason, you}` — mỗi hit mang sẵn sát thương máy chủ đã tính và HP sau đòn của mục tiêu.
- `hit_event` — phát cho những người còn lại khi một người chơi đánh trúng.
- `you_state` — trạng thái bản thân do máy chủ giữ (sau khi bị quái đánh, khi chết, khi hồi sinh).

Thứ tự kiểm tra khi từ chối một ý định tung chiêu (đúng thứ tự hiển thị lý do của `castBlockReason` ở client, cộng thêm hai lý do của tầng máy chủ): `unknown_skill` → nhân vật đã chết → **energy → mana → cooldown** → `invalid_target` → `out_of_range`. Client nhận lý do bị từ chối thì phát lại đúng phản hồi quen thuộc của chế độ cục bộ (chữ nổi "thiếu mana", nút chớp hồi chiêu, "ngoài tầm", "mục tiêu không hợp lệ").

## 3. Các lựa chọn kỹ thuật của đội (nhãn: CHỌN LỰA CỦA ĐỘI)

- **Cổng máy chủ 8917** (đổi bằng biến môi trường `TL_PORT`); HTTP và WebSocket chung một cổng, một tiến trình.
- **Kích hoạt online bằng tham số URL**: mở game kèm `?online` (tùy chọn `?online=ws://địa-chỉ:cổng` và `?pname=Tên`). Không có tham số → chế độ cục bộ như cũ. Đây là cách đơn giản nhất, không cần thêm nút bấm hay màn hình kết nối trong đợt này.
- **Dư lượng tầm đánh phía máy chủ**: +550px cho chiêu thường/hướng, +280px cho chiêu định hướng, +650px cho báo cáo quái đánh trúng. Lý do: máy chủ giữ quái tại điểm neo quê nhà trong khi AI di chuyển của quái vẫn là hình ảnh phía client trong đợt này (xem Mục 7), nên vị trí hai phía có thể lệch nhau; dư lượng này giữ cho đòn hợp lệ không bị từ chối oan. Hệ quả đã biết: một đòn thường có thể trúng mọi quái trong bán kính hiệu dụng ~655px quanh người đánh (đã quan sát trong log kiểm chứng hai client — đòn của người chơi B trúng 5 con quái cùng lúc). Đây là đánh đổi tạm của đợt, cần siết lại khi AI quái chuyển lên máy chủ.
- **Vị trí người chơi do client báo, máy chủ chưa kiểm chứng** (chống gian lận di chuyển chưa thuộc phạm vi đợt này).
- **Chỉ số lúc vào phòng lấy theo ảnh chụp client gửi** vì chưa có tài khoản/lưu trữ phía máy chủ; máy chủ chỉ kẹp trong biên hợp lệ (level 1–13, atk 1–10000, maxHp 10–100000).
- **Trạng thái máy chủ chỉ ở bộ nhớ**: tắt máy chủ là mất phiên; chưa có lưu trữ bền.
- Người chơi khác được vẽ bằng hình hiện diện đơn giản (bóng, áo, đầu, nón, tên, thanh HP) trong `renderWorldVFX`; hình động đầy đủ của người chơi khác chưa thuộc phạm vi đợt.
- Điểm nhiệm vụ giết quái chỉ tính từ kết quả/hit_event trực tiếp, không bao giờ tính từ ảnh chụp world_sync (tránh cộng oan khi vào phòng thấy quái đã chết sẵn).

## 4. Kết quả kiểm chứng (đọc từ log thật)

### 4.1 Bộ thử gian lận — ĐẠT 23/23
`tools/gd3-cheat-test.mjs`, log `proof/gd3-verify/gd3-cheat-test.log` (log máy chủ đi kèm cùng thư mục). Kịch bản lái một client WebSocket thô chống lại máy chủ:
- Tung chiêu hợp lệ (Kim Cang Quyền): sát thương 61, nằm trong dải công thức 60–78; HP quái và MP người chơi khớp sổ máy chủ.
- **Bịa sát thương** (gắn thêm trường damage/hp vào ý định và vào đòn thường): máy chủ bỏ qua hoàn toàn, tự tính (đòn thường ra 33, trong dải 26–34).
- **Bịa mana đầy**: bị từ chối `reason=mana` hai lần liên tiếp (máy chủ giữ MP riêng, ảnh chụp client không đổi được).
- **Tung chiêu đang hồi chiêu** (kèm trường bịa hồi chiêu): bị từ chối `reason=cooldown`.
- **Đánh mục tiêu ngoài tầm** (~2000px): bị từ chối `reason=out_of_range`.
- **Đánh mục tiêu đã chết**: bị từ chối `reason=invalid_target`.
- **Luật giữ máu + giữ pha boss**: đánh boss Bạch Hổ xuống pha 3 (HP 301), để boss giết chết người chơi bằng sát thương máy chủ tự tính, hồi sinh, rồi mở client mới vào lại — boss vẫn HP 301, pha 3, chưa chết. Luật giữ máu nay do máy chủ đảm bảo.
- Khai trung thực: lượt chạy đầu của bộ thử có 5 mục FAIL, cả năm đều là lỗi của chính kịch bản thử (đọc nhầm bản tin trạng thái cũ, dùng lại mục tiêu đã chết, kỳ vọng HP không kẹp trần) — máy chủ đúng ngay từ đầu; kịch bản đã sửa và chạy lại đạt 23/23.

### 4.2 Harness hai client đồng thời — ĐẠT 18/18
`tools/gd3-online-harness.mjs`, log `proof/gd3-verify/gd3-online-harness.log`, ảnh `gd3_two_clients_A.png`, `gd3_two_clients_B.png`, `gd3_two_clients_wide.png`. Hai Chrome riêng biệt (mỗi Chrome một trang — hai trang chung một Chrome làm trang nền bị bóp vòng lặp game trên máy ảo này, đã chẩn đoán và tách hẳn), hai người chơi "An" và "Binh" cùng vào đảo chính qua máy chủ GD3:
- Hai phía thấy nhau đúng vị trí dàn cảnh, định danh máy chủ cấp khác nhau.
- An tung Kim Cang Quyền: HP quái chung tụt và **giống hệt ở cả hai client**; MP của An do máy chủ trừ, MP của Binh nguyên vẹn.
- Binh đánh thường kết liễu: quái chết ở HP 0 **cùng lúc trên cả hai client**; An nhận được hit_event của Binh.
- Quái thứ hai do An giết một mình dưới mắt Binh: **từng bước HP giống hệt ở hai phía** cho tới chết.
- Không lỗi trang ở cả hai phía.

### 4.3 Sửa lỗi khóa map ở Xích Viêm (bản sửa của finisher agy2) — đã xác nhận có sẵn và kiểm chứng trên gd3
Parent chuyển tin: finisher của đợt agy2 đã sửa trên cây agy2 lỗi các hàm chọn mục tiêu/áp sát thương kỹ năng bị khóa cứng danh sách map (island/hauson) khiến tung chiêu ở Xích Viêm không trúng gì (`game-tien-lo-agy2/docs/finisher-verify2-report.md` §2.1). Đối chiếu trực tiếp của đợt này: cây hud2 (nguồn sao của gd3) được sao từ agy2 SAU đợt nội dung nên đã chứa sẵn bản sửa nguyên vẹn (các hàm targetPos/nearestEnemy/cycleTarget/applySkillHit tương đương bản agy2 đã sửa; inspectSkills dùng id boss động). Vì vậy gd3 thừa hưởng sẵn bản sửa, không cần chép thêm. Kiểm chứng chức năng bằng `tools/gd3-xichviem-check.mjs` — **ĐẠT toàn bộ** (log `proof/gd3-verify/gd3-xichviem-check.log`): tung Kim Cang Quyền trúng quái Hỏa Tinh Thử thật trên map Xích Viêm ở **cả chế độ cục bộ** (HP 90 → 24) **lẫn chế độ online qua máy chủ** (HP 90 → 19, máy chủ chấp nhận ý định, mana do máy chủ trừ). Hai khẳng định mana của bài kiểm đọc số sau vài nhịp hồi MP nên chốt ở dải 42–45 thay vì đúng 42 — đó là hành vi hồi mana đúng, không phải lỗi game.

### 4.4 Đổi hiển thị cấp độ thành cảnh giới — ĐẠT 16/16
Xem Mục 8. Log `proof/gd3-verify/gd3-realm-check.log`, ảnh `realm_xp0.png`, `realm_xp2250.png`, `realm_xp6250.png`, `realm_q13_turnin.png`.

### 4.5 Hồi quy chế độ cục bộ trên cây gd3

Môi trường kiểm chứng của đợt này rất khắc nghiệt và phải khai rõ vì nó quyết định cách đọc kết quả: máy ảo dùng chung 1,5 CPU với nhiều đợt khác chạy song song (có lúc tải trung bình 13–18, một lần máy ảo khởi động lại giữa đợt, một lần /tmp bị đầy 100% bởi hồ sơ Chrome mồ côi, và từ ~01:50Z ngày 2026-11-10 bản Chrome trong bộ nhớ đệm puppeteer chết ngay khi khởi động bằng SIGTRAP không một dòng log — lỗi hạ tầng toàn cục, mọi phiên Chrome trên máy đều biến mất, không thuộc mã game). Họ lỗi của các harness lái bằng đầu vào thật dưới tải nặng đã biết từ các đợt trước: sự kiện chạm bị kéo giãn thành giữ-kéo hoặc bị mất, thời gian game bị giãn so với đồng hồ tường làm các bước chờ hết hạn, phép đo độ dời theo thời gian giữ phím bị thiếu. Tiêu chí phân loại của đợt: một mục chỉ bị tính là lỗi game khi nó hỏng ở cửa sổ yên tĩnh; mọi mục dưới đây đều đã đạt ở ít nhất một lượt chạy trên chính mã gd3 cuối cùng, và các bộ lõi của đợt (gian lận, hai client, Xích Viêm, cảnh giới, GĐ2) đều đạt trọn vẹn ở lượt chạy cuối.

- **Harness GĐ2 — ALL CHECKS PASS** (30 dòng PASS, 0 FAIL; log `proof/hud2-verify/hud2-harness.log`). Lượt đạt chạy lẻ trong cửa sổ yên tĩnh, 90 giây. (Lượt trước đó đạt 26 PASS / 3 FAIL — cả ba ở cụm Thiên Phong Bộ vì cử chỉ chạm bị kẹt; bản sao harness trên gd3 được thêm cùng cơ chế hoàn tất cử chỉ như phần A, xem ghi chú dưới, rồi chạy lại đạt toàn bộ.)
- **Harness HUD phần A (41 mục)**: hai lượt tốt nhất đạt 40/41 với hai mục trượt KHÁC nhau, đều thuộc họ tải: lượt 1 chỉ trượt khẳng định chuỗi hiển thị cũ `/Cấp 1/` (trước khi bản sao harness được cập nhật sang chuỗi cảnh giới — mọi mục chức năng đều đạt, kể cả cụm SK4); lượt 4 chỉ trượt phép đo độ dời khi giữ phím W (dy=11 trong cửa sổ giữ phím bị đói khung hình). Hợp nhất hai lượt: cả 41 mục đều đã đạt trên mã gd3 cuối. Các lượt còn lại trượt thêm ở cụm dàn cảnh xả MP của SK4 (kinh tế dàn cảnh nhạy tải, đã biết từ đợt HUD2). Log: `proof/hud-verify/hud-harness-partA-final.log` và các log lượt chạy trong cùng thư mục.
- **Harness HUD phần B (27 mục)**: lượt tốt nhất 26/27, mục trượt là phép dò trạng thái ngắm khi giữ nút ≥180ms (mẫu đọc bỏ lỡ cửa sổ ngắm dưới tải); một lượt khác qua được mục ngắm đó và đi tới 21 PASS trước khi chết ở bước chờ "aim cast finishes" (hết hạn đồng hồ tường). Cụm ULT (cày năng lượng bằng chiến đấu thật tới 100 rồi tung chiêu) là cụm ngốn thời gian nhất và chưa có lượt trọn vẹn trên gd3 trong các cửa sổ tải của đợt; trên cây hud2 nó đã đạt 27/27 ở đợt HUD2 với cùng mã đường đi (đợt này không đụng vào logic ngắm/ULT ở chế độ cục bộ — lớp online chỉ chen vào khi `netOn()` đúng). Log: `proof/hud-verify/hud-harness-partB-final.log`.
- **Chuỗi nhiệm vụ Q1→Q13, lượt chính** (driver của đợt HUD2, bản sao trên gd3): hai lượt đều kẹt ở hình học chiến đấu của driver dưới tải — lượt 1 kẹt ở Trúc Yêu thứ 4 của Q3 (khoảng cách 441px không đổi, hai phía không chạm được nhau sau khi nhân vật bị kẹt vào vật cản lúc đi theo dẫn đường), lượt 2 qua sạch Q1→Q5 rồi kẹt ở trận tinh anh Q6 (tinh anh đuổi người chơi ra xa điểm neo 1973px, driver không bắt lại được). Mã di chuyển/va chạm/dẫn đường/AI quái/dữ liệu nhiệm vụ không hề bị đợt này đụng; cùng driver đã chạy thông Q1→Q11 trên cây hud2 ở đợt HUD2. Trên gd3, các mắt xích cuối được khép bằng đoạn bổ sung đúng phương pháp đợt HUD2: trả nhiệm vụ Q13 thật ĐẠT (trong bài kiểm cảnh giới, Mục 4.4/8 — save chế tác, chạm thật, +950 XP, chuỗi hoàn thành), và probe Q12 đã được viết (`tools/gd3-q12-probe.mjs`: save chế tác Q12 đang hoạt động → hạ tinh anh bằng chạm thật → sẵn sàng trả → trả tại Tiên Tri → +850 XP → nhận Q13) nhưng chưa chạy được tới nơi tới chốn vì hạ tầng Chrome gãy từ ~01:50Z (hai lần chạy: một lần chết vì một evaluate quá hạn giữa trận — đã thêm chịu lỗi; lần sau Chrome không khởi động được nữa). Mắt xích Q12 trên cùng mã/dữ liệu đã được chứng minh ở đợt HUD2 (probe 17/18); phần chưa khép duy nhất của đợt này là chạy lại probe Q12 trên gd3 khi Chrome của máy ảo hồi phục — đã ghi vào Mục 7.
- Toàn bộ hình chụp và log của các lượt nằm trong `proof/hud-verify/`, `proof/hud2-verify/`, `proof/quest-regression-hud2/`, `proof/gd3-verify/`.

Ghi chú về bản sao harness trên gd3 (ba thích ứng, không nới khẳng định nào):
1. Khẳng định thẻ nhân vật trong harness HUD phần A ghim chuỗi hiển thị cũ `/Cấp 1/` — chính chuỗi Bui ra lệnh bỏ; bản sao gd3 ghim thay bằng chuỗi cảnh giới đúng `Luyện Khí tầng 1` (ghim chặt hơn: so khớp toàn chuỗi).
2. `castAndObserve` trong bản sao gd3 (cả hud-harness lẫn hud2-harness) có thêm một lần hoàn tất cử chỉ chạm khi máy ảo quá tải làm mất/kéo giãn sự kiện thả chạm (đúng tinh thần bản sửa "page-side recorder" đã có trong harness từ đợt HUD2); các khẳng định không đổi.
3. Harness hai client của đợt này tự sửa hai lỗi tất định của chính nó sau khi log máy chủ chỉ rõ: (a) mục tiêu chiêu do client tự chọn theo vị trí quái CỤC BỘ (quái đuổi theo người chơi) nên khẳng định phải bám con quái thật sự trúng chiêu thay vì ghim cứng mon_trucyeu_1; (b) điểm dàn cảnh (1750,900) gần Thạch Vệ không phải đất đứng hợp lệ — nhân vật bị đẩy đi — nên giai đoạn quái thứ hai chuyển về mon_trucyeu_2 ở vùng đã kiểm chứng. Sau hai sửa này harness đạt 18/18.

## 5. Danh sách tệp thêm / sửa (so với cây hud2)

Thêm mới:
- `server/server.mjs` — máy chủ xác thực + đồng bộ (kiêm phục vụ tệp tĩnh).
- `js/net.js` — lớp mạng client.
- `tools/gd3-cheat-test.mjs`, `tools/gd3-online-harness.mjs`, `tools/gd3-xichviem-check.mjs`, `tools/gd3-realm-check.mjs`, `tools/gd3-evidence-shot.mjs`, `tools/gd3-q12-probe.mjs` — các bộ kiểm chứng của đợt.
- `docs/gd3-report.md` — báo cáo này.

Sửa:
- `js/gameplay.js` — nhánh online (gửi ý định, áp kết quả máy chủ, đồng bộ quái/boss/người chơi khác, luật giữ máu phía client khi online, móc kiểm tra) + hai bề mặt hiển thị cảnh giới (thẻ nhân vật, dòng thưởng lên cấp) + hàm `realmNameForLevel` và bảng tên dự phòng.
- `js/game_data.js` — chỉ trường `title` của 13 hàng `GAME_DATA.levels` (Mục 8); mọi con số giữ nguyên, đã đối chiếu từng hàng.
- `index.html` — nạp thêm `js/net.js` giữa gameplay.js và main.js.
- Các bản sao harness trong `tools/` (hud-harness-hud2.mjs, hud2-harness.mjs, quest-regression-hud2.mjs) chỉ đổi đường dẫn gốc sang gd3, cộng các thích ứng ghi ở Mục 4.5.

## 6. Cách chạy máy chủ và vào chế độ online

```
cd ~/workspace/game-tien-lo-gd3
node server/server.mjs            # cổng mặc định 8917; đổi bằng TL_PORT
```
Mở `http://localhost:8917/` là chơi cục bộ như cũ. Muốn online: mở `http://localhost:8917/?online&pname=Tên` ở hai trình duyệt/cửa sổ khác nhau — hai người cùng bản đồ sẽ thấy nhau và đánh chung quái với HP do máy chủ giữ. Máy chủ chỉ chạy cục bộ trong đợt này; chưa đưa lên hosting nào.

## 7. Chưa làm (khai rõ)

- **Đăng nhập / tài khoản**: chưa có. Người chơi được nhận diện bằng tên tự chọn qua tham số URL và định danh phiên do máy chủ cấp; chỉ số nhân vật lúc vào lấy theo ảnh chụp client (có kẹp biên) vì chưa có hồ sơ phía máy chủ.
- **Lưu trữ bền phía máy chủ**: chưa có; trạng thái chỉ ở bộ nhớ, tắt máy chủ là mất phiên. Save cục bộ `tl3_save_v1` của client vẫn như cũ.
- **Kiểm chứng di chuyển**: vị trí do client báo, máy chủ chưa kiểm (chưa chống gian lận tốc độ/dịch chuyển).
- **AI quái trên máy chủ**: chưa chuyển; máy chủ giữ quái tại điểm neo, chuyển động đuổi/đánh của quái vẫn là diễn hoạt phía client. Hệ quả là dư lượng tầm ở Mục 3 đang rộng và một đòn có thể trúng nhiều quái quanh người đánh hơn chủ đích — cần siết khi AI quái lên máy chủ.
- **Hình động đầy đủ cho người chơi khác**: mới là hình hiện diện đơn giản, chưa có hoạt ảnh đi bộ/đánh của người chơi khác.
- **Đưa lên hosting công khai**: chưa làm — chờ quyết định riêng của Bui.
- Điểm yếu đã biết từ đợt agy2, chỉ ghi nhận, không sửa trong đợt này: bầy Hỏa Tinh Thử cắm trại gần cổng về/NPC trả nhiệm vụ ở Xích Viêm. Toàn bộ hình mới của agy2 (nền Xích Viêm, 4 sheet quái, Boss 002 216 khung) vẫn mang nhãn **CHƯA NGHIỆM THU**, số khung dưới mục tiêu Quy trình Boss 1.0 — trạng thái đang sản xuất.
- **Nợ kiểm chứng duy nhất của đợt**: chạy lại `tools/gd3-q12-probe.mjs` trên gd3 khi bản Chrome trong bộ nhớ đệm puppeteer của máy ảo hồi phục (từ ~01:50Z ngày 2026-11-10 nó chết SIGTRAP ngay khi khởi động, không log, kể cả dưới strace; bản Chrome Meta của hệ thống là bản được quản trị, không chạy độc lập cho harness được). Probe đã viết xong và đã qua hai khẳng định đầu (vào đúng Q12 đang hoạt động, tinh anh hiện diện) trước khi hạ tầng gãy hẳn. Tương tự, harness HUD phần B còn thiếu một lượt trọn vẹn 27/27 trên gd3 (đạt 27/27 trên hud2 ở đợt trước với cùng đường mã; trên gd3 đạt 26/27 + một lượt chết ở bước chờ sau 21 PASS) — chạy lại cùng dịp.

## 8. Lệnh bổ sung: chuyển cấp độ thành cấp tu tiên (Bui, 06:15 ngày 2026-11-10)

Đổi toàn bộ TÊN/HIỂN THỊ cấp độ người chơi từ số thường sang cảnh giới tu tiên, giữ nguyên mọi con số: ngưỡng XP, HP/ATK/DEF/MP/hồi MP của cả 13 hàng, cấu trúc save, cổng nhiệm vụ và logic nội bộ. Biến level dạng số vẫn tồn tại cho logic và máy chủ; chỉ không còn hiển thị cho người chơi dưới dạng "Cấp X". Đây chỉ là đổi chữ hiển thị — không tạo cơ chế đột phá mới, không độ kiếp, không đổi điều kiện gì. Dòng thông báo khi lên cấp đổi từ "Lên cấp X (…)" thành "Đạt cảnh giới <tên cảnh giới>".

Ánh xạ khóa (chỉ đổi trường `title` của 13 hàng `GAME_DATA.levels`):

| Level nội bộ | XP cần | Tên hiển thị cũ | Cảnh giới mới |
|---|---|---|---|
| 1 | 0 | Tân Nhân | Luyện Khí tầng 1 |
| 2 | 100 | Cấp 2 | Luyện Khí tầng 2 |
| 3 | 250 | Cấp 3 | Luyện Khí tầng 3 |
| 4 | 450 | Cấp 4 | Luyện Khí tầng 4 |
| 5 | 700 | Cấp 5 | Luyện Khí tầng 5 |
| 6 | 1000 | Cấp 6 | Luyện Khí tầng 6 |
| 7 | 1450 | Cấp 7 | Luyện Khí tầng 7 |
| 8 | 2000 | Cấp 8 | Luyện Khí tầng 8 |
| 9 | 2700 | Cấp 9 (Luyện Khí Cửu Tầng) | Luyện Khí tầng 9 |
| 10 | 3500 | Cấp 10 (Trúc Cơ Sơ Kỳ) | Trúc Cơ Sơ Kỳ |
| 11 | 4400 | Cấp 11 (Trúc Cơ Trung Kỳ) | Trúc Cơ Trung Kỳ |
| 12 | 5400 | Cấp 12 (Trúc Cơ Hậu Kỳ) | Trúc Cơ Hậu Kỳ |
| 13 | 6500 | Cấp 13 (Trúc Cơ Viên Mãn) | Trúc Cơ Viên Mãn |

Bề mặt hiển thị đã sửa:
- Thẻ nhân vật (`psLevel` trong `syncHUDStats`): trước là `Cấp ${level} · ${title}` (lặp kiểu "Cấp 8 · Cấp 8"), nay chỉ hiện tên cảnh giới (ví dụ "Luyện Khí tầng 8"). Khi thiếu title, hàm dự phòng `realmNameForLevel` cho ra tên cảnh giới theo level, không bao giờ ra "Cấp X".
- Dòng thưởng nhiệm vụ (`applyQuestRewards`): "Đạt cảnh giới <tên>".
- Rà soát toàn bộ js/index.html/data: không còn chuỗi hiển thị tiến trình nhân vật dạng "Cấp 2"…"Cấp 13" (chữ "cấp" trong các ngữ cảnh khác không thuộc phạm vi lệnh này).

Kiểm chứng (`tools/gd3-realm-check.mjs`, ĐẠT 16/16, log ở Mục 4.4):
- Cả 13 hàng giữ đúng từng con số trước/sau (xpNeed/maxHp/atk/def/maxMp/mpRegen đối chiếu bằng mã và bằng harness ngay trong game) — chỉ title thay đổi.
- Ba mốc hiển thị chụp ảnh thật: XP 0 → "Luyện Khí tầng 1" (level nội bộ vẫn 1); sau Q8 XP 2250 → "Luyện Khí tầng 8" (nội bộ vẫn 8); cuối Q13 XP 6250 → "Trúc Cơ Hậu Kỳ" (nội bộ vẫn 12).
- Trả nhiệm vụ Q13 thật (save chế tác XP 5300, chạm tương tác + thoại thật): banner thưởng ghi nguyên văn "Phần thưởng: +950 EXP · Đạt cảnh giới Trúc Cơ Hậu Kỳ" — không còn dòng "Lên cấp 12 (Cấp 12 (…))" lặp; XP 5300 → 6250, chuỗi nhiệm vụ hoàn thành.
