# Rà soát quy tắc mã nguồn — 06/10/2026

Kết luận: **chưa tuân thủ đầy đủ, chưa đủ điều kiện bàn giao UI**.

Đối chiếu AGENTS.md và cả ba file docs/rules/SV1-RULES.md, SV2-RULES.md, SV3-RULES.md. Đã kiểm tra lại theo yêu cầu người dùng: working tree ứng dụng hiện sạch, HEAD 715604a; chỉ báo cáo này chưa được tracked. Đây là kiểm tra mã nguồn, cấu trúc, repository và HTTP; chưa phải chứng nhận chạy UI trên trình duyệt. Không sửa mã ứng dụng.

## Kết quả kiểm tra lại

- Mục 1 đã được sửa: không còn conflict, 32/32 JS qua kiểm tra cú pháp.
- Các vấn đề ở mục 2–13 vẫn còn; riêng trạng thái Git của file .tmp đã chuyển từ staged sang tracked trong HEAD hiện tại.
- HTTP vẫn đạt 18 trang và 42 tài nguyên. Import được cả 18 page module, mỗi module có initPage; availablePages chứa đủ 18 ID duy nhất.
- Chạy kiểm tra repository bằng Node với fetch được thay bằng bộ đọc seed trong bộ nhớ: getMyProfile trả đúng ID cho cả 5 tài khoản mẫu (4 role, 2 newhire); tài liệu Newhire/Mentor đúng status/audience/phòng ban; newHires đúng scope; HR/Admin không đọc check-in riêng; Admin không mở HR dashboard; ID tài liệu thiếu trả NOT_FOUND; updateMyProfile trả PREVIEW_ONLY.
- Các kiểm tra trên không thực thi DOM, CSS hoặc tương tác trình duyệt. Playwright/Puppeteer/jsdom không có sẵn trong môi trường; chưa bổ sung thư viện vào dự án.

## Phát hiện cần sửa

### 1. ĐÃ SỬA — Hai conflict làm toàn bộ ứng dụng không khởi tạo (SV3)

- Lần đầu: `js/config/app.js:5`, `js/common/layout.js:42` còn dấu conflict, làm chuỗi module của main.js không parse được.
- Kiểm tra lại: không còn dấu conflict; cả hai file qua kiểm tra cú pháp, cấu hình giữ đủ 18 trang. Không còn coi đây là lỗi đang tồn tại.
- Quy tắc: AGENTS §7, §11–12; SV3 §5, §8–9.
- Việc hết lỗi parse chưa chứng minh tất cả trang chạy được: lỗi DOM ở mục 2–3 vẫn tồn tại.

### 2. P1 — HTML và JS không khớp ở danh sách mentee và thư viện quản lý (SV2)

- `pages/mentor-mentee-list.html:24` chỉ có `mentee-page`; JS cần `mentee-filters`, `mentee-stats`, `mentee-rows`, `mentee-table-wrap`, `list-state`. `js/pages/mentor-mentee-list.js:150` gọi addEventListener trên null.
- `pages/hr-document-library.html:25` chỉ có `library-page`; JS cần `document-filters`, `document-rows`, `document-table-wrap`, `document-count`, `library-state`. `js/pages/hr-document-library.js:135` cũng gọi addEventListener trên null.
- Không có bước dựng các vùng này trước khi truy cập. Hai lỗi vẫn còn sau khi giải quyết merge.
- Quy tắc: AGENTS §5, §7.1, §12; SV2 UI-07/UI-10, §8.

### 3. P1 — Giao nhiệm vụ là bản chép nguyên JS danh sách mentee (SV2)

- `js/pages/mentor-task-assignment.js` giống hoàn toàn `js/pages/mentor-mentee-list.js` khi so sánh nội dung.
- HTML chỉ có `task-page`, trong khi module gọi `mentee-filters` tại dòng 9 và gắn listener tại dòng 150. Trang lỗi ngay khi init.
- Chưa có form tạo/sửa task, xử lý newHireId từ URL, xác nhận hủy task hoặc luồng AI Checklist Personalizer. Class riêng cũng dùng namespace mentor-mentees thay vì mentor-tasks.
- Quy tắc: SV2 UI-09, §2, §8; AGENTS §3.2, §6.5, §7.2, §10.
- Cần triển khai đúng UI-09, không chỉ đổi tên các region để hết exception.

