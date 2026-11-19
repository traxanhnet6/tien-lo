# TIÊN LỘ MMORPG 2D HD — QUY TRÌNH SẢN XUẤT BOSS 1.0

## Văn bản áp dụng chính thức

Tài liệu này chuyển toàn bộ nội dung của tệp `Tien_Lo_Boss_Production_Workflow_1_0.pdf` thành luật sản xuất bắt buộc cho mọi boss của Tiên Lộ và Ngũ Hành Vô Địch kể từ ngày 2026-11-09. Boss mẫu chuẩn là Boss 001, Bạch Hổ Sơn Quân.

Mục tiêu là tạo bộ boss có ngoại hình nhất quán, chuyển động đọc được trong góc nhìn isometric 2:1, hình 2D HD chi tiết cao, tài nguyên tách lớp, cấu hình rõ ràng và đủ điều kiện tích hợp vào client và server MMORPG.

Nguyên tắc khóa cao nhất là không nhân rộng một lỗi hình ảnh sang các hướng hoặc hoạt ảnh khác. Một hướng hoặc một hoạt ảnh chưa đạt thì phải sửa và nghiệm thu ngay trong phạm vi đó, không được lấy bản lỗi làm nền để sản xuất tiếp các hướng hoặc hoạt ảnh còn lại.

## 1. Đường ống khóa cứng

Thứ tự sản xuất bắt buộc là:

**Khóa concept → khóa turnaround 8 hướng → nghiệm thu Idle → Walk → Run → Combat → VFX và Hitbox → Atlas và JSON → tích hợp game → QA.**

Không được bỏ bước, đảo thứ tự hoặc tuyên bố hoàn thành một giai đoạn khi đầu ra của giai đoạn trước chưa được khóa. Turnaround phải được duyệt từng hướng. Idle phải được nghiệm thu trước Walk, Walk trước Run và toàn bộ chuyển động cơ bản trước Combat.

## 2. Bảng 10 bước sản xuất

| Bước | Hạng mục | Đầu việc chính | Điều kiện khóa |
|---:|---|---|---|
| 01 | Khóa thiết kế boss | Concept toàn thân, silhouette, bảng màu, tỷ lệ đầu và thân, lông, vằn, bờm, giáp, móng và đuôi | Concept và nhận diện boss không còn thay đổi tùy tiện |
| 02 | Turnaround 8 hướng | Tám hướng S, SE, E, NE, N, NW, W và SW, giữ cùng cấu trúc và phối cảnh | Duyệt tĩnh từng hướng, đủ 8 hướng thật |
| 03 | Idle 8 hướng | Tám khung cho mỗi hướng, gồm thở, tai, bờm và đuôi chuyển động, chân giữ điểm tiếp đất | Vòng lặp Idle qua nghiệm thu cho cả 8 hướng |
| 04 | Walk 8 hướng | Tám khung cho mỗi hướng, chu kỳ bước chân rõ và chuyển trọng tâm đúng | Không trượt chân và không nhảy vị trí |
| 05 | Run 8 hướng | Tám khung cho mỗi hướng, thân nghiêng khi tăng tốc, nhịp chân và đuôi phù hợp | Chạy nhanh nhưng vẫn bám đất và đọc rõ chuyển động |
| 06 | Bộ Combat | Detect, Chase, Approach, Attack Claw, Attack Pounce, Attack Tail, Skill Roar, Skill Earthquake, Skill Storm, Hit, Stun và Death | Đủ bộ hành động chiến đấu theo đặc tả |
| 07 | VFX và cấu hình combat | Telegraph, vùng sát thương, hitbox, hurtbox, thời điểm gây sát thương và recovery | Hiệu ứng tách khỏi thân, thông số chiến đấu cấu hình độc lập |
| 08 | Xuất tài nguyên | PNG RGBA độc lập, sprite sheet, atlas JSON, cấu hình hoạt ảnh và quy tắc đặt tên | Đủ tệp, đúng tên, đúng cấu trúc bàn giao |
| 09 | Tích hợp game | FSM, Behavior Tree, điều khiển boss, đồng bộ server-authoritative và kết nối combat | Boss vận hành đúng trạng thái và hành vi trong game |
| 10 | QA và nghiệm thu | Kiểm tra 8 hướng, vòng lặp, pivot, thiết bị di động, PC, hiệu năng và multiplayer | Chỉ đóng gói khi toàn bộ danh mục nghiệm thu đạt |

