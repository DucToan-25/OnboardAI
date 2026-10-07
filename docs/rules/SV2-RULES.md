# Quy tắc Codex cho SV2 — Mentor, tài liệu chung và tương tác JavaScript

> Vị trí trong repo: `docs/rules/SV2-RULES.md`. Trước mỗi task của SV2, đọc [AGENTS.md chính](../../AGENTS.md), sau đó đọc file này. File này giao việc cụ thể, không thay thế quy tắc chính.

## 1. Phạm vi và cách kế thừa

- SV2 làm phần Mentor, thư viện quản lý dùng chung, trang chi tiết tài liệu và 403; tổng cộng sáu trang đã chốt.
- `hr-document-library.html` có tên HR nhưng thuộc SV2 vì dùng chung HR/Admin/Mentor. SV3 đưa link vào menu và dùng trang này, không tạo thư viện HR/Admin thứ hai.
- Đợt này làm HTML/CSS/JS DOM, form/modal, responsive và đầu nối dữ liệu minh họa. Các method ghi kho, đăng nhập nghiệp vụ, CRUD đầy đủ, thuật toán AI và API sẽ phân công sau; không tự nhận toàn bộ phần còn lại.
- Palette/token, registry class, module API, schema và quyền là nguồn chung trong `AGENTS.md`. Không chép lại hoặc thay chữ ký chỉ để thuận tiện cho ba trang Mentor.
- Khi quy tắc chính đổi, cập nhật phần dẫn xuất của file này trước task mới. Yêu cầu nghiệp vụ mới phải cập nhật hợp đồng và nơi sử dụng liên quan cùng PR.

## 2. Sáu trang và namespace được giao

| Task | HTML trong `pages/` | Marker trên body, đi cùng `page` | Prefix CSS riêng |
|---|---|---|---|
| `UI-07` | `mentor-mentee-list.html` | `page--mentor-mentee-list` | `mentor-mentees` |
| `UI-08` | `mentor-checkin-note.html` | `page--mentor-checkin-note` | `mentor-checkin` |
| `UI-09` | `mentor-task-assignment.html` | `page--mentor-task-assignment` | `mentor-tasks` |
| `UI-10` | `hr-document-library.html` | `page--hr-document-library` | `hr-library` |
| `UI-11` | `document-detail.html` | `page--document-detail` | `doc-detail` |
| `UI-12` | `403.html` | `page--error` | `error-page` |

JS/CSS riêng cùng tên gốc HTML và đúng thư mục của quy tắc chính. Ngoại lệ 403 dùng `js/pages/error.js`, `css/pages/error.css`; SV3 dùng lại hai file này cho 404. `data-page` của lỗi vẫn là `403`/`404`, không đổi thành `error`.

## 3. File chung SV2 phụ trách

| File | Công việc hiện tại | Reviewer |
|---|---|---|
| `js/common/ui.js` | Modal/confirm/toast/tab/view-state, đúng class markup SV1 | SV1 |
| `js/common/format.js` | Format ngày/giờ theo quy tắc chung | SV1 |
| `js/common/validation.js` | Rule/lỗi field dùng lặp, cùng kiểu kết quả | SV1 |
| `js/common/renderers.js` | DOM badge/task/document card thực sự dùng lặp | SV1 |
| `js/common/auth.js` | Đầu mối user preview/đổi user/logout; contract phiên | SV3 |
| `js/config/statuses.js` | `STATUS_META`: mã → nhãn → tone | SV1 |
| `js/data/repository.js` | Factory/context và contract truy cập thống nhất | SV3 |
| `js/data/mock-repository.js` | Adapter đọc seed minh họa, lỗi/kiểu kết quả chung | SV3 |
| `js/data/selectors.js` | Join/thống kê/tiến độ dùng chung khi cần | SV3 |
| `assets/data/seed.json` | Một schema/seed, nhận đóng góp của SV1/SV3 qua PR | SV3 |
| `css/pages/error.css`, `js/pages/error.js` | Component trang lỗi dùng chung 403/404 | SV3 |

Không tự viết lại `base.css`, `components.css`, `layout.css`, `main.js` hoặc menu riêng. Không tạo file helper/data khác có cùng chức năng để tránh cập nhật common hiện có.

## 4. Yêu cầu riêng từng màn hình

### UI-07 — Danh sách mentee