### 4. P2 — Trang cài đặt đọc sai đường dẫn ghi chú (SV3)

- `js/pages/admin-system-settings.js:30` đọc `record.notes`.
- Seed lưu ở `settings[0].aiPreview.notes` (`assets/data/seed.json:429`, `:436`). Trang AI newhire cũng đọc từ aiPreview.
- Vì vậy tab ghi chú cài đặt luôn báo không có ghi chú dù seed có hai bản ghi. Sửa cách đọc theo cùng schema, không tạo thêm bản sao notes ở cấp ngoài.
- Quy tắc: SV3 UI-17, §7; AGENTS §8.2–8.4.

### 5. P2 — Hủy trong cài đặt giữ lại bản nháp đã preview (SV3)

- Submit gán `draft = values` tại `js/pages/admin-system-settings.js:83`; Hủy gọi `fillForm(draft || ...)` tại dòng 106.
- Tình huống: sửa A thành B → bấm Lưu (chỉ preview, kho vẫn A) → bấm Hủy. Form vẫn B nhưng thông báo đã hủy thay đổi và ẩn notice preview.
- Cần xác định baseline từ bản ghi gốc, phục hồi baseline và xóa draft/notice khi hủy.
- Quy tắc: SV3 UI-17; AGENTS §7 về tách draft và dữ liệu gốc.

### 6. P2 — Form check-in làm mất phần giờ của scheduledAt (SV2)

- `js/pages/mentor-checkin-note.js:78` dùng slice(0, 10); `pages/mentor-checkin-note.html:44` dùng input type=date; validation chỉ kiểm tra ngày tại JS dòng 175.
- Seed scheduledAt là ISO UTC có giờ. Mở sửa bản ghi 2026-10-06T03:00:00Z chỉ còn 2026-10-06, không giữ hoặc cho sửa giờ. Ngày UTC cũng không luôn trùng ngày địa phương.
- Chuẩn bị input ngày/giờ, chuyển đổi theo múi giờ cấu hình và giữ scheduledAt dạng ISO UTC trong draft trước khi nối ghi kho.
- Quy tắc: SV2 UI-08; AGENTS §7 format và §8.2.

### 7. P2 — Check-in không báo lỗi newHireId ngoài phạm vi (SV2)

- `js/pages/mentor-checkin-note.js:238` truyền thẳng preselect vào dropdown; dòng 239 chỉ chọn bộ lọc nếu tìm thấy ID, không có nhánh thông báo lỗi.
- Mở `mentor-checkin-note.html?newHireId=khong-ton-tai` hoặc ID của mentor khác dẫn đến form chọn trống và danh sách trong scope hiện tại, không giải thích đối tượng yêu cầu không hợp lệ.
- Đây là thiếu xử lý trạng thái URL, chưa phải bằng chứng lộ dữ liệu: repository vẫn lọc scope.
- Quy tắc: SV2 UI-07/08 và §8 về tham số URL, đối tượng và state lỗi.

### 8. P2 — Chấp nhận AI risk chỉ hiện toast, không thay đổi draft (SV3)

- `js/pages/hr-dashboard.js:264` xử lý accept-risk chỉ bằng showToast; không có thuộc tính accepted hoặc cập nhật trạng thái giao diện.
- Thông báo nói đã ghi nhận vào bản nháp nhưng không có thay đổi tương ứng trong state. Cần cập nhật trạng thái chấp nhận trong draft và phản ánh trên UI, vẫn không ghi kho chính thức.
- Quy tắc: SV3 UI-14; AGENTS §10 về thao tác AI có hành vi thật ở mức preview.

### 9. P2 — Thống kê rủi ro chưa có nguồn tính chung, ngày quá hạn dùng UTC (SV2/SV3)