## 3. Bộ hoạt ảnh mục tiêu

| Hoạt ảnh | Khung mỗi hướng | FPS | Nội dung bắt buộc |
|---|---:|---:|---|
| Idle | 8 | 8 | Vòng lặp thở, tai, bờm và đuôi |
| Walk | 8 | 10 | Vòng lặp bước chân rõ |
| Run | 8 | 14 | Vòng lặp chạy nhanh, không trượt |
| Detect | 4 | 10 | Phát hiện mục tiêu |
| Chase | 8 | 14 | Truy đuổi |
| Approach | 6 | 10 | Tiến vào tầm đánh |
| Attack Claw | 8 | 14 | Cào bằng chân trước |
| Attack Pounce | 12 | 16 | Nén lực, bật, lao và tiếp đất |
| Attack Tail | 8 | 14 | Quét đuôi |
| Skill Roar | 12 | 12 | Gầm uy và sóng xung kích |
| Skill Earthquake | 12 | 12 | Dậm đất và địa chấn |
| Skill Storm | 12 | 14 | Lốc phong |
| Hit | 4 | 12 | Phản ứng khi trúng đòn |
| Stun | 6 | 10 | Choáng |
| Death | 12 | 10 | Ngã hoặc tiêu biến |

Tổng khối lượng là **126 khung mỗi hướng × 8 hướng = 1.008 khung**.

Số lượng trên chỉ là mục tiêu sản xuất. Một hoạt ảnh chỉ được tính là hoàn thành khi có đủ các PNG độc lập, đúng hướng, đúng khung và đã qua QA. Concept sheet, bảng tham khảo hoặc ảnh thử nghiệm không được tính là sprite hoàn thành.

## 4. Chuẩn hình ảnh và kỹ thuật

### 4.1. Phong cách và tính nhất quán

- Mọi khung phải dùng góc nhìn isometric 2:1 và phong cách 2D HD chi tiết cao.
- Tỷ lệ cơ thể, hướng sáng, vật liệu, bảng màu và độ nét phải nhất quán trong toàn bộ boss.
- Mọi hướng và mọi hoạt ảnh phải giữ cùng một nhận diện, cấu trúc cơ thể và tỷ lệ đã khóa ở concept và turnaround.

### 4.2. Khóa ngoại hình Boss 001 Bạch Hổ Sơn Quân

Ngoại hình chuẩn của Bạch Hổ gồm lông trắng, vằn đỏ, bờm trắng, giáp vàng và kim loại tối, móng vuốt và đuôi. Không được tự ý thay đổi hoa văn, màu sắc, phụ kiện hoặc thêm bớt chi tiết nhận diện trong quá trình sản xuất các hướng và hoạt ảnh.

### 4.3. Tám hướng phối cảnh thật

Tám hướng phải là tám góc phối cảnh thật gồm S, SE, E, NE, N, NW, W và SW. Không được lật ngang hình để giả lập hướng đối diện khi chi tiết của boss bất đối xứng. Mọi chi tiết như vằn, bờm, giáp, móng và đuôi phải xuất hiện đúng theo góc nhìn của từng hướng.

### 4.4. Nền trong suốt và canvas

- Mỗi khung phải là PNG RGBA có nền trong suốt thật.
- Không được dùng nền caro giả.
- Không được để viền nền, quầng nền hoặc màu nền dính vào silhouette.
- Canvas khởi điểm là 256×256 pixel cho mỗi khung.
- Phải tăng canvas khi chi tiết bị cắt. Không được nén, cắt hoặc làm mất chi tiết chỉ để giữ nguyên canvas khởi điểm.

### 4.5. Pivot và điểm tiếp đất

Pivot phải được đo từ điểm tiếp xúc đất thật của từng boss và từng loại hoạt ảnh. Không được coi pivot là đúng chỉ vì các khung dùng chung một tọa độ. QA phải kiểm tra độ ổn định của điểm tiếp đất qua toàn bộ vòng lặp và khi chuyển hoạt ảnh.

### 4.6. VFX, hitbox và thời điểm sát thương

- VFX phải tách khỏi thân boss, không được vẽ dính thành một phần không thể cấu hình của sprite thân.
- Hitbox và hurtbox phải được cấu hình độc lập với hình sprite.
- Thời điểm gây sát thương phải được cấu hình độc lập và khớp với thời điểm ra đòn trong hoạt ảnh.
- Telegraph, vùng sát thương và recovery phải đọc được bằng mắt trước và trong khi boss ra đòn.

