# Quy tắc Codex cho SV1 — Nhân sự mới và giao diện dùng chung

> Vị trí trong repo: `docs/rules/SV1-RULES.md`. Trước mỗi task của SV1, đọc [AGENTS.md chính](../../AGENTS.md), sau đó đọc file này. File này giao việc cụ thể, không thay thế quy tắc chính.

## 1. Phạm vi và cách kế thừa

- SV1 phụ trách phần nhân sự mới, đăng nhập và hồ sơ dùng chung; vẫn có đúng sáu trang trong phân công hiện tại.
- Thực hiện HTML, CSS đặc thù, JS DOM, form/modal phụ và responsive của trang được giao. Giai đoạn này dùng dữ liệu minh họa tập trung; CRUD đầy đủ, đăng nhập nghiệp vụ, thuật toán AI và API phân công sau.
- Màu/font/khoảng cách, class công khai, signature JS, schema/ID/status và quyền lấy từ `AGENTS.md` mục 4–9. Không định nghĩa lại trong file này hoặc trong code trang.
- Khi cập nhật quy tắc chính, đối chiếu lại file này trước task mới. Nếu có điểm khác nhau, sửa phần dẫn xuất để khớp quy tắc chính; thay đổi nghiệp vụ mới theo yêu cầu nhóm phải cập nhật các hợp đồng liên quan cùng PR.
- Không tạo thư mục website riêng cho SV1; không chép toàn bộ bộ khung từ một bản giao diện cũ vào repo chung.

## 2. Sáu trang và namespace được giao

| Task | HTML trong `pages/` | Marker trên body, đi cùng `page` | Prefix CSS riêng |
|---|---|---|---|
| `UI-01` | `newhire-onboarding-dashboard.html` | `page--newhire-onboarding-dashboard` | `nh-dashboard` |
| `UI-02` | `newhire-checklist.html` | `page--newhire-checklist` | `nh-checklist` |
| `UI-03` | `newhire-ai-help.html` | `page--newhire-ai-help` | `nh-ai-help` |
| `UI-04` | `newhire-document-library.html` | `page--newhire-document-library` | `nh-library` |
| `UI-05` | `login.html` | `page--login` | `login` |
| `UI-06` | `profile.html` | `page--profile` | `profile` |

JS trang đặt tại `js/pages/<tên-gốc-html>.js`; CSS riêng, nếu cần thật, đặt tại `css/pages/<tên-gốc-html>.css`. `data-page` là tên gốc HTML. Chỉ nạp `../js/main.js` trong HTML; module trang export `async function initPage(context)` theo quy tắc chính.

## 3. File chung SV1 phụ trách

Bổ sung shell/UI-17 ngày 07/10/2026: logo dùng button chuẩn để toggle sidebar, bỏ hamburger/dấu X sidebar theo registry mới tại AGENTS. Header/sidebar dùng chung cho bốn vai trò; không tạo CSS hoặc markup riêng cho login/profile. Icon SVG instance có presentation attributes tại createIcon, dùng cùng sprite hiện có.

Bổ sung 07/10/2026: trang chủ `UI-PUBLIC` dùng token/component và logo-mark/sprite hiện có; CSS riêng scope `page--index .index__...` theo ngoại lệ root tại AGENTS mục 1. Component chung bổ sung pagination theo registry và nét vẽ cho btn__icon để external SVG không bị tô đen; không tạo block/modifier mới. Ảnh tin dùng imageUrl khi được cung cấp, mặc định icon chung. Patch components.css cần SV1/SV3 review trước merge.

| File/phạm vi | Công việc của SV1 | Reviewer |
|---|---|---|
| `css/base.css` | Reset, token, font, focus, `sr-only`, quy tắc `hidden` | SV3 |
| `css/components.css` | Style component, element, modifier và state đúng registry của quy tắc chính | SV3 |
| `assets/images/`, `assets/icons/` chung | Logo, avatar mặc định, bộ SVG thống nhất | SV3 |
| Registry class trong `AGENTS.md` mục 6 | Duy trì tên chuẩn khi thêm/sửa component; không tạo bản registry thứ hai | SV3, cùng owner trang sử dụng |