- Mentor tính ngưỡng dưới 40% tại `js/pages/mentor-mentee-list.js:15`; HR lặp ngưỡng tại `js/pages/hr-dashboard.js:29`, `:40`. selectors.js hiện chỉ có calculateProgress.
- Phần trăm đã dùng selector chung, nhưng số người rủi ro/quy tắc rủi ro vẫn nằm trong từng page. Cần đưa quy tắc dùng lặp vào selector/service chung theo AGENTS §8.2.
- HR so dueDate với `new Date().toISOString().slice(0, 10)` tại dòng 28: từ 00:00 đến trước 07:00 giờ Việt Nam, ngày tham chiếu chậm một ngày. Dùng ngày tại múi giờ cấu hình chung.

### 10. P2 — Nhãn trạng thái bị khai báo lại ở các trang (SV2/SV3)

- Ví dụ `js/pages/hr-document-library.js:33`, `js/pages/hr-journey-management.js:33`, `js/pages/admin-user-management.js:40` tự định nghĩa cặp status/label cho dropdown; các HTML bộ lọc và check-in cũng chứa nhãn riêng.
- Badge dùng STATUS_META nhưng form/filter không dùng cùng nguồn, dẫn đến tên hiển thị có thể lệch nhau khi cập nhật cấu hình.
- Quy tắc: AGENTS §7, §8.2; SV2 §5; các file SV kế thừa contract trạng thái chung.
- Giữ tập lựa chọn hợp lệ của từng form, lấy nhãn từ STATUS_META tương ứng.

### 11. P2 — Contract chưa ghi các field mở rộng đang được sử dụng (các owner phối hợp)

- `tasks.relatedDocumentIds`, `tasks.result`, `checkins.sharedWithNewHire`, cấu trúc `settings.aiPreview` và notes đã có trong seed/UI nhưng chưa có đặc tả tương ứng trong bảng schema hoặc tài liệu contract riêng.
- Sai đường dẫn notes ở mục 4 là một lỗi tích hợp cụ thể của tình trạng này. `sharedWithNewHire` còn ảnh hưởng trực tiếp quyền đọc.
- Quy tắc: AGENTS §8.2 yêu cầu bổ sung trường phải cập nhật hợp đồng cùng seed; SV1 §6, SV2 §6, SV3 §7.
- Ghi rõ kiểu dữ liệu, optional/default, quan hệ ID và phạm vi đọc; không tạo ba hợp đồng khác nhau.

### 12. P3 — CSS rỗng, class riêng không có style và registry thiếu tên (SV1/SV2/SV3)

- Năm CSS 0 byte vẫn được HTML nạp: `hr-document-library.css`, `mentor-checkin-note.css`, `mentor-mentee-list.css`, `mentor-task-assignment.css`, `newhire-document-library.css` trong css/pages.
- Các class mentor-checkin__row, mentor-checkin__list, mentor-checkin__item, mentor-checkin__note… không có khai báo style dù được dùng để dựng cấu trúc đặc thù. Cần triển khai phần thật sự cần hoặc bỏ class/link/file thừa; không thêm CSS cho đủ số file.
- `css/layout.css:7`, `:10`, `:15`, `:34` thêm app-header__menu, app-sidebar__close, app-nav__heading, toast-stack nhưng AGENTS §6.4 chưa đăng ký.
- `js/pages/mentor-mentee-list.js:23` dùng stat-card thiếu card làm nền/padding chung; bản chép ở task assignment cũng vậy.
- Quy tắc: AGENTS §6.2–6.7; SV1/SV2/SV3 phần CSS.

### 13. P3 — Thiếu tài liệu bàn giao và chưa thống nhất LF (cả ba, SV3 điều phối)