### 4.7. Chuyển hướng trong thế giới sang hướng sprite

Vector hướng trong world-space phải được chuyển thành hướng sprite isometric trước khi chọn hoạt ảnh. Không được chọn hoạt ảnh trực tiếp từ vector thế giới nếu chưa qua bước chuyển đổi này.

## 5. Danh mục nghiệm thu bắt buộc

Một gói boss chỉ đạt nghiệm thu khi toàn bộ các mục sau đều đạt:

- [ ] Ngoại hình đúng concept đã khóa.
- [ ] Đủ 8 hướng và đúng góc nhìn isometric 2:1.
- [ ] Đủ số khung, đúng canvas và đúng tên tệp.
- [ ] Pivot và điểm tiếp đất ổn định.
- [ ] Vòng lặp không giật và không nhảy vị trí.
- [ ] Alpha trong suốt thật, không còn viền nền.
- [ ] Hitbox khớp với hoạt ảnh.
- [ ] Telegraph báo trước rõ ràng trước khi sát thương xảy ra.
- [ ] Đã chạy thử trên thiết bị mục tiêu.
- [ ] Đã kiểm tra đồng bộ phía server.

Nếu một mục chưa đo được hoặc chưa kiểm tra được thì phải ghi rõ là chưa nghiệm thu ở mục đó. Không được suy đoán là đạt.

## 6. Cấu trúc thư mục bàn giao

```text
Tien_Lo/
└── Boss/
    └── Boss_001_Bach_Ho/
        ├── 01_Concept/
        ├── 02_Turnaround_8_Directions/
        ├── 03_Animation/
        │   ├── Idle/
        │   ├── Walk/
        │   ├── Run/
        │   ├── Detect/
        │   ├── Chase/
        │   ├── Approach/
        │   ├── Attack_*/
        │   ├── Skill_*/
        │   ├── Hit/
        │   ├── Stun/
        │   └── Death/
        ├── 04_VFX/
        ├── 05_Hitbox/
        ├── 06_Atlas/
        ├── 07_JSON_Config/
        ├── 08_Game_Integration/
        └── 09_QA/
```

## 7. Quy tắc đặt tên tệp

Mẫu tên bắt buộc là:

```text
boss_white_tiger_001__{animation}__{direction}__{frame:03}.png
```

Ví dụ:

```text
boss_white_tiger_001__idle__SE__003.png
```

Tên hoạt ảnh và hướng phải dùng đúng mã đã quy định trong cấu hình của boss. Số khung phải có đủ ba chữ số.

## 8. AI boss và combat

### 8.1. Kiến trúc điều khiển

Boss dùng FSM để quản lý trạng thái tức thời và Behavior Tree để lựa chọn hành vi. Hai lớp này không thay thế nhau. FSM giữ trạng thái hiện tại, còn Behavior Tree quyết định hành vi phù hợp theo điều kiện trận đấu.

### 8.2. Luồng hành vi cơ bản

Luồng bắt buộc là:

**Idle hoặc Patrol → Detect → Chase → Approach → Telegraph → Attack hoặc Skill → Recovery → kiểm tra HP và Phase.**

Sau bước kiểm tra HP và Phase, boss có thể quay lại Chase hoặc chuyển phase tùy điều kiện. Không được bỏ qua Telegraph trước đòn đánh hoặc kỹ năng có sát thương.

### 8.3. Ba phase theo HP

| Phase | Khoảng HP | Bộ hành vi chính |
|---|---:|---|
| Phase 1 | 100–60% | Cào, vồ và quét đuôi |
| Phase 2 | 60–25% | Gầm uy, địa chấn và vồ |
| Phase 3 | 25–0% | Lốc phong, combo và tăng tốc |

### 8.4. Telegraph

Thời gian telegraph tối thiểu 700 mili giây chỉ là giá trị khởi điểm. Giá trị này phải được kiểm chứng bằng playtest và có thể phải điều chỉnh sau khi thử thực tế. Không được coi 700 mili giây là thông số cân bằng đã khóa vĩnh viễn.

## 9. Quy tắc tự động tiếp tục