- Cung cấp mẫu markup tối thiểu cho button, form, card, toolbar, table, badge, progress, modal, toast và vùng AI đã cần trong thiết kế. Không viết trước component chưa dùng chỉ để đủ danh mục.
- SV1 viết CSS modal/toast; SV2 viết hành vi trong `ui.js`. Hai phần cùng sử dụng tên class đã chốt, không đặt hai cấu trúc modal khác nhau.
- SV1 không viết lại shell/menu/responsive chung của SV3, không tạo repository/auth/helper riêng thay cho SV2.
- Với file không thuộc mình, đề xuất patch nhỏ khi task cần và có owner review theo quy tắc chính. Không làm ba bản file chung hoặc mở file CSS để chồng bản sửa.

## 4. Yêu cầu riêng từng màn hình

### UI-01 — Dashboard nhân sự mới

- Dựng card tiến độ, nhiệm vụ sắp tới, tài liệu cần đọc và thông tin mentor đúng thiết kế. Dùng `card`, `stat-card`, `progress`, `task-item`, `document-card` tương ứng; không tạo lại bộ style của chúng.
- Dữ liệu thuộc nhân sự đang đăng nhập. User ID và newHire ID khác nhau; lấy `newHireId` từ hồ sơ/quan hệ đã được repository giải quyết.
- Tỷ lệ tiến độ qua `calculateProgress(tasks)` hoặc service thống kê chung; không viết cứng một phần trăm riêng. Không tính từ một trang danh sách đã phân trang.
- Mở checklist, task hoặc tài liệu bằng ID; nhiệm vụ trên dashboard và checklist là cùng bản ghi.
- Chuẩn bị vùng render và state rỗng/đang tải/lỗi; dữ liệu mẫu đi qua repository.

### UI-02 — Checklist

- Tìm/lọc theo các trường/status được thiết kế; nhóm task và vùng chi tiết dễ nhìn. Dùng cùng `task-item`, badge và progress với dashboard.
- Mở chi tiết bằng `task.id`, không dùng số thứ tự hàng. Form ghi chú/nộp kết quả chỉ dựng theo giao diện đã có; dùng class form chung.
- Giá trị người dùng sửa nằm trong draft; Hủy không làm đổi task gốc. Ở đợt UI, chuyển trạng thái hoặc nộp kết quả chỉ preview nếu adapter ghi chưa được triển khai.
- Không coi tích checkbox là quyền tự duyệt hoàn thành trong mọi tình huống. Luồng gửi/duyệt và chuyển status đầy đủ được chốt ở đợt nghiệp vụ.
- Nút xác nhận/hủy gọi `ui.confirmAction(...)` khi cần; không tạo modal xác nhận riêng ngoài component.

### UI-03 — Trợ giúp AI

- Dựng vùng hội thoại, ô nhập, kết quả, giải thích và nguồn; dùng `ai-panel`, form và button chung. Bố cục hội thoại đặc thù dùng prefix `nh-ai-help`.
- Luồng UI gồm nhập → validation → đang xử lý → kết quả → giải thích/nguồn → Chấp nhận/Sửa/Từ chối/Tạo lại/Lưu. Có ví dụ thất bại hoặc không đủ dữ liệu.
- Response/draft minh họa được chuẩn bị tập trung, không rải một mảng câu trả lời trong HTML hay page JS. Không tự gọi API AI hoặc đưa key vào frontend.
- Nguồn mở `document-detail.html?id=<documentId>` của SV2. ID phải tồn tại trong kho documents chung và thuộc phạm vi đọc.
- Sửa/lưu câu trả lời hoặc ghi chú cá nhân không làm thay đổi chính sách gốc. Kết quả AI chưa được chấp nhận không tự sửa hồ sơ/checklist.
- Nội dung nhập và câu trả lời hiển thị bằng DOM/textContent theo quy tắc chính.

### UI-04 — Thư viện nhân sự mới