- Dựng thống kê, toolbar, bảng/list mentee và vùng chi tiết theo thiết kế; dùng component và badge chung.
- Các mentee thuộc Mentor hiện tại qua quan hệ `newHires.mentorId === currentUser.id`; đọc từ repository, không liệt kê tất cả rồi chỉ đổi tiêu đề.
- Thông tin tên/email/phòng ban join từ users/departments; tiến độ dùng selector chung. `newHires.id` khác `users.id`.
- Mở check-in/giao nhiệm vụ bằng `newHireId`, ví dụ `mentor-checkin-note.html?newHireId=nh-001`. Param chọn bản ghi, không cấp quyền.
- Nếu mentee không tồn tại/không thuộc phạm vi, có UI lỗi phù hợp; không tự thay ID sang người đầu tiên.

### UI-08 — Ghi chú check-in

- Dựng chọn mentee, lịch sử/check-in và form ghi chú. Input ngày/giờ, tên field và status theo schema chung.
- Mở/tạo/sửa cùng form với `{ mode, recordId, initialValues }`; draft tách bản ghi. Validate trước preview/lưu về sau.
- Check-in giữ `id`, `newHireId`, `mentorId`, `scheduledAt`, `note`, `status`. Không xác định đối tượng bằng tên mentee trên dropdown.
- Hủy form không thay đổi kho; hủy lịch dùng confirm chung khi có trong thiết kế. Chưa có persistence thì không báo ghi chú đã được lưu.
- Ghi chú riêng của mentor không tự xuất hiện ở HR/Admin/Newhire. Chia sẻ về sau theo ma trận quyền được nhóm duyệt.

### UI-09 — Giao nhiệm vụ và AI Checklist

- Dựng form chọn mentee/giao việc, bảng/list task và khu vực AI theo ảnh. Dùng form, table/task item, badge và `ai-panel` chung.
- Task có `id`, `newHireId`, người giao, hạn và status theo contract; chỉ chọn mentee thuộc phạm vi.
- Thêm/sửa dùng cùng form. Bấm Hủy bỏ draft; nút hủy task dùng confirm chung theo thiết kế. Đợt UI không tự triển khai các chuyển trạng thái nghiệp vụ chưa được chốt.
- AI checklist có nhập/validation/đang xử lý/kết quả/giải thích và Chấp nhận/Sửa/Từ chối/Tạo lại/Lưu; có ví dụ không đủ dữ liệu/thất bại.
- Gợi ý AI là draft. Chấp nhận có thể đưa vào vùng preview; ghi task chính thức về sau qua repository và kiểm tra quyền, không chỉ thêm hàng DOM rồi coi đã lưu.
- Task sẽ được nhân sự mới đọc bằng cùng ID trên checklist của SV1; không tạo `mentorTasks` và `newhireTasks` riêng.

### UI-10 — Thư viện HR/Admin/Mentor dùng chung

- Một HTML/CSS/JS, header/sidebar theo user thực tế. Không cố định menu HR chỉ vì tên file chứa `hr`.
- HR/Admin có các nút quản lý theo ma trận chính; Mentor chỉ đọc tài liệu đã phát hành trong phạm vi. Kiểm tra quyền action để hiển thị nút; repository cũng áp dụng phạm vi đọc.
- Tìm/lọc, form thêm/sửa, preview và xác nhận phát hành/lưu trữ dựng theo thiết kế. Dùng chung form cho hai chế độ và `document-card`/table chung.
- Tài liệu có cùng ID/content với thư viện nhân sự mới của SV1; không lưu bản sao riêng theo role.
- Nội dung nháp/lưu trữ không được đưa cho Mentor/Newhire qua page preview đang dùng tài khoản đó. Không cho sửa qua URL chỉ vì nút đã bị ẩn.

### UI-11 — Chi tiết tài liệu/sổ tay

- Một trang cho các tài liệu và cả bốn role đủ quyền. `id` lấy qua `URLSearchParams`, đọc bằng `repository.get('documents', id)`.
- Dựng title/meta/mục lục/nội dung theo thiết kế; prefix riêng `doc-detail`. Nội dung tài liệu là dữ liệu, không đặt trong nhiều HTML khác nhau.
- Link quay lại theo role: Newhire → `newhire-document-library.html`; Mentor/HR/Admin → `hr-document-library.html`.
- Xử lý thiếu ID, ID sai, không có quyền và dữ liệu rỗng. Không tự hiển thị sổ tay mặc định khi người dùng đang yêu cầu một tài liệu khác.
- Văn bản đưa vào DOM an toàn theo quy tắc chính; rich text nếu có cần quy tắc sanitize chung.
- Liên kết nguồn AI của SV1 mở đúng document ID; trao đổi callback/data contract trong PR, không copy trang detail sang phần AI.