- Hoàn thành một hạng mục thì phải tự kiểm tra hình ảnh, tệp và cấu hình của chính hạng mục đó.
- Nếu phát hiện lỗi, phải sửa ngay trong hạng mục hiện tại và không được nhân rộng lỗi sang hướng hoặc hoạt ảnh khác.
- Nếu hạng mục đạt, phải cập nhật tiến độ rồi mới chuyển sang bước tiếp theo.
- Chỉ dừng để xin duyệt khi có quyết định thiết kế quan trọng hoặc khi cần thay đổi ngoại hình đã khóa.
- Cuối mỗi giai đoạn phải xuất gói tài nguyên của giai đoạn đó và báo cáo rõ phần đã làm và phần chưa làm.
- Không bao giờ được tuyên bố sprite đã hoàn thành khi mới chỉ có concept sheet.

## 10. Luật phân loại và ghi nhãn trạng thái nghiệm thu

Hình ảnh trong tài liệu quy trình sản xuất boss chỉ là hình minh họa concept. Concept, hình tham khảo và sprite đã nghiệm thu để dùng trong game là hai lớp tài sản khác nhau và không bao giờ được trình bày lẫn lộn.

- Mọi sprite chưa qua nghiệm thu phải mang trạng thái rõ ràng là **CHƯA NGHIỆM THU** trong mọi báo cáo, danh sách bàn giao và thư mục nơi sprite đó xuất hiện.
- Vật liệu chưa nghiệm thu thuộc khu vực `01_Concept/` khi đang là concept hoặc hình tham khảo, và thuộc khu vực `09_QA/` khi đang chờ kiểm định hoặc đã kiểm định nhưng chưa đạt.
- Chỉ gói tài nguyên đã qua đầy đủ QA theo danh mục nghiệm thu mới được tính là tài sản game hoàn thành.
- Không được bàn giao, tích hợp hoặc mô tả một sprite **CHƯA NGHIỆM THU** như hình game hoàn thiện.
- Khi một gói gồm cả phần đã đạt và phần chưa đạt, trạng thái của gói phải ghi rõ từng phần. Không được dùng phần đã đạt để che trạng thái chưa nghiệm thu của phần còn lại.

## 11. Trạng thái hiện tại của Boss 001

Boss 001 Bạch Hổ Sơn Quân hiện đang ở giai đoạn khóa concept và turnaround, đồng thời có các thử nghiệm Idle. Các bảng hình hiện có là hình tham khảo và concept, chưa được nghiệm thu thành bộ hoạt ảnh game-ready.

Thứ tự tiếp tục bắt buộc là khóa mẫu tĩnh 8 hướng, nghiệm thu Idle 8 hướng, rồi mới đến Walk, Run và Combat.

Quy trình này điều chỉnh việc sản xuất bộ hình boss thật. Nó liên quan trực tiếp tới boss Bạch Hổ của nhiệm vụ Q7 tại Hậu Sơn trong bản Tiên Lộ isometric hiện tại. Đợt rewards đang kiểm chứng ba phase của boss trong bản slice, nhưng bản slice chưa có bộ sprite boss sản xuất theo quy trình này. Không được dùng trạng thái kiểm chứng gameplay trong slice để tuyên bố bộ hình boss đã hoàn thành.

## 12. Tài liệu đối chiếu bắt buộc

- Hồ sơ thiết kế Hà Nhân áp dụng cùng học thuyết tám hướng thật và pivot đo từ điểm tiếp đất cho nhân vật chính.
- Tiên Lộ Art Bible là chuẩn phong cách chung cho hình ảnh của dự án.
- Cổng kiểm định hình ảnh khắt khe yêu cầu đặt hình ứng viên cạnh hình tham chiếu đã khóa, soi ở đúng kích thước thật trong game và chỉ trình duyệt những hình đã qua cổng.
- `Tien_Lo_Boss_Production_Workflow_1_0.pdf` là tệp nguồn của quy trình này và được lưu cùng thư mục với văn bản áp dụng.

## 13. Hiệu lực

Mọi đợt sản xuất boss mới, mọi đợt làm lại boss và mọi đợt mở rộng hoạt ảnh boss đều phải tuân theo quy trình này. Nếu một chuẩn cũ mâu thuẫn với quy trình này ở phạm vi sản xuất boss, đội sản xuất phải ghi rõ mâu thuẫn trong báo cáo và xin quyết định ở cấp điều phối. Không được tự ý chọn chuẩn thấp hơn để tuyên bố hoàn thành.