- Giữ bố cục riêng đã thiết kế cho nhân sự mới. Tái sử dụng toolbar, form control, `document-card`/table và badge; không chép CSS thư viện quản lý.
- Dùng cùng documents/IDs với thư viện HR/Admin/Mentor, lọc tài liệu đã phát hành phù hợp role/phòng ban qua repository.
- Tìm/lọc và mở trang chi tiết bằng ID. Không tạo một HTML cho từng sổ tay hoặc một bản nội dung riêng trong trang thư viện.
- Không thêm nút thêm/sửa/phát hành/lưu trữ của HR vào giao diện nhân sự mới.
- Phối hợp SV2 về callback card tài liệu và nội dung detail; phối hợp SV3 để menu/backlink đúng vai trò.

### UI-05 — Đăng nhập dùng chung

- Một trang cho bốn role; bố cục đơn giản dùng `simple-layout`, form, button và modal chung. Không tự tạo bốn trang đăng nhập.
- Validate các trường theo thiết kế. Modal quên mật khẩu/liên hệ HR và chọn tài khoản demo thuộc trang này.
- Khi preview, chọn user qua `setPreviewUser(userId)` của auth chung, điều hướng bằng `ROLE_HOME`; không chọn hồ sơ bằng tên role.
- Không viết bảng mật khẩu rải rác trong `login.js`, không coi provider preview là hệ đăng nhập hoàn chỉnh. Không thông báo đã gửi email khi chỉ hiển thị hướng dẫn/mô phỏng.
- Việc đổi user phải làm mất draft/cache phiên trước theo auth/repository chung; không tự tạo kho session khác.

### UI-06 — Hồ sơ của cả bốn vai trò

- Chỉ một `profile.html`, `profile.js` và CSS riêng nếu cần. Header/sidebar do layout chung render theo tài khoản hiện tại; không cố định menu nhân sự mới.
- Đọc `repository.getMyProfile()`; `profile.id` là user ID. Không dùng role để lấy người đầu tiên trong seed, không nhận URL user ID làm căn cứ sửa người khác.
- Dựng thông tin chung, avatar và form cá nhân. Các trường tự sửa theo quy tắc chính: `fullName`, `phone`, `avatarUrl`; trường khác được quản lý qua đúng luồng có quyền.
- Thông tin mentor/ngày bắt đầu hội nhập chỉ hiện khi có bản ghi newHire liên quan. Trường không áp dụng dùng điều kiện render/hidden, không tạo profile riêng theo role.
- Form có draft, validation và Hủy; điểm ghi về sau là `repository.updateMyProfile(patch)`. Chưa có adapter ghi thì chỉ preview, không báo đã lưu.
- Kiểm tra bốn role và hai user cùng role để chứng minh nội dung không lẫn tài khoản.

## 5. CSS bắt buộc dùng đồng bộ

- Dùng registry trong `AGENTS.md` mục 6.4. Các họ thường dùng của SV1: `btn`, `card`, `stat-card`, `form-field`, `toolbar`, `table`, `badge`, `progress`, `avatar`, `task-item`, `document-card`, `modal`, `ai-panel`, `view-state`.
- Cú pháp: block `card`; element `card__title`; modifier `btn--primary`; state `is-invalid`. Modifier đi cùng base class.
- CSS riêng scope theo marker, ví dụ `.page--profile .profile__summary` hoặc `.page--newhire-checklist .nh-checklist__detail`. Prefix không thay cho class component dùng chung.
- Không tạo button/card/modal theo role, không có `newhire-btn` hoặc bộ profile class riêng cho HR/Mentor/Admin. Không thêm utility theo từng số pixel.
- Nếu phần đặc thù xuất hiện thực sự ở nhiều trang, chuyển phần dùng chung vào component theo quy trình PR; không gom vùng không liên quan chỉ vì trùng một thuộc tính.
- Token và breakpoint không chép lại. Responsive vùng riêng ở CSS trang; shell/component reflow chung do SV3 quản lý.
- Không override component bằng selector riêng hoặc `!important`; sửa đúng component/modifier. Không minify/obfuscate source của bài tập.

## 6. Điểm nối HTML/JS/dữ liệu