### UI-12 — 403 và module lỗi dùng chung

- 403 là một HTML dùng khung `simple-layout`; style riêng trang lỗi ở `error.css`. 404 của SV3 tái sử dụng cùng bộ này.
- `error.js` export `initPage(context)`; nhận biết mã lỗi qua `pageId` là `403` hoặc `404` và render nội dung tương ứng. Không hardcode 403 ở mọi nơi của module.
- Trang lỗi vẫn mở được khi chưa có user; nút về login/trang mặc định tùy phiên. Không chuyển hướng vòng lặp vì thiếu quyền mở chính trang 403.
- Giữ cùng `error-page__...`, button/logo/font. Không tạo hai CSS/JS lỗi gần giống nhau.

## 5. Contract của helper và repository

Bổ sung shell/UI-17 ngày 07/10/2026: createIcon đặt fill/stroke trên SVG instance để mọi class icon dùng cùng nét vẽ, không đổi signature. settings.system bổ sung năm field quản trị theo data-contract.md; fixture AI vẫn giữ nguyên cho các màn hình AI. Owner repository/seed phối hợp review patch; không mở thêm quyền ghi kho.

Bổ sung 07/10/2026: trang chủ `UI-PUBLIC` đọc `portalPosts` qua list/get của repository hiện có, chỉ bản ghi published/public theo permissions chung. Xem schema ở data-contract.md; không chứa chi tiết nội bộ trong teaser. `createIcon` giải quyết đường dẫn sprite theo import.meta.url để dùng ở cả root và pages, không đổi chữ ký.

Bổ sung tích hợp 06/10/2026: chuyển ngày giờ check-in bằng helper format chung và rule datetime theo AGENTS mục 7; thống kê rủi ro dùng analyzeProgressRisk chung. Fixture checklist và field mở rộng được đặc tả ở [hợp đồng dữ liệu](../data-contract.md); quyền field lấy theo entity đang sửa.

Các signature đầy đủ lấy từ `AGENTS.md` mục 7–8. SV2 triển khai đúng contract đang có, không đổi tên/kiểu kết quả riêng cho phần Mentor.

- `ui.confirmAction(...)` trả `Promise<boolean>`; caller giữ ID và chỉ làm hành động khi true. Modal/toast/tab quản lý listener, focus, Escape/close và state một lần.
- `validateForm(values, rules)` trả `{ isValid, errors }`; lỗi keyed theo field. Common xử lý rule dùng lặp; điều kiện nghiệp vụ riêng của task nằm đúng trang/service.
- `createStatusBadge`, `createDocumentCard`, `createTaskItem` trả DOM, nhận dữ liệu/callback; không tự fetch, mutation hoặc đọc người đang đăng nhập.
- `STATUS_META` dùng mã trạng thái canon, tone trong tập của quy tắc chính. Badge dùng `badge--info`/`badge--warning`…; không sinh CSS cho mỗi mã task/document.
- `createRepository({ currentUser, mode })` trả Promise repository. UI nhận một repository qua context; adapter không import auth/page DOM, không gây vòng lặp import.
- `list(entity, query)` trả `{ items, total }`; get/create/update/archive và profile methods giữ chữ ký của quy tắc chính. Phần ghi chưa triển khai phải có hành vi chưa sẵn sàng rõ, không trả success giả.
- Dữ liệu đưa vào draft không được chia sẻ tham chiếu làm sửa seed/kho gốc ngay khi edit form. Bản trả về và draft phải được quản lý để Hủy không gây mutation.
- Seed là một object có `schemaVersion`, các mảng đúng tên thực thể; ID chuỗi ổn định, liên kết hợp lệ. Không ghi đè seed mỗi lần mở trang hoặc làm kho riêng theo role.
- Profile luôn theo user ID qua `getMyProfile()`; auth preview qua `getCurrentUser`, `setPreviewUser`, `logout`. Phiên preview không thay cho đăng nhập nghiệp vụ.
- Kho mô phỏng và API dùng cùng contract; đổi adapter tại cấu hình chung về sau. LocalStorage không tự đồng bộ nhiều máy; không hứa rằng commit GitHub sẽ đồng bộ runtime data.