- README.md hiện 0 byte: chưa có hướng dẫn chạy HTTP thống nhất.
- Trong docs chỉ có ba file rules; chưa có bảng màn hình/task, contract riêng hoặc docs/ai-usage-report.md để đối chiếu tiến độ/minh chứng.
- `git ls-files --eol` cho thấy working tree trộn LF/CRLF, ví dụ các trang và JS HR/Admin/Mentor vừa thay đổi. Chưa thấy cấu hình formatter/LF chung trong file được liệt kê.
- Các script và tài nguyên trong .tmp đã được tracked, bao gồm check-integration.cjs và smoke-http.cjs. Cần phân loại tài liệu/test cần giữ vào đường dẫn chính thức và loại file tạm khỏi commit theo quy tắc nhóm.
- Quy tắc: AGENTS §11–12; phần bàn giao trong cả ba file SV. Không kết luận ai đã/không review PR vì chưa kiểm tra lịch sử PR bên ngoài.

## Kiểm tra đã thực hiện và phần phù hợp

- Kiểm tra cú pháp trực tiếp bằng `node --input-type=module --check`: lần đầu 30/32; **kiểm tra lại 32/32 JS qua**.
- Chạy script HTTP hiện có: **18 trang, 42 tài nguyên trả thành công**. HTTP 200 không kiểm tra parse/khởi tạo JS, CSS reflow hay tương tác.
- Quét 18 HTML: đúng một h1, CSS theo base → layout → components → CSS trang → responsive, một script main.js dạng module; không thấy ID trùng trong từng HTML, tài nguyên/liên kết local bị thiếu, inline event/style hoặc href="#" trong phạm vi quét.
- Đủ 18 route; role home và role menu đã có cấu hình chung. 403/404 cùng module error; chỉ một profile và một thư viện quản lý dùng chung.
- Kiểm tra seed: đủ 9 mảng thực thể, schemaVersion 1; không thấy ID trùng trong từng thực thể, tham chiếu chính bị thiếu hoặc task/assignment lệch newHireId. Có 5 users, 2 newHires, 9 tasks, 8 documents.
- Không thấy fetch/storage trực tiếp trong page modules. Dữ liệu đi qua repository; adapter trả clone và các method ghi báo PREVIEW_ONLY thay vì success giả.
- Base tokens chính khớp AGENTS; breakpoint layout dùng 1023/767; CSS trang có nội dung được scope theo marker. Không thấy !important ở CSS trang.
- Profile lấy getMyProfile, dùng danh sách field được phép sửa, có validation và khôi phục bản gốc. AI Q&A có fixture tập trung, đủ scenario và lọc nguồn theo quyền. Đây là nhận xét từ source, chưa thay cho test chạy.
- Script `.tmp/check-integration.cjs` báo 47 lỗi trong môi trường này, trong đó 32 dòng “SYNTAX ERROR ... undefined” do nhánh execSync không cung cấp chẩn đoán hợp lệ. Không dùng con số đó để kết luận 32 JS sai cú pháp. Kiểm tra trực tiếp xác nhận chỉ hai lỗi parse; 15 tên region thiếu thuộc ba trang được đối chiếu lại bằng source.

## Chưa xác minh được

- Render và thao tác thực tế ở 1440/768/390px, console trình duyệt, focus/Escape, modal/tab/drawer, đổi bốn role và hai user cùng role: chưa chạy kiểm thử trình duyệt. Lỗi parse đã hết; kiểm tra profile/scope bằng Node không thay thế kiểm tra UI và chuyển phiên trên trình duyệt.
- Mức độ giống Figma/ảnh cho đủ 18 trang, chức năng nào được duyệt theo thiết kế: không có bảng màn hình/thiết kế đầy đủ để kết luận.
- Quy trình nhánh, owner review, PR, OBS và đóng góp AI từng thành viên: không suy ra từ tên file hay số dòng code.
- CRUD/persistence/API/AI thật chưa triển khai không bị tính là lỗi, vì quy tắc hiện tại chỉ yêu cầu giai đoạn UI/preview.

Ưu tiên sửa hiện tại: DOM và UI-09 → lỗi schema/draft/check-in/AI → contract/CSS/tài liệu → kiểm thử lại trên trình duyệt trước bàn giao.