Bổ sung tích hợp 06/10/2026: profile gọi quyền field với entity `profile`; checklist dùng options của createTaskItem tại AGENTS mục 7 khi hạn/status đã có cột riêng. Field fixture/result bổ sung đọc theo [hợp đồng dữ liệu](../data-contract.md), không tạo bản riêng trong page.

- Giữ `#app-header`, `#app-sidebar`, `#main-content`, `#modal-root`, `#toast-root` theo loại layout của quy tắc chính. Không tạo thêm header/sidebar ngoài điểm mount.
- `context` vẫn là `{ currentUser, repository, permissions, ui, pageId }`. Không có một `currentRole` hoặc `mockProfile` khác trong mỗi page.
- Hook JS dùng `data-action`, `data-id`, `data-region`; `name` input khớp field camelCase. Ví dụ `data-action="save-profile"`, `name="fullName"`.
- Mọi đọc/ghi nghiệp vụ qua repository; page không fetch seed/API hoặc đọc/ghi LocalStorage trực tiếp. Dùng format/validation/renderers chung do SV2 cung cấp.
- Các thực thể chính: users, newHires, tasks, journeyAssignments, documents; giữ đúng khóa schema từ quy tắc chính. Không giữ các bản sao tên mentor/phòng ban nếu đã có ID để join.
- Thiếu field/bản ghi minh họa thì góp vào contract/seed chung với SV2 qua PR. Không tạo `sv1-seed.json`, `newhire-store.js` hoặc response shape riêng.

## 7. Trình tự thực hiện và phối hợp

1. Làm `CORE-01` về token/component vocabulary; phối hợp SV3 shell và SV2 hành vi modal/helper. Đưa bộ khung dùng được vào `dev` trước khi nhân bản các trang.
2. Ưu tiên UI-05/UI-06 để mọi role kiểm tra user và shell; triển khai tiếp UI-01/UI-02, UI-04 và UI-03 theo phụ thuộc thiết kế.
3. Page CSS/JS vẫn ở file riêng của từng task. Phụ thuộc common còn thiếu được bổ sung tại owner/common, không tạo bản sao tạm rồi giữ lại.
4. SV2 review PR trang của SV1; SV3 review PR CSS/tài nguyên chung. SV1 review page của SV3 và helper UI/renderer của SV2 theo bảng chính.
5. Cập nhật task/bảng màn hình/AI usage của mình; OBS theo màn hình được duyệt, không mặc định mỗi modal là một video.

## 8. Điều kiện bàn giao

- Đúng sáu filename, task và prefix; không có profile/login/tài liệu bị nhân bản theo role.
- Link task/tài liệu và ID nối với phần SV2; shell/menu/tài khoản nối với SV3 và auth chung.
- Form/modal/tab/tìm-lọc có hành vi; lỗi field rõ; Hủy phục hồi draft; không thông báo thành công giả.
- Layout 1440/768/390px dùng được, bảng chỉ cuộn trong wrapper, modal không vượt viewport; không có lỗi console/tài nguyên thiếu.
- Component dùng cùng class/token, không copy style/helper. Xóa selector hết dùng sau khi tìm cả HTML/JS.
- Profile không lẫn tài khoản khi đổi user/role; thống kê minh họa lấy từ cùng nguồn.
- PR theo nhánh/task của quy tắc chính, nêu component dùng lại, class mới, file chung đã đổi và phần chưa nối data. Không tự merge main hoặc sửa ngoài nhiệm vụ.

## 9. Lệnh giao việc cho Codex của SV1

> Đọc AGENTS.md ở gốc repo và docs/rules/SV1-RULES.md. Tôi là SV1, thực hiện [CORE-01 hoặc UI-01…UI-06/tên task] theo thiết kế kèm. Làm trọn HTML/CSS/JS và responsive của task ở giai đoạn giao diện. Dùng đúng class/token/component chung, không sao chép shell/helper/data; chỉ bổ sung phần đặc thù theo prefix được giao. Dữ liệu minh họa qua repository, giữ nguyên ID/schema/contract để nối data sau. Kiểm tra các phụ thuộc với SV2/SV3 và báo file đã đổi, component dùng lại, cách thử và phần còn preview.