## 6. CSS, DOM và dữ liệu không được tách riêng

- Dùng class registry chung, không định nghĩa lại button/card/modal/table trong CSS trang. Họ thường dùng: `toolbar`, `table`, `form-field`, `btn`, `badge`, `modal`, `document-card`, `task-item`, `ai-panel`, `view-state`.
- CSS riêng scope đúng marker/prefix, ví dụ `.page--mentor-task-assignment .mentor-tasks__preview`; error dùng `.page--error .error-page__code`.
- Khi cần component/modifier mới, góp patch với SV1 và cập nhật registry chính; không tạo bộ `mentor-*` cho những component đã có chung.
- JS hook dùng `data-action`, `data-id`, `data-region`, field name camelCase. Page module không bắt lại logout/toggle-sidebar/close-modal của common.
- `newHireId` trỏ `newHires.id`; `mentorId` trỏ `users.id`; document links giữ cùng `documents.id`. Không dùng tên/row index thay ID.
- Page JS không fetch hoặc đọc/ghi storage; các thao tác đó chỉ tại adapter/auth. Quan hệ và quyền được xử lý từ kho, không tin trường role/mentor do URL/form tự gửi.

## 7. Trình tự thực hiện và phối hợp

1. Làm `CORE-03`: UI/helper/user preview/adapter đọc tối thiểu. Nhận markup/class của SV1, phối hợp SV3 factory/bootstrap/permission.
2. Ưu tiên error module UI-12 để SV3 dùng 404; triển khai UI-11 và UI-10 để SV1 mở tài liệu; sau đó UI-07/UI-08/UI-09 theo phụ thuộc.
3. Đóng góp field/fixture của cả ba vào một seed qua PR; công khai contract từ đầu để page owner gọi cùng cách. Không tự sửa toàn bộ 18 trang để làm một API riêng của Mentor.
4. SV3 review PR trang/repository/auth/error của SV2 theo bảng chính; SV1 review UI/helper/renderer/status. SV2 review page của SV1 và shell/config của SV3.
5. Đánh dấu rõ dữ liệu nào preview, luồng nào chưa persist/AI chưa xử lý thật. Đợt nghiệp vụ sẽ chốt người làm riêng; không để helper UI gánh toàn bộ backend giả.

## 8. Điều kiện bàn giao

- Đủ sáu trang, đúng prefix/module và link ID; không có thư viện/detail/error bị nhân bản.
- Mentee được chọn đúng scope của user preview, tham số URL không thay quyền; note/draft của người trước không lẫn user sau.
- UI helpers dùng đúng class của SV1, kết quả trả về đúng contract; mở/đóng/render lại không nhân đôi event.
- Thử doc library với HR/Admin/Mentor và detail với người đủ/thiếu quyền; phân biệt đúng status `draft`, `published`, `archived`.
- SV1 mở nguồn/detail được, SV3 dùng 404/error helper được; filter/status/progress cùng nguồn.
- Form/modal/state AI dùng được, Hủy không đổi kho; chưa lưu thì không báo đã lưu. Có ví dụ rỗng/lỗi/không đủ dữ liệu.
- Kiểm tra 1440/768/390px, console, link/tài nguyên; CSS không copy component và không có selector hết dùng.
- PR/AI usage/task/OBS phần mình theo đề và quy tắc chính; source rõ để giải thích, không obfuscate.

## 9. Lệnh giao việc cho Codex của SV2

> Đọc AGENTS.md ở gốc repo và docs/rules/SV2-RULES.md. Tôi là SV2, thực hiện [CORE-03 hoặc UI-07…UI-12/tên task] theo thiết kế kèm. Làm HTML/CSS/JS và responsive đúng phạm vi Mentor và các trang chung đã giao. Tái sử dụng CSS/markup SV1 và shell SV3; helper/repository phải giữ nguyên signature, class, schema/ID/status của quy tắc chính. Chỉ làm dữ liệu đọc/preview và đầu nối cần cho giai đoạn giao diện, không tự mở rộng CRUD/AI/API đầy đủ. Kiểm tra luồng mentee/tài liệu/error liên thông và báo file đã đổi, phần dùng lại, cách thử và phần còn preview.
