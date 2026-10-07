# AGENTS.md — Quy tắc phát triển giao diện OnboardAI

> Dùng chung cho Codex trong VS Code và cả ba thành viên. Đặt file này ở thư mục gốc của repository, commit cùng mã nguồn. Trước mỗi nhiệm vụ, đọc file này, `README.md`, bảng màn hình và các thành phần chung đang có. Không dựng một bộ khung riêng cho từng người hoặc từng vai trò.

**Bản chi tiết ngày 04/10/2026.** SV1/SV2/SV3 lần lượt là người 1/người 2/người 3 trong phân công của nhóm. Trọng tâm: một hệ giao diện chung, mỗi file chung có owner, class CSS có danh mục cố định, giao diện tách dữ liệu để tích hợp sau.

## 0. Quy tắc riêng theo thành viên

| Thành viên | File cần đọc sau AGENTS.md | Phạm vi |
|---|---|---|
| SV1 | [SV1-RULES.md](docs/rules/SV1-RULES.md) | Nhân sự mới, đăng nhập/profile chung, CSS token/component |
| SV2 | [SV2-RULES.md](docs/rules/SV2-RULES.md) | Mentor, thư viện/detail/error chung, UI helper và dữ liệu đọc/preview |
| SV3 | [SV3-RULES.md](docs/rules/SV3-RULES.md) | HR/Admin, 404 dùng chung error, shell/route/responsive và tích hợp |

- Khi task nêu SV1/SV2/SV3, đọc file tương ứng trước khi sửa; nếu task nêu màn hình cụ thể, lấy owner từ bảng mục 3. Task common theo owner mục 3.4. Không tự mở rộng một task thành phần của cả ba người.
- File từng SV chỉ bổ sung phạm vi và checklist; class công khai, token, signature JS, schema và quyền vẫn có nguồn chuẩn duy nhất tại AGENTS.md/các module chung. Không tạo ba bộ contract hoặc copy toàn bộ quy tắc chính vào ba file.
- Khi thay đổi quy tắc chung, cập nhật phần phụ thuộc trong file SV bị ảnh hưởng cùng PR. Phần dẫn xuất phải khớp quy tắc chính; yêu cầu mới của nhóm được xử lý bằng cách cập nhật các quy tắc/hợp đồng liên quan.
- Giữ AGENTS.md ở gốc repo, ba file SV ở `docs/rules/`; không thay AGENTS.md bằng bản riêng của một người hoặc tạo ba root website. Ghi rõ thành viên/task khi yêu cầu Codex làm việc.

## 1. Phạm vi và nguyên tắc làm việc

### Bổ sung theo yêu cầu trang chủ ngày 07/10/2026

- Thêm task `UI-PUBLIC`: `index.html` tại gốc repository, ngoài 18 trang nghiệp vụ trong `pages/`. Đây là trang tin tức công khai theo ảnh Onvera, không thay đổi phân công sáu trang mỗi người. SV3 điều phối tích hợp; owner các file chung vẫn theo mục 3.4, review trước merge.
- Route `index` là public, layout `simple`; riêng trang chủ dùng header/footer công khai trực tiếp trong HTML, không sidebar hoặc wrapper căn giữa của login. Marker `page page--index`, prefix riêng `index`, CSS `css/pages/index.css`, module `js/pages/index.js`. Vẫn dùng `#app-header`, `#main-content`, `#modal-root`, `#toast-root` và một entry `js/main.js`.
- Đường dẫn từ root dùng `css/...`, `assets/...`, `js/main.js`, `pages/login.html`; từ `pages/` về trang chủ dùng `../index.html`. Tài nguyên helper dùng URL tương đối với module để hoạt động cả root và deploy dưới thư mục con.
- Tái sử dụng token/component/UI helper/repository. Tin tức, thông báo, sự kiện lấy từ `portalPosts` trong seed chung theo [hợp đồng dữ liệu](docs/data-contract.md). Chỉ đọc bản ghi `published` và `visibility: public`; phần giới thiệu công khai không chứa nội dung nội bộ bị khóa.
- Các nút thông tin phụ và chi tiết dùng modal chung; chưa có chính sách/chi tiết nội bộ thì nói rõ đang chờ cập nhật. Không tạo HTML phụ hoặc đăng nhập thứ hai. 19 route tổng cộng gồm index và 18 trang nghiệp vụ.

### Bổ sung khung dùng chung và UI-17 theo yêu cầu ngày 07/10/2026

- Khung đã đăng nhập dùng một logo trong header, là button `btn btn--ghost app-header__brand` với `data-action="toggle-sidebar"`, `aria-controls` và `aria-expanded`. Logo mở/đóng sidebar trên mọi viewport; bỏ nút hamburger, dấu X và dòng “Hành trình hội nhập” lặp ở header. Không bỏ nút đóng của modal.
- Header nằm trên toàn chiều ngang, sidebar bắt đầu dưới header. Desktop mở mặc định, thu gọn dùng `.app-shell.is-collapsed` để mở rộng nội dung; tablet/mobile đóng mặc định, mở thành drawer. `.app-sidebar.is-open` xác định hiển thị ở mọi viewport; `.page.is-nav-open` chỉ khóa cuộn nền khi drawer mobile mở. Escape/chạm ngoài/trap focus được quản lý một lần tại layout.js.
- UI-17 giữ `admin-system-settings.html` và quyền Admin, đổi tên hiển thị thành “Quản lý hệ thống”. Gồm thống kê tài khoản/phòng ban/tài liệu từ repository, thông tin tổ chức, quy tắc hội nhập, liên kết đến trang quản trị đã có và phạm vi vai trò từ ROLE_MENUS. Không sửa câu trả lời AI mẫu hoặc sao chép CRUD từ trang khác.
- Field settings mới theo docs/data-contract.md; chỉ preview, Hủy/khôi phục trả baseline, không ghi hoặc áp dụng cấu hình thật. Các fixture AI vẫn trong seed để ba màn hình AI sử dụng, không thuộc field Admin được sửa.

- Công nghệ hiện tại: HTML5, CSS và JavaScript thuần, dùng ES modules. Không tự chuyển sang React, Vue, TypeScript hoặc thêm framework, thư viện, công cụ build khi chưa có yêu cầu của nhóm.
- Đợt hiện tại: dựng web tĩnh theo thiết kế, điều hướng, responsive, modal, tab, tìm kiếm/lọc dữ liệu minh họa và kiểm tra biểu mẫu. Dữ liệu đầy đủ, CRUD nghiệp vụ, đăng nhập, phân quyền mô phỏng, ba chức năng AI và tích hợp sẽ phân công ở đợt sau.
- Ngay từ đợt giao diện phải tách mã hiển thị khỏi dữ liệu, dùng ID và cấu trúc dữ liệu thống nhất. Chỉ chuẩn bị hợp đồng và dữ liệu minh họa tối thiểu; không tự nhận làm toàn bộ phần dữ liệu của nhóm.
- Giao diện basic, dễ đọc và dễ dùng. Bám bố cục Figma/ảnh được giao; không thêm chức năng, trang hoặc hiệu ứng trang trí ngoài phạm vi. Ảnh tổng hợp nhỏ không đủ để đo chính xác font/khoảng cách: dùng token chung bên dưới, không tự đoán ba bộ thông số khác nhau.
- Thiết kế và đề bài là căn cứ nghiệp vụ; file này thống nhất cách triển khai. Nếu yêu cầu mới của nhóm thay đổi quy tắc, cập nhật file và hợp đồng liên quan cùng PR.
- Trước khi sửa: xác định trang được giao, thành phần có thể tái sử dụng, file sẽ thay đổi và điểm kết nối dữ liệu. Kiểm tra mã hiện có trước khi tạo file/hàm/class mới.

## 2. Giao diện dùng chung trong phần trên cùng của ảnh

Phần trên cùng là nhóm dùng chung, không phải một website riêng. Các frame hồ sơ xuất hiện tiếp trong nhóm Newhire/Mentor/HR/Admin là biến thể theo dữ liệu và quyền của cùng một trang.

| Giao diện/thành phần | Quy tắc dùng chung |
|---|---|
| Đăng nhập | Một `pages/login.html` cho bốn vai trò. Trang đích được chọn từ cấu hình vai trò. |
| Hộp thoại phụ của đăng nhập | Quên mật khẩu/hướng dẫn liên hệ HR và chọn tài khoản demo mở trong trang đăng nhập. Không tự tạo thêm HTML độc lập. Không giả thông báo đã gửi email nếu chỉ là bản mô phỏng. |
| Hồ sơ cá nhân | Chỉ một `pages/profile.html`, một `profile.css`, một `profile.js`. Cả bốn vai trò dùng chung; lấy hồ sơ theo ID của người đang đăng nhập. |
| Không có quyền truy cập | Một `pages/403.html`, nút về trang phù hợp vai trò. |
| Không tìm thấy trang | Một `pages/404.html`. Dùng chung `css/pages/error.css` và `js/pages/error.js` với 403. Trang thiếu bản ghi cần thông báo phù hợp, không tự tạo thêm trang lỗi. |
| Hộp thoại xác nhận trong cụm dùng chung | Dùng một khung modal và hàm xác nhận chung cho các thao tác như hủy, lưu trữ, vô hiệu hóa, xóa, khôi phục. Nội dung, mức cảnh báo và ID đối tượng được truyền vào; không sao chép cùng modal sang từng trang. |
| Khung ứng dụng | Header, sidebar, avatar, tên tài khoản, menu, logout và mục đang chọn dùng cùng `layout.js` và CSS chung. Login/trang lỗi dùng khung đơn giản tương ứng. |

Các form/modal đặc thù dưới từng màn hình thuộc trang cha và do owner trang đó triển khai. Tái sử dụng khung modal chung, nhưng giữ các trường nghiệp vụ riêng. Thêm/sửa cùng thực thể dùng lại một form với chế độ tạo/sửa và ID; không tạo hai bộ form gần giống nhau.

### Những trang dùng chung thêm giữa các vai trò

- `hr-document-library.html`: HR, Admin và Mentor dùng chung. Giữ nguyên tên này theo đề; không tạo `mentor-document-library.html` hoặc `admin-document-library.html`.
- `newhire-document-library.html`: giữ trang và bố cục riêng cho nhân sự mới như thiết kế. Hai thư viện cùng đọc một kho `documents` về sau.
- `document-detail.html?id=<documentId>`: một trang chi tiết cho các tài liệu/sổ tay, được mở bởi cả bốn vai trò khi đủ quyền. ID chọn bản ghi; quyền đọc vẫn phải được kiểm tra. Nút quay lại dẫn về thư viện tương ứng vai trò.
- Những trang dùng chung hiển thị sidebar của người đang sử dụng, không cố định sidebar HR vì tên file chứa `hr`.

## 3. Phân công 18 trang: mỗi thành viên 6 trang

Tên HTML là cố định. CSS/JS riêng lấy cùng tên gốc với HTML; ngoại lệ 403/404 cùng dùng `error.css` và `error.js`.

| Owner | HTML trong `pages/` | Người được sử dụng |
|---|---|---|
| SV1 | `newhire-onboarding-dashboard.html` | Nhân sự mới |
| SV1 | `newhire-checklist.html` | Nhân sự mới |
| SV1 | `newhire-ai-help.html` | Nhân sự mới |
| SV1 | `newhire-document-library.html` | Nhân sự mới |
| SV1 | `login.html` | Dùng chung |
| SV1 | `profile.html` | Cả bốn vai trò, hồ sơ của chính mình |
| SV2 | `mentor-mentee-list.html` | Mentor |
| SV2 | `mentor-checkin-note.html` | Mentor |
| SV2 | `mentor-task-assignment.html` | Mentor |
| SV2 | `hr-document-library.html` | HR, Admin, Mentor; thao tác theo quyền |
| SV2 | `document-detail.html` | Cả bốn vai trò; đọc theo phạm vi tài liệu |
| SV2 | `403.html` | Dùng chung |
| SV3 | `hr-journey-management.html` | HR |
| SV3 | `hr-dashboard.html` | HR |
| SV3 | `admin-department-management.html` | Admin |
| SV3 | `admin-user-management.html` | Admin |
| SV3 | `admin-system-settings.html` | Admin |
| SV3 | `404.html` | Dùng chung |

Owner giữ trách nhiệm trang khi nhiều vai trò sử dụng. Không làm ba bản `base.css`, sidebar, profile hoặc seed để ghép cuối kỳ. Các mục sau phân công cả phần chuẩn bị dùng chung của đợt giao diện; người làm CRUD đầy đủ, thuật toán AI, đăng nhập nghiệp vụ và API ở đợt sau vẫn chốt riêng.

### 3.1. SV1 — giao diện nhân sự mới và hệ CSS component

Mỗi dòng là một task giao diện gồm HTML, JS DOM, CSS đặc thù nếu cần, tương tác, responsive và kiểm tra; không tách một người chỉ viết HTML rồi giao hết JS cho người khác.

| Mã task | Trang | Bố cục phải dựng | Tương tác/form phụ thuộc trang | Điểm dữ liệu chuẩn bị |
|---|---|---|---|---|
| `UI-01` | `newhire-onboarding-dashboard` | Card tiến độ, việc sắp tới, tài liệu cần đọc và khu vực mentor theo thiết kế | Mở checklist/task/tài liệu; mở thông tin chi tiết cần thiết; trạng thái rỗng | Nhân sự hiện tại, assignment, tasks, documents; tiến độ qua selector chung |
| `UI-02` | `newhire-checklist` | Bộ lọc, nhóm nhiệm vụ, hàng task, tiến độ và vùng chi tiết | Tìm/lọc; mở task; form ghi chú/nộp kết quả nếu có trong ảnh; preview thay đổi trạng thái | `task.id`, `newHireId`, `status`, `dueDate`; draft tách bản ghi gốc |
| `UI-03` | `newhire-ai-help` | Vùng hội thoại, ô nhập, kết quả, giải thích, nguồn và thao tác với AI | Validate câu hỏi; hiển thị các state AI; sửa draft, tạo lại/từ chối; mở nguồn tài liệu | Input/draft và các `documentId`; chưa gọi AI thật |
| `UI-04` | `newhire-document-library` | Giữ bố cục thư viện nhân sự mới, tìm kiếm, bộ lọc và card/list tài liệu | Tìm/lọc; mở tài liệu bằng ID; không thêm nút quản lý của HR | `documents` đã phát hành trong phạm vi người dùng |
| `UI-05` | `login` | Form đăng nhập, hướng dẫn, chọn tài khoản demo theo thiết kế | Validate form; modal quên mật khẩu/liên hệ HR; chọn user preview qua auth chung; điều hướng theo role | `users.id`, role từ provider chung; không tự làm hệ mật khẩu |
| `UI-06` | `profile` | Tóm tắt cá nhân, avatar, các nhóm trường, trường hội nhập có điều kiện | Form sửa các trường cho phép, validation, Hủy phục hồi draft; xem trước đủ bốn vai trò | `getMyProfile()`/`updateMyProfile()`; user ID là căn cứ lấy hồ sơ |

SV1 làm `base.css`, `components.css`, tài nguyên logo/avatar/icon dùng chung, danh mục class ở mục 6. SV1 cung cấp mẫu button/form/card/table/modal để SV2/SV3 dùng và kiểm tra profile với cả bốn role. Không làm CSS của 12 trang còn lại thay cho các owner.

### 3.2. SV2 — giao diện mentor, tài liệu và JS tương tác chung

| Mã task | Trang | Bố cục phải dựng | Tương tác/form phụ thuộc trang | Điểm dữ liệu chuẩn bị |
|---|---|---|---|---|
| `UI-07` | `mentor-mentee-list` | Thống kê, tìm/lọc, danh sách mentee và chi tiết tiến độ | Mở chi tiết; chuyển sang giao nhiệm vụ/check-in với `newHireId` | `newHires`, users, tasks; chỉ mentee thuộc mentor hiện tại |
| `UI-08` | `mentor-checkin-note` | Chọn mentee, danh sách/lịch sử check-in và form ghi chú | Mở/tạo draft/sửa cùng form; validate; Hủy không đổi dữ liệu; hủy lịch có xác nhận khi thiết kế có | `checkin.id`, `newHireId`, `mentorId`, `scheduledAt`, note |
| `UI-09` | `mentor-task-assignment` | Form giao việc, danh sách task và khu vực gợi ý checklist AI | Validate; thêm/sửa draft task; xác nhận hủy; đủ state AI và thao tác người dùng | `tasks`, IDs mentee; AI checklist chưa tự ghi vào kho chính thức |
| `UI-10` | `hr-document-library` | Khung thư viện quản lý, tìm/lọc, danh sách và các nút theo quyền | HR/Admin: form thêm/sửa, preview, xác nhận phát hành/lưu trữ theo thiết kế; Mentor: chỉ đọc | Cùng `documents` với SV1; cùng ID/status/phạm vi |
| `UI-11` | `document-detail` | Tiêu đề, meta, mục lục/nội dung sổ tay và nút quay lại | Đọc ID từ URL; mục lục nếu có; xử lý ID sai/không đủ quyền; backlink theo role | `repository.get('documents', id)`; cùng nội dung cho người đủ quyền |
| `UI-12` | `403` | Khung lỗi chung và nút quay lại/trang mặc định | Điều hướng phù hợp khi có/không có phiên | Tái sử dụng `error.css`, `error.js` cho SV3 làm 404 |

SV2 làm `ui.js`, helper format/validation/render component lặp, auth provider preview, repository đọc dữ liệu mẫu, schema/seed tối thiểu và cấu hình nhãn trạng thái. Phần ghi kho, CRUD đầy đủ, đồng bộ API và xử lý AI chưa tự động thuộc SV2. Form và event của từng trang vẫn do owner trang viết.

### 3.3. SV3 — giao diện HR/Admin, shell và tích hợp

| Mã task | Trang | Bố cục phải dựng | Tương tác/form phụ thuộc trang | Điểm dữ liệu chuẩn bị |
|---|---|---|---|---|
| `UI-13` | `hr-journey-management` | Danh sách journey, bộ lọc, xem bước và khu vực chỉnh sửa theo thiết kế | Chi tiết; form tạo/sửa mẫu hành trình, gán nhân sự nếu có trong thiết kế; xác nhận lưu trữ | `journeys`, `journeyAssignments`, `newHires`; tách mẫu với hành trình đã gán |
| `UI-14` | `hr-dashboard` | Card số liệu, biểu đồ/bảng tiến độ và danh sách rủi ro | Tìm/lọc, chi tiết nhân sự, khu vực AI risk với giải thích và các thao tác trên draft | Thống kê từ tasks/assignments chung; không đặt phần trăm riêng |
| `UI-15` | `admin-department-management` | Tìm/lọc, bảng phòng ban, chi tiết và form theo thiết kế | Cùng form thêm/sửa; validation; lưu trữ/xóa có xác nhận; chuẩn bị cảnh báo bản ghi đang được tham chiếu | `departments.id`, liên kết users/journeys |
| `UI-16` | `admin-user-management` | Bảng tài khoản, bộ lọc role/status/phòng ban và form quản lý | Thêm/sửa draft, chọn role/phòng ban, xác nhận vô hiệu hóa/khôi phục theo thiết kế | `users.id`, `departmentId`; không gọi form hồ sơ cá nhân để sửa người khác |
| `UI-17` | `admin-system-settings` | Nhóm cấu hình, form và các hành động hệ thống trong thiết kế | Validate; draft thay đổi; Hủy; modal xác nhận reset/khôi phục nếu có | Bản ghi settings `system`; không ghi dữ liệu trực tiếp từ DOM |
| `UI-18` | `404` | Cùng khung lỗi 403, đổi mã/nội dung | Trang mặc định/quay lại; dùng chung module lỗi của SV2 | Không tạo bộ CSS/JS lỗi thứ hai |

SV3 làm `layout.css`, responsive chung, `layout.js`, `main.js`, config role/route/app và kiểm tra quyền preview tối thiểu; tích hợp và kiểm tra tác động giữa các trang. CSS responsive đặc thù, form và JS trang vẫn do owner trang đó viết. Không nhận toàn bộ công việc sửa lỗi giao diện của hai người còn lại.

### 3.4. Owner và reviewer của từng file dùng chung

Owner là đầu mối duy trì, không phải người duy nhất được phép sửa. Người khác được đề xuất patch nhỏ trong phạm vi task; thay đổi chung phải có owner review hoặc review thay thế đã được nhóm phân công. Không cần chờ owner để phát triển file riêng không có phụ thuộc bị chặn.

| File/phạm vi | Owner | Reviewer chính | Bàn giao ở đợt giao diện |
|---|---|---|---|
| `css/base.css` | SV1 | SV3 | Reset, token, font, focus, trợ giúp accessibility |
| `css/components.css` | SV1 | SV3 | Class/markup chuẩn, biến thể và state của component |
| `assets/images/`, `assets/icons/` dùng chung | SV1 | SV3 | Một logo, avatar mặc định, bộ SVG và quy tắc kích thước |
| `css/layout.css`, `css/responsive.css` | SV3 | SV1 | Shell/page layout và reflow chung; không gom CSS riêng của 18 trang vào đây |
| `js/main.js`, `js/common/layout.js` | SV3 | SV2 | Bootstrap một lần, dựng menu/header/sidebar theo role |
| `js/config/roles.js`, `routes.js`, `app.js` | SV3 | SV2 | Đủ map 18 trang, trang mặc định, chế độ preview chung |
| `js/common/permissions.js` | SV3 | SV2 | Contract và quyền route/action/field ở mức preview; nghiệp vụ đầy đủ chốt sau |
| `js/common/ui.js` | SV2 | SV1 | Modal, xác nhận, toast, tab và view state dùng class của SV1 |
| `js/common/format.js`, `validation.js`, `renderers.js` | SV2 | SV1 | Helper nhỏ cho các phần đã dùng lặp; không dựng framework riêng |
| `js/common/auth.js` | SV2 | SV3 | Lấy/đổi user preview, logout, chuẩn bị contract phiên; chưa làm đăng nhập nghiệp vụ |
| `js/config/statuses.js` | SV2 | SV1 | Mã → nhãn → tone, dùng cùng một nguồn ở mọi trang |
| `js/data/repository.js`, `mock-repository.js`, `selectors.js` | SV2 | SV3 | Adapter đọc tối thiểu, contract, join/tính dữ liệu minh họa chung |
| `assets/data/seed.json` | SV2 | SV3 | Một seed; SV1/SV3 góp bản ghi/trường theo contract qua PR |
| `css/pages/error.css`, `js/pages/error.js` | SV2 | SV3 | Mã lỗi/copy/nút nhận qua cấu hình; SV3 tái sử dụng cho 404 |
| HTML/CSS/JS riêng SV1 | SV1 | SV2 | Sáu trang và các form/modal riêng |
| HTML/CSS/JS riêng SV2 | SV2 | SV3 | Sáu trang và các form/modal riêng |
| HTML/CSS/JS riêng SV3 | SV3 | SV1 | Sáu trang và các form/modal riêng |
| `AGENTS.md`, `README.md`, bảng màn hình/phân công | SV3 điều phối | SV1 và SV2 | Mỗi người cập nhật task/thiết kế/minh chứng của mình; SV3 kiểm tra nhất quán |

Mỗi thành viên ghi phần AI hỗ trợ của mình vào `docs/ai-usage-report.md`. Không giao toàn bộ báo cáo/OBS cho một người; mỗi người phải hiểu và minh chứng code của mình theo đề.

### 3.5. Thứ tự bàn giao để không chặn nhau

| Đợt/task chung | Người làm | Kết quả cần ghép vào `dev` |
|---|---|---|
| `CORE-01` — token và vocabulary CSS | SV1 | Base, class registry mục 6, mẫu markup các component nền tảng |
| `CORE-02` — shell và cấu hình trang | SV3 | Các điểm DOM, layout, đủ role/route, main và cấu hình app |
| `CORE-03` — contract JS và dữ liệu đọc | SV2 | UI API, user preview, seed tối thiểu, repository/renderer; phối hợp bootstrap với SV3 |
| `CORE-04` — kiểm tra bộ khung | Cả ba, SV3 điều phối | Một trang bảng, một form/modal và profile đổi role chạy cùng bộ khung; sửa lỗi chung trước khi tách task 18 trang |
| `UI-01`…`UI-18` | Owner trong bảng | Mỗi người làm sáu trang của mình trên cùng nền tảng, PR nhỏ theo task |
| `INTEGRATION-UI` | SV3 điều phối, mỗi người sửa phần mình | Menu/link/ID/class/viewport thống nhất; không có component/hồ sơ/dữ liệu mẫu bị nhân bản |

CORE-01/02/03 có thể làm song song sau khi chốt contract trong file này; chỉ ghép tiếp khi phụ thuộc thật đã có. Không tạo dummy module báo thành công giả để che phụ thuộc thiếu. Đây là thứ tự triển khai, không ấn định số ngày khi nhóm chưa cung cấp lịch.

## 4. Cấu trúc file thống nhất

| Đường dẫn | Trách nhiệm |
|---|---|
| `AGENTS.md`, `README.md` | Quy tắc và hướng dẫn chạy dự án |
| `pages/*.html` | 18 trang trong bảng; tất cả ở cùng một cấp thư mục |
| `css/base.css` | Reset, font và design token |
| `css/layout.css` | Header, sidebar, vùng nội dung và bố cục chung |
| `css/components.css` | Button, form, table, card, badge, modal, toast, tab, progress |
| `css/responsive.css` | Quy tắc responsive dùng chung và các điều chỉnh cuối cùng |
| `css/pages/<tên-trang>.css` | Chỉ tạo khi có CSS đặc thù thật; hai trang lỗi dùng `error.css` |
| `js/main.js` | Điểm khởi tạo duy nhất của mỗi HTML |
| `js/config/roles.js` | Mã vai trò, menu và trang mặc định |
| `js/config/routes.js` | Map `data-page` → module trang và danh sách vai trò được mở |
| `js/config/app.js` | Chế độ preview/mock/API, cấu hình chung; không chứa bí mật |
| `js/config/statuses.js` | Nhãn và tone dùng chung cho các mã trạng thái nghiệp vụ |
| `js/common/layout.js` | Render khung ứng dụng theo người dùng |
| `js/common/ui.js` | Modal, xác nhận, toast, tab và trạng thái hiển thị chung |
| `js/common/permissions.js` | Quyền mở trang, thao tác, đối tượng và trường được sửa |
| `js/common/auth.js` | Đầu mối lấy người dùng hiện tại; dùng provider preview trước, phiên mô phỏng sau |
| `js/common/format.js` | Format ngày/giờ, tên hiển thị theo quy tắc chung |
| `js/common/validation.js` | Rule và lỗi required/email/date dùng lặp trong form |
| `js/common/renderers.js` | Tạo DOM component dùng lặp như badge, task item, document card |
| `js/pages/<tên-trang>.js` | Logic DOM của trang; hai trang lỗi dùng `error.js` |
| `js/data/repository.js` | Đầu mối truy cập dữ liệu duy nhất của UI |
| `js/data/mock-repository.js` | Adapter dữ liệu minh họa/mô phỏng; mở rộng lưu trữ ở đợt sau |
| `js/data/api-repository.js` | Chỉ tạo khi nhóm bắt đầu nối API, giữ cùng hợp đồng với mock |
| `js/data/selectors.js` | Lọc/ghép/tính tiến độ theo quy tắc chung khi cần |
| `assets/data/seed.json` | Dữ liệu mẫu tập trung; thêm dần theo nhu cầu màn hình |
| `assets/images/`, `assets/icons/` | Logo, avatar và icon dùng chung |
| `docs/`, `design/` | Bảng màn hình, quyền, hợp đồng dữ liệu, AI usage, link/ảnh thiết kế |
| `docs/rules/SV1-RULES.md`, `SV2-RULES.md`, `SV3-RULES.md` | Quy tắc nhiệm vụ từng thành viên, luôn kế thừa AGENTS.md chính |

Không tạo thư mục `sv1/`, `sv2/`, `sv3/` chứa ba bản website. Không đổi tên file đã thống nhất để thuận tiện cho cá nhân. Khi repo đã có bộ khung tương đương, bổ sung có kiểm soát, không tạo thêm hệ thống song song.

## 5. HTML và đường dẫn

- Dùng `<!doctype html>`, `lang="vi"`, UTF-8, viewport và tiêu đề trang rõ nghĩa. Có một `h1` và các vùng `header`, `nav`, `main` phù hợp.
- Mỗi trang khai báo `data-page` bằng tên gốc HTML, ví dụ `profile`; class gốc gồm `.page` và `.page--profile`. Hai trang lỗi dùng `data-page="403"`/`"404"`, class `.page.page--error`.
- Khung ứng dụng thống nhất các điểm gắn DOM: `#app-header`, `#app-sidebar`, `#main-content`, `#modal-root`, `#toast-root`. Không tự đổi ID này ở từng trang. Login/lỗi không bắt buộc sidebar; `main.js` xử lý theo cấu hình route.
- Thứ tự nạp CSS: **base → layout → components → CSS riêng nếu có → responsive**. Mỗi file chung nạp một lần; không thêm `@import` để nạp lại cùng file. Chỉ một script đầu vào: `<script type="module" src="../js/main.js"></script>`. Module trang được `main.js` gọi, không gắn thêm script trang vào HTML.
- Link trang cùng thư mục: `profile.html`, `document-detail.html?id=doc-001`. Tài nguyên từ HTML: `../css/...`, `../js/...`, `../assets/...`. Import JS và URL trong CSS tính theo file chứa chúng. Không dùng đường dẫn máy cá nhân hoặc `/pages/...` cố định gây lỗi khi deploy dưới thư mục repository.
- Tạo query bằng `URLSearchParams`; không ghép chuỗi dữ liệu tùy ý vào URL. `id`/`newHireId` chọn bản ghi, không cấp quyền truy cập.
- Dùng `button` cho thao tác, `a` cho điều hướng. Không dùng `href="#"` làm nút giả. Form có `label`, tên trường, lỗi cạnh trường; table có `thead`, `th`, `tbody`.
- Dùng `data-action`, `data-id` làm hook JS. ID DOM không trùng. Nội dung động ở list/table/card có vùng render rõ ràng; không nhúng hàng loạt bản ghi mẫu trong HTML.
- Không dùng `onclick`, CSS inline hoặc khối script nghiệp vụ inline. Các khối HTML cơ bản có thể nằm trong trang; các thành phần dùng chung phải có một nguồn triển khai.

### 5.1. Khung DOM chuẩn cho trang có sidebar

Trong `head`, nạp meta và CSS đúng thứ tự ở trên. Khung body thống nhất như ví dụ profile sau; đổi `data-page`, marker, tiêu đề và nội dung theo bảng trang:

```html
<body class="page page--profile" data-page="profile">
  <div class="app-shell">
    <header class="app-header" id="app-header"></header>
    <aside class="app-sidebar" id="app-sidebar"></aside>
    <main class="app-main" id="main-content">
      <div class="page-header">
        <h1 class="page-header__title">Hồ sơ cá nhân</h1>
      </div>
      <div class="page-body">
        <!-- Component và vùng dữ liệu của trang -->
      </div>
    </main>
  </div>
  <div id="modal-root"></div>
  <div id="toast-root" aria-live="polite"></div>
  <script type="module" src="../js/main.js"></script>
</body>
```

`layout.js` điền header/sidebar vào các mount, không tạo thêm một header/sidebar ngoài chúng. Page module chỉ quản lý nội dung của mình. Login/403/404 dùng `simple-layout`/`simple-layout__content` với `#main-content`, không chép app shell rồi để sidebar trống; vẫn có modal/toast root nếu cần tương tác chung. Không thêm wrapper không có nhiệm vụ chỉ để đủ tên BEM.

## 6. CSS và hệ giao diện chung

### 6.1. Design token: một nguồn cho cả nhóm

Chốt các token sau trong `base.css`; trang riêng sử dụng `var(...)`, không tự chọn lại màu/kích thước tương đương.

| Token | Giá trị chuẩn ban đầu |
|---|---|
| `--color-primary` / `--color-primary-hover` | `#2563EB` / `#1D4ED8` |
| `--color-on-primary` | `#FFFFFF`; chữ/icon trên nền nút primary |
| `--color-background` / `--color-surface` | `#F5F7FB` / `#FFFFFF` |
| `--color-text` / `--color-muted` / `--color-border` | `#1E293B` / `#64748B` / `#E2E8F0` |
| `--color-success` / `--color-warning` / `--color-danger` | `#16A34A` / `#D97706` / `#DC2626` |
| `--color-info-soft` / `--color-success-soft` / `--color-warning-soft` / `--color-danger-soft` | `#EFF6FF` / `#F0FDF4` / `#FFFBEB` / `#FEF2F2` |
| `--font-family` | `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`; dùng cùng font/nguồn font cho toàn repo |
| `--font-size-body` / `--font-size-small` / `--font-size-title` | `16px` / `14px` / `24px` |
| `--space-1` … `--space-8` | Lần lượt `4px, 8px, 12px, 16px, 20px, 24px, 28px, 32px` |
| `--radius-control` / `--radius-card` | `8px` / `8px` |
| `--sidebar-width` / `--header-height` | `240px` / `72px` ở desktop |
| `--control-height` | `40px` cho nút/input thông thường |

- Dùng `box-sizing: border-box`, Flexbox/Grid, khoảng cách theo token. Không dựng cả trang bằng `position: absolute` hoặc kích thước tọa độ lấy từ ảnh.
- Giá trị dùng lại như màu, font, gap, radius và chiều cao control phải lấy từ token. Kích thước riêng thật sự của một vùng đặc thù có thể nằm trong CSS trang; không tạo token cho mọi con số dùng một lần.
- Token mới phải có tên theo ý nghĩa, ví dụ `--color-danger-soft`, không đặt `--blue-2`, `--my-padding`, `--sv2-radius`. Không tạo lại token tương đương dưới tên khác.
- Icon dùng cùng bộ SVG trong `assets/icons/`, cùng kích thước 20/24px. Không trộn các thư viện icon/font khác nhau. Logo và avatar mặc định dùng chung tài nguyên.

### 6.2. Ranh giới từng file CSS

| File | Được viết | Không viết ở đây |
|---|---|---|
| `base.css` — SV1 | Reset, `:root`, nền/font mặc định, focus, `.sr-only`, quy tắc `hidden` | Sidebar, card, form, bảng hoặc bố cục một trang |
| `layout.css` — SV3 | Shell/header/sidebar/nav, page header, grid bố cục dùng chung | Màu/biến thể button, form, modal hoặc nội dung chỉ có một trang |
| `components.css` — SV1 | Toàn bộ class component trong registry 6.4 và state của chúng | Selectors riêng `profile__...`, `hr-dashboard__...`; không phụ thuộc role |
| `responsive.css` — SV3 | Reflow của shell và component/layout chung tại hai breakpoint | Gom media query của từng trang; sửa component gốc bằng patch chồng chất |
| `css/pages/<tên-trang>.css` — owner trang | Layout/nội dung đặc thù, scope đúng page, media query riêng thật sự cần | Copy button/card/modal/table, reset/token, selector global hoặc trang người khác |

Nếu một trang chỉ dùng layout/component chung, không tạo CSS riêng rỗng để đủ số file và không link đến file chưa tồn tại. JS riêng vẫn tuân thủ `initPage`; hai trang lỗi dùng chung `error.js`. Không tính độ hoàn thành bằng số dòng/file CSS.

### 6.3. Cú pháp class bắt buộc: BEM đơn giản

| Loại | Cú pháp | Ví dụ |
|---|---|---|
| Block dùng chung | Từ tiếng Anh, chữ thường, `kebab-case` | `btn`, `card`, `form-field`, `page-header` |
| Thành phần bên trong | `block__element` | `card__title`, `modal__footer`, `form-field__error` |
| Biến thể ổn định | `block--variant` hoặc `block__element--variant` | `btn--primary`, `card--compact`, `form-field--full` |
| State tạm thời | `is-<state>` đi cùng block/element | `is-active`, `is-open`, `is-invalid`, `is-loading`, `is-disabled`, `is-selected` |
| Marker trang | `page page--<tên-gốc-html>` | `page page--profile`, `page page--mentor-task-assignment` |
| Class đặc thù trang | Prefix trong bảng 6.5 + `__element`/`--variant` | `profile__summary`, `mentor-tasks__preview` |

- Ví dụ đúng: `class="btn btn--primary"`; modifier phải đi cùng class gốc. Không chỉ gắn `btn--primary` rồi viết lại mọi thuộc tính nền tảng.
- BEM không lồng chuỗi element: dùng `card__title`, không dùng `card__header__title`. State không biến thành hàng loạt modifier như `btn--loading`, `tab--active`, `form--invalid`; dùng state chung đúng ngữ cảnh.
- Không đặt class tiếng Việt, tên người, số thứ tự hoặc phiên bản như `nut-xanh`, `sv1-card`, `button1`, `card-new`, `modal-v2`, `profileBox`.
- Không đặt class theo role cho cùng một component: cấm các bản sao `hr-button`, `mentor-button`, `newhire-button`. Role quyết định nút nào xuất hiện; component quyết định nút trông thế nào.
- State phải phù hợp thuộc tính HTML/ARIA: `.is-disabled` không thay thế `disabled`; `.is-invalid` kèm `aria-invalid`; tab active kèm `aria-selected`; drawer kèm `aria-expanded`.
- Không thêm class chỉ để JS query hoặc gắn class cho mọi `div/span`. JS dùng `data-action`, `data-id`, `data-region`. Chỉ tạo class khi có ý nghĩa cấu trúc/kiểu dáng cần dùng.

### 6.4. Registry class công khai dùng chung

Đây là danh mục tên chuẩn để tái sử dụng, không yêu cầu viết sẵn toàn bộ component chưa dùng. Chỉ triển khai phần cần trong thiết kế; thiếu biến thể thì mở rộng component hiện có qua PR, không tạo một block đồng nghĩa. Mục này là nguồn tên class chính thức trong repo.

| Họ class | Tên và biến thể chuẩn | File/owner |
|---|---|---|
| Shell | `app-shell` (state `is-collapsed`), `app-header`, `app-header__brand`, `app-header__actions`, `app-header__user`, `app-sidebar` (state `is-open`), `app-sidebar__footer`, `app-main` | `layout.css` / SV3 |
| Khung đơn giản | `simple-layout`, `simple-layout__content`; dùng ở login/403/404 | `layout.css` / SV3 |
| Menu | `app-nav`, `app-nav__heading`, `app-nav__list`, `app-nav__item`, `app-nav__link`, `app-nav__icon`, `app-nav__label`; link chọn có `is-active` | `layout.css` / SV3 |
| Khung nội dung | `page`, `page-header`, `page-header__title`, `page-header__description`, `page-header__actions`, `page-body`, `content-grid`, `content-grid--2`, `content-grid--3`, `content-grid--sidebar`, `stats-grid` | `layout.css` / SV3 |
| Nút | `btn`, `btn__icon`, `btn--primary`, `btn--secondary`, `btn--danger`, `btn--ghost`, `btn--sm`, `btn--icon` | `components.css` / SV1 |
| Form | `form`, `form__grid`, `form__actions`, `form--two-columns`; `form-field`, `form-field__label`, `form-field__control`, `form-field__hint`, `form-field__error`, `form-field__required`, `form-field--full` | `components.css` / SV1 |
| Lựa chọn | `checkbox`, `checkbox__control`, `checkbox__label`; `radio`, `radio__control`, `radio__label`; `switch`, `switch__control`, `switch__label` | `components.css` / SV1; chỉ tạo loại có trong thiết kế |
| Card | `card`, `card__header`, `card__title`, `card__subtitle`, `card__body`, `card__footer`, `card--compact` | `components.css` / SV1 |
| Thống kê | `stat-card`, `stat-card__label`, `stat-card__value`, `stat-card__meta`, `stat-card__icon`; dùng thêm `card` cho nền/padding chung | `components.css` / SV1 |
| Thanh công cụ | `toolbar`, `toolbar__search`, `toolbar__filters`, `toolbar__actions` | `components.css` / SV1 |
| Bảng | `table-wrap`, `table`, `table__actions`, `table__cell--numeric`, `table__cell--nowrap`; style `th/td` chỉ bên trong `.table` | `components.css` / SV1 |
| Badge | `badge`, `badge--neutral`, `badge--info`, `badge--success`, `badge--warning`, `badge--danger` | `components.css` / SV1 |
| Tiến độ | `progress`, `progress__label`, `progress__bar`, `progress__value`; ưu tiên thẻ `<progress>` nhận `value/max` | `components.css` / SV1 |
| Tabs | `tabs`, `tabs__list`, `tabs__tab`, `tabs__panel`; tab chọn có `is-active`, panel không chọn dùng `hidden` | `components.css` / SV1 |
| Phân trang | `pagination`, `pagination__list`, `pagination__button`, `pagination__summary`; button dùng thêm `btn` | `components.css` / SV1; khi thiết kế cần |
| Avatar | `avatar`, `avatar__image`, `avatar__initials`, `avatar--sm`, `avatar--lg` | `components.css` / SV1 |
| Card tài liệu | `document-card`, `document-card__icon`, `document-card__title`, `document-card__meta`, `document-card__actions`; dùng thêm `card` | `components.css` / SV1; SV1/SV2 cùng dùng |
| Hàng nhiệm vụ | `task-item`, `task-item__check`, `task-item__body`, `task-item__title`, `task-item__meta`, `task-item__actions` | `components.css` / SV1; dùng lại ở dashboard/checklist/preview checklist |
| Modal | `modal`, `modal__backdrop`, `modal__dialog`, `modal__header`, `modal__title`, `modal__close`, `modal__body`, `modal__footer`, `modal--sm`, `modal--lg` | `components.css` / SV1; hành vi do SV2 |
| Thông báo ngắn | `toast`, `toast__stack`, `toast__icon`, `toast__message`, `toast__close`, `toast--success`, `toast--danger`, `toast--info` | `components.css` / SV1; `showToast` type `error` map sang tone `danger` |
| Thông báo trong trang | `alert`, `alert__title`, `alert__message`, `alert--info`, `alert--success`, `alert--warning`, `alert--danger` | `components.css` / SV1 |
| Loading/rỗng/lỗi | `view-state`, `view-state__icon`, `view-state__title`, `view-state__message`, `view-state__actions`, `view-state--loading`, `view-state--empty`, `view-state--error`; `spinner` khi cần | `components.css` / SV1 |
| Khu vực AI | `ai-panel`, `ai-panel__header`, `ai-panel__input`, `ai-panel__result`, `ai-panel__explanation`, `ai-panel__sources`, `ai-panel__actions`; dùng thêm `card` nếu cần nền card | `components.css` / SV1; dùng chung ba AI |
| Trợ giúp accessibility | `sr-only`; `hidden` dùng thuộc tính HTML, không tạo thêm ba class ẩn khác nhau | `base.css` / SV1 |

Input/select/textarea đều dùng `form-field__control`; khác biệt cần thiết được style theo loại control bên trong component, không tạo `hr-input`, `mentor-select`. Không tạo thêm `table-container`, `table-responsive`, `table-wrapper` cùng chức năng với `table-wrap`.

Mã trạng thái dữ liệu không thành tên class mới. Ví dụ `submitted`/`changes_requested` tra `STATUS_META.tasks` để lấy nhãn và tone, rồi dùng `badge--info`/`badge--warning`. Không viết `badge--submitted`, `badge--changes-requested` và một bộ màu cho mỗi thực thể.

### 6.5. Namespace riêng của 18 trang

Marker dùng tên gốc HTML đầy đủ; prefix riêng ngắn hơn theo bảng. Chỉ tạo element riêng khi phần đó có CSS thật sự khác component chung. Các element ví dụ không phải danh sách bắt buộc phải tạo.

| Owner | Marker trang | Prefix riêng | Ví dụ vùng đặc thù |
|---|---|---|---|
| SV1 | `page--newhire-onboarding-dashboard` | `nh-dashboard` | `nh-dashboard__overview`, `nh-dashboard__next-task` |
| SV1 | `page--newhire-checklist` | `nh-checklist` | `nh-checklist__group`, `nh-checklist__detail` |
| SV1 | `page--newhire-ai-help` | `nh-ai-help` | `nh-ai-help__conversation`, `nh-ai-help__composer` |
| SV1 | `page--newhire-document-library` | `nh-library` | `nh-library__layout`; card bên trong dùng `document-card` |
| SV1 | `page--login` | `login` | `login__layout`, `login__panel` |
| SV1 | `page--profile` | `profile` | `profile__layout`, `profile__summary`, `profile__details` |
| SV2 | `page--mentor-mentee-list` | `mentor-mentees` | `mentor-mentees__layout`, `mentor-mentees__detail` |
| SV2 | `page--mentor-checkin-note` | `mentor-checkin` | `mentor-checkin__layout`, `mentor-checkin__history` |
| SV2 | `page--mentor-task-assignment` | `mentor-tasks` | `mentor-tasks__layout`, `mentor-tasks__preview` |
| SV2 | `page--hr-document-library` | `hr-library` | `hr-library__layout`, `hr-library__preview` |
| SV2 | `page--document-detail` | `doc-detail` | `doc-detail__layout`, `doc-detail__toc`, `doc-detail__content` |
| SV2 | `page--error`, `data-page="403"` | `error-page` | `error-page__code`, `error-page__title`, `error-page__actions` |
| SV3 | `page--hr-journey-management` | `hr-journeys` | `hr-journeys__layout`, `hr-journeys__steps` |
| SV3 | `page--hr-dashboard` | `hr-dashboard` | `hr-dashboard__layout`, `hr-dashboard__chart`, `hr-dashboard__risk-details` |
| SV3 | `page--admin-department-management` | `admin-departments` | `admin-departments__layout` |
| SV3 | `page--admin-user-management` | `admin-users` | `admin-users__layout` |
| SV3 | `page--admin-system-settings` | `admin-settings` | `admin-settings__layout`, `admin-settings__section` |
| SV3 | `page--error`, `data-page="404"` | `error-page` | Dùng cùng prefix/element 403, không tạo `error-404__...` |

Ví dụ selector riêng đúng: `.page--profile .profile__summary`. Với lỗi, dùng `.page--error .error-page__code`. Không đưa role vào profile để tạo `hr-profile__...`, `mentor-profile__...`, `admin-profile__...`; trường có điều kiện dùng DOM/data/state của cùng trang.

### 6.6. Ví dụ dùng lại, không sao chép CSS

Cả ba người dùng cùng loại nút, chỉ đổi nội dung và action:

```html
<!-- SV1: lưu draft hồ sơ -->
<button class="btn btn--primary" type="submit" data-action="save-profile">Lưu thay đổi</button>
<!-- SV2: giao nhiệm vụ -->
<button class="btn btn--primary" type="submit" data-action="assign-task">Giao nhiệm vụ</button>
<!-- SV3: thêm tài khoản -->
<button class="btn btn--primary" type="button" data-action="open-user-form">Thêm tài khoản</button>
```

CSS nền tảng chỉ định nghĩa một lần trong `components.css`, ví dụ:

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--control-height);
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  font: inherit;
  cursor: pointer;
}

.btn--primary {
  color: var(--color-on-primary);
  background-color: var(--color-primary);
}

.btn--primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}
```

Đây là ví dụ contract, không phải toàn bộ style component. SV1 bổ sung focus/disabled/icon/size cùng một nơi. Các trang không chép lại đoạn này vào CSS riêng.

Một form field thống nhất; `name` khớp field dữ liệu, không phụ thuộc tên class:

```html
<div class="form-field">
  <label class="form-field__label" for="profile-full-name">Họ và tên</label>
  <input class="form-field__control" id="profile-full-name" name="fullName"
    type="text" required aria-describedby="profile-full-name-error">
  <p class="form-field__error" id="profile-full-name-error" hidden></p>
</div>
```

JS validation đặt `is-invalid` trên field, `aria-invalid` trên input và hiển thị lỗi; không tạo class lỗi mới cho mỗi form. Card thống kê/document/AI dùng `card` làm nền, class chuyên biệt chỉ bổ sung phần bên trong. Không sao chép nền trắng, border, radius, shadow vào từng loại card.

### 6.7. Quy trình tạo/sửa class để kiểm soát độ lớn CSS

1. Tìm trong registry và code bằng `rg` trước khi thêm class. Tên khác nhau nhưng cùng vai trò giao diện vẫn là trùng component.
2. Nếu component đã có: dùng base + modifier được định nghĩa. Nếu chỉ thay vị trí: dùng layout hoặc class đặc thù trang, không sửa lại toàn bộ component.
3. Nếu cùng một cấu trúc/kiểu dáng thực sự xuất hiện ở ít nhất hai trang: đưa phần chung vào component, giữ khác biệt nghiệp vụ tại trang. Không gom các vùng không liên quan chỉ vì cùng có `padding: 16px`.
4. Nếu cần class công khai/biến thể mới: cập nhật registry, mô tả nơi dùng và nhờ owner CSS review. Không tạo `components-v2.css`, `common-extra.css` hoặc file `fix.css` để chồng override.
5. Khi thay thế component cũ: đổi tất cả nơi dùng trong phạm vi PR, kiểm tra rồi xóa selector đã hết người dùng. Tìm cả HTML và các chuỗi class trong JS trước khi xóa; không xóa dựa riêng vào một HTML.
6. Không giữ nhiều định nghĩa cùng selector trong một breakpoint để ghi đè lẫn nhau. Hover/focus/state/media khác nhau là biến thể hợp lệ; không gộp sai khiến mất hành vi.
7. Trong PR ghi class/component mới, cái nào được dùng lại, CSS chung đã đổi và selector cũ đã bỏ. Nếu thêm một họ component mà chỉ đổi tên của họ cũ, sửa PR trước merge.

Các ràng buộc cụ thể:

- CSS riêng không style selector global `button`, `input`, `table`, `h1`, không viết lại `.btn/.card/.modal`. Muốn thay một thuộc tính chung thì sửa component hoặc tạo modifier có ý nghĩa.
- Không dùng ID để style. Ưu tiên selector một/hai class; không quá ba cấp descendant. Tránh chuỗi selector theo toàn bộ cây DOM như `body main section div div button`.
- Không dùng `!important` trong CSS trang để chữa xung đột. Ngoại lệ chung duy nhất mặc định: SV1 có thể đặt `[hidden] { display: none !important; }` trong `base.css` để bảo đảm thuộc tính `hidden` luôn có tác dụng.
- Không tạo utility theo mọi con số như `mt-13`, `padding-22`, `width-317`. Dùng token, `gap` và layout chung; không dựng một bộ utility/framework riêng.
- Không sao chép 18 reset, 18 font declaration, 18 bộ màu hoặc 18 bộ button. Không thêm CSS rỗng, class không dùng, animation/icon library ngoài thiết kế.
- Không minify/obfuscate source trong đợt học; code phải đọc và giải thích được. Tối ưu bằng dùng lại component và xóa trùng, không chỉ rút ngắn tên class.
- Một khối HTML/CSS đặc thù dùng một lần có thể ở trang; không dựng framework component tổng quát, CSS engine hoặc cấu hình hàng trăm tùy chọn cho nó.

### 6.8. Responsive và khả năng sử dụng

- Breakpoint chung: `max-width: 1023px` cho tablet, `max-width: 767px` cho mobile. Không tự thêm breakpoint gần giống 768/770/780 cho cùng hành vi; breakpoint mới chỉ khi có nhu cầu khác rõ ràng.
- `responsive.css` xử lý sidebar drawer, header, grid/card/form/toolbar/tab/modal dùng chung. Owner trang xử lý reflow vùng đặc thù trong CSS riêng với cùng breakpoint, không chép cả responsive shell.
- Bảng rộng cuộn trong `table-wrap`, không làm toàn trang cuộn ngang. Modal có giới hạn viewport, vùng nội dung cuộn được; footer vẫn dễ thao tác. Không tạo thêm HTML mobile.
- Kiểm tra 1440px, 768px và 390px: chữ/nút không bị cắt, nội dung dài xuống dòng hợp lý, modal mở/đóng được, navigation dùng được. Không bắt buộc tạo thêm ảnh mobile trong đợt này.
- State có nhãn, không chỉ có màu. Dùng bàn phím và focus; dialog đóng bằng nút/Escape và trả focus; tab cập nhật ARIA. Nút phá hủy/lưu trữ có xác nhận chung.

## 7. JavaScript và khởi tạo trang

- ES modules, `const`/`let`, tên biến/hàm `camelCase`, hằng số `UPPER_SNAKE_CASE`. UTF-8, LF, thụt 2 dấu cách cho HTML/CSS/JS; dùng cùng cấu hình formatter của repo.
- Không khai báo hàm/biến nghiệp vụ vào `window`; không sao chép helper, format ngày, bảng nhãn trạng thái sang từng trang. Không thêm thư viện chỉ để làm thao tác JS đơn giản.
- Mỗi module trang export đúng một hàm vào: `export async function initPage(context)`. Nội bộ tách `loadData`, `render`, `bindEvents` khi cần. Không tự chạy init ở cuối module hoặc đăng ký một `DOMContentLoaded` riêng.
- `main.js` chạy một lần: đọc route → lấy người dùng hiện tại → kiểm tra quyền trang → tạo repository gắn với người dùng → dựng shell → gọi và `await initPage(context)`. Trang cần đăng nhập nhưng chưa có phiên chuyển về login; có phiên nhưng thiếu quyền chuyển về 403; route không tồn tại xử lý 404. Route login/403/404 được xử lý khi chưa có phiên; không tạo vòng lặp chuyển hướng về 403. Bắt lỗi khởi tạo tại một đầu mối.
- `context` thống nhất: `{ currentUser, repository, permissions, ui, pageId }`. UI trang không tự dựng một biến role/user riêng. Chế độ preview chọn tài khoản ở một đầu mối chung, không gán cứng `currentRole` trong mỗi file.
- Các API chung dưới đây là hợp đồng, không tự đặt thêm một tên tương đương tại từng trang. Nếu đổi chữ ký, cập nhật toàn bộ nơi gọi trong cùng PR.

| Module | API/giá trị dùng chung |
|---|---|
| `auth.js` | `getCurrentUser(): Promise<User \| null>`, `setPreviewUser(userId): Promise<User>`, `logout(): Promise<void>`. Chọn user preview ở một đầu mối; khi nối phiên mô phỏng, lưu user ID và đọc thông tin mới từ kho users, không lấy hồ sơ theo role. |
| `roles.js` | Export `ROLES`, `ROLE_LABELS`, `ROLE_HOME`, `ROLE_MENUS`. Trang mặc định: Newhire → onboarding dashboard, Mentor → mentee list, HR → HR dashboard, Admin → user management. |
| `routes.js` | Export `ROUTES`; mỗi key trùng `data-page`, giá trị `{ public, allowedRoles, layout, loadPage }`. `layout` là `app` hoặc `simple`; `loadPage()` import module và trả Promise. Login/403/404 là public. |
| `layout.js` | `renderLayout({ currentUser, pageId })`; đọc menu cấu hình và gắn vào các điểm DOM chung. |
| `permissions.js` | `canOpenPage(currentUser, pageId): boolean`; `can(currentUser, action, resource): boolean`; `getEditableFields(currentUser, entity, resource): string[]`. Action có dạng `documents:read`, `documents:update`, `tasks:submit`; danh sách action là một nguồn chung. |
| `ui.js` | `openModal({ title, content, onClose })` nhận DOM node và trả `{ element, close }`; `closeModal()` đóng modal đang mở. `confirmAction({ title, message, confirmLabel, tone }): Promise<boolean>`; `tone` là `primary` hoặc `danger`. |
| `ui.js` | `showToast({ message, type })` với `type` là `success`, `error`, `info`; `setViewState(root, { status, message })` với `status` là `loading`, `ready`, `empty`, `error`. |
| `ui.js` | `initTabs(root)` khởi tạo một lần cho cụm tab dùng chung; đồng bộ `is-active`, `aria-selected`, `hidden` và focus. |
| `format.js` | `formatDate(value)`, `formatDateTime(value)`; dữ liệu thiếu trả nhãn chung `—`, không hiện `Invalid Date` trong UI. |
| `validation.js` | `validateForm(values, rules): { isValid, errors }`; `errors` là object key theo field và value là thông báo. Rule dùng lặp ở đây; điều kiện nghiệp vụ riêng thuộc trang/service. |
| `renderers.js` | `createStatusBadge(entity, status)`, `createDocumentCard(document, options)`, `createTaskItem(task, options)` trả DOM node, dùng đúng class registry. `options` chứa callback/action/quyền hiển thị cần thiết, không tự đọc data/auth. |
| `statuses.js` | Export `STATUS_META` theo entity, ví dụ `STATUS_META.tasks.submitted = { label: 'Chờ duyệt', tone: 'info' }`; `tone` chỉ là `neutral`, `info`, `success`, `warning`, `danger`. |
| `repository.js` | `createRepository({ currentUser, mode }): Promise<Repository>`; repository đưa vào context đã gắn với user. Trang không tự tạo một repository khác. |
| `selectors.js` | `calculateProgress(tasks): { total, completed, percent }`; loại task `canceled`, đếm `completed`, làm tròn tỷ lệ phần trăm, tổng bằng 0 trả 0. Mọi nơi dùng cùng quy tắc hoặc cùng phiên bản quy tắc mới được chốt. |

Các kiểu `User`, `Promise<...>` trong bảng mô tả contract; code vẫn là JavaScript thuần, không tự chuyển sang TypeScript. `formatDate` giữ đúng ngày thuần, `formatDateTime` dùng múi giờ cấu hình chung (mặc định `Asia/Ho_Chi_Minh` cho bản demo tiếng Việt).

Bổ sung tích hợp UI ngày 06/10/2026: `format.js` cung cấp `getTodayDate(value = new Date())`, `toDateTimeInput(iso)` và `fromDateTimeInput(localValue)` theo múi giờ cấu hình; giá trị local dùng `YYYY-MM-DDTHH:mm`, chuyển đổi trả ISO UTC hoặc `null` nếu không hợp lệ. Rule dùng lặp `datetime` nằm trong validation chung. `selectors.js` cung cấp `analyzeProgressRisk(tasks)` trả `{ progress, overdue, remaining, hasData, atRisk, level, tone }`; bỏ task canceled khi tính tiến độ, không đánh giá rủi ro khi thiếu task, ngưỡng demo cao dưới 40%, trung bình dưới 70%. Ngày quá hạn lấy từ cùng múi giờ cấu hình. Đây là quy tắc minh họa, chưa phải thuật toán AI.

`roles.js` bổ sung `ROLE_LIBRARY` map role → pageId thư viện; backlink trang chi tiết dùng cấu hình này thay vì định nghĩa lại điều kiện role trong page.

`createTaskItem(task, options)` có thêm `showDueDate`/`showStatus` mặc định `true` để tái sử dụng trong bảng đã có cột hạn/trạng thái mà không lặp thông tin. Renderer vẫn không tự đọc dữ liệu hoặc quyền.

Định dạng rule form thống nhất: `rules` là object `{ fieldName: [rule, ...] }`, mỗi rule có `type` và `message`, thêm tham số nếu cần. Ví dụ `{ fullName: [{ type: 'required', message: 'Vui lòng nhập họ và tên.' }] }`. Các type dùng lặp như `required`, `email`, `date` chỉ có một implementation. Không tự tạo `checkForm`, `validateData`, `isValidForm` với ba cấu trúc kết quả khác nhau.

- Trang giữ ID bản ghi cần xác nhận; chỉ thực hiện thao tác khi `confirmAction(...)` trả `true`. Không dùng title/tên hiển thị để xác định bản ghi.
- Gắn event một lần; ưu tiên delegation cho danh sách render lại. Dùng `addEventListener`, xử lý submit với `preventDefault`, tránh nhân đôi handler sau mỗi lần render.
- Dữ liệu người dùng hiển thị bằng `textContent`/DOM API. Không đưa nội dung nhập, câu trả lời AI hoặc tài liệu tùy ý vào `innerHTML`; nếu cần rich text phải có quy tắc sanitize chung.
- Tách trạng thái giao diện với dữ liệu: modal đang mở, tab, bộ lọc thuộc UI; hồ sơ/task/tài liệu thuộc repository. Form sửa có bản draft; bấm Hủy không đổi bản ghi gốc.

### 7.1. Hook DOM và phạm vi sự kiện

| Thuộc tính | Ý nghĩa | Ví dụ |
|---|---|---|
| `data-page` | ID route/page module | `data-page="profile"` trên body |
| `data-action` | Tên hành động `kebab-case` | `open-task`, `save-profile`, `open-user-form` |
| `data-id` | ID bản ghi đang thao tác | `data-id="task-001"` trên hàng/nút |
| `data-region` | Điểm render/query có ý nghĩa | `task-list`, `profile-form`, `task-progress` |
| `name` của input | Tên field `camelCase` trong schema | `fullName`, `departmentId`, `dueDate` |

- Không query DOM bằng class để xác định nút nghiệp vụ. Đổi style không được làm mất handler. ID dành cho label/ARIA/anchor và điểm mount chung; không dùng ID trùng cho các hàng.
- `toggle-sidebar`, `logout`, `close-modal` là hành động chung do layout/UI quản lý; page module không bắt lại các hành động này. Các action trang chỉ gắn trong `#main-content` hoặc nội dung modal của trang.
- Tên action nói đúng việc. Không dùng `button1`, `clickHere`, `actionA`, không dùng cùng một action cho hai thao tác khác nghĩa trên một trang.
- Renderer chỉ tạo DOM và gắn callback được truyền vào; không tự fetch, thay đổi task/document, xác định người dùng hoặc phát thông báo đã lưu. Trang quyết định hành vi và gọi service.
- Form có vùng lỗi theo field, các giá trị draft và thao tác Hủy. Cùng form thêm/sửa nhận `{ mode, recordId, initialValues }`; cùng tên trường/class, không copy form thành hai file.

### 7.2. Ranh giới import, tránh vòng lặp và code trùng

- `main.js` điều phối, page module không import ngược `main.js` và không import module trang khác để gọi logic nghiệp vụ.
- Config chủ yếu chứa constants/maps. Route dùng lazy import page module; không chạy module trang khi chỉ đọc cấu hình menu.
- UI/format/validation/renderers không import `js/pages/*`. Repository/adapter không import DOM/page code. Auth preview có thể dùng nguồn đọc user của adapter; adapter không import auth, nhận user qua factory/context.
- Permission nhận user/action/resource đã được giải quyết quan hệ cần thiết. Repository kiểm tra quan hệ mentee/tài liệu từ kho của mình trước đọc/ghi; không tin `mentorId` hay role do form/URL tự gửi lên.
- Không tạo một `utils.js` khổng lồ chứa mọi thứ. Đặt helper vào đúng format/validation/UI/selector; không chia helper một dòng thành hàng chục file khi không có nhu cầu dùng lại.
- Không sao chép `openModal`, format ngày, progress, mapping badge hay card tài liệu sang 18 module trang. Nếu helper đang thiếu, owner common bổ sung một contract cho cả nhóm.
- Lưu draft/state trong module trang; tránh event bus/store tổng quát khi nhu cầu hiện tại chỉ là tải và render dữ liệu. Kiến trúc đủ để đổi adapter, không tự dựng framework.

## 8. Hợp đồng để nối dữ liệu sau này

### 8.1. Một đầu mối truy cập

UI chỉ gọi `repository.js`; không `fetch`, đọc/ghi `localStorage`, `sessionStorage` hoặc import thẳng seed trong `js/pages/`. Adapter/auth chung được phép xử lý lưu trữ của mình. Chế độ mock/API được chọn tại một cấu hình chung, không chỉnh từng trang.

Mọi phương thức đều bất đồng bộ, trả `Promise`. Giữ cùng chữ ký và kiểu kết quả khi đổi adapter:

| Phương thức | Kết quả/hành vi |
|---|---|
| `list(entity, query = {})` | `{ items: [], total: number }`; chỉ trả bản ghi trong quyền đọc; `total` là tổng sau lọc, trước phân trang |
| `get(entity, id)` | Một bản ghi trong quyền đọc; lỗi nếu thiếu/không được phép |
| `create(entity, payload)` | Bản ghi đã tạo, có ID và thời gian nếu thực thể dùng chúng |
| `update(entity, id, patch)` | Bản ghi đã cập nhật; kiểm tra trường được sửa và chuyển trạng thái |
| `archive(entity, id)` | Bản ghi sau lưu trữ; chỉ dành cho thực thể có hành vi lưu trữ đã định nghĩa |
| `getMyProfile()` | Hồ sơ của `currentUser.id`; join thông tin phòng ban/mentor khi phù hợp |
| `updateMyProfile(patch)` | Hồ sơ đã cập nhật; chỉ cho phép các trường cá nhân đã thống nhất |
| `getDepartmentReferences(departmentId)` | `{ users, journeys, documents }` là số bản ghi tham chiếu; chỉ Admin có quyền quản lý phòng ban. Không trả nội dung journey hoặc cấp quyền mở trang HR. |

`entity` dùng đúng tên trong bảng 8.2. `query` chỉ dùng các khóa đã có trong hợp đồng, như `search`, `status`, `departmentId`, `newHireId`, `page`, `pageSize`. Lọc theo quyền luôn áp dụng, kể cả khi người dùng sửa query. Các lệnh nghiệp vụ đặc biệt phải bổ sung hợp đồng rõ ràng, không lợi dụng `update` để bỏ kiểm tra quyền.

`getMyProfile()` giữ `id` là user ID; phần thông tin hội nhập có `newHireId` riêng. Mẫu khởi tạo trang: `initPage(context)` gọi `await context.repository.getMyProfile()`, truyền kết quả cho hàm render, rồi gắn sự kiện vào DOM. Không lấy thông tin từ các chuỗi tên/email viết trong HTML.

Phân trang dùng trang bắt đầu từ 1 và `pageSize` là số nguyên dương; bộ lọc đổi thì quay về trang 1. Nếu UI chỉ tìm/lọc bộ dữ liệu demo đã tải, vẫn dùng cùng tên field và quy tắc lọc của adapter, không tự đặt ba cách hiểu status/department khác nhau.

Lỗi có `code`, `message`, `fieldErrors` khi cần. Mã chung: `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `NETWORK_ERROR`. UI xử lý loading/empty/error/success và nút thử lại khi phù hợp; không giả định dữ liệu lúc nào cũng có.

Ở đợt UI, dùng vài bản ghi trong seed thông qua adapter đọc tối thiểu. Chưa có lưu trữ/CRUD thì nút có thể kiểm tra form và cho xem kết quả draft, nhưng thông báo rõ đây là bản xem trước; không báo đã lưu thành công. Không cần triển khai ngay toàn bộ phương thức ghi trong bảng.

### 8.2. ID, liên kết và schema tối thiểu

Tất cả ID là chuỗi ổn định, không dùng tên hiển thị hoặc số thứ tự hàng làm ID. Thêm trường phải cập nhật hợp đồng và seed cùng PR.

| Thực thể | Trường chính và nguồn thông tin |
|---|---|
| `users` | `id`, `fullName`, `email`, `phone`, `avatarUrl`, `role`, `departmentId`, `jobTitle`, `status`. Đây là nguồn danh tính chung. |
| `newHires` | `id`, `userId`, `mentorId`, `startDate`, `status`. `userId`/`mentorId` tham chiếu `users.id`; không lưu bản sao tên/email/phòng ban. |
| `departments` | `id`, `name`, `description`, `status`. Tham chiếu bằng `departmentId`. |
| `journeys` | `id`, `name`, `departmentId`, `status`, danh sách bước mẫu. Không chứa tiến độ cố định của từng người. |
| `journeyAssignments` | `id`, `journeyId`, `newHireId`, `startDate`, `status`. Nối mẫu hành trình với nhân sự mới. |
| `tasks` | `id`, `newHireId`, `journeyAssignmentId` nếu có, `assignedById`, `title`, `description`, `dueDate`, `status`, `updatedAt`. |
| `checkins` | `id`, `newHireId`, `mentorId`, `scheduledAt`, `note`, `status`. Mentor là một `users.id`. |
| `documents` | `id`, `title`, `category`, `content`, `status`, `audienceRoles`, `departmentIds`, `updatedById`, `updatedAt`. `departmentIds: []` nghĩa là áp dụng mọi phòng ban; role vẫn phải phù hợp. |
| `settings` | Bản ghi cấu hình chung có `id: "system"` và các trường đã được nhóm định nghĩa; không có mật khẩu, API key hoặc token bí mật. |

Các field bổ sung đang dùng trong UI (`tasks.relatedDocumentIds`, `tasks.result`, `checkins.sharedWithNewHire`, `settings.aiPreview`, `settings.checklistPreview`, `settings.riskPreview`) được đặc tả tại [docs/data-contract.md](docs/data-contract.md). Chúng thuộc cùng seed, không tạo kho theo vai trò. Field cá nhân lấy qua `getEditableFields(user, 'profile', profile)`; form quản lý dùng entity `users` và danh sách field Admin trong permissions.js, không dùng contract hồ sơ để sửa người khác.

`newHireId` luôn tham chiếu `newHires.id`, không lẫn `users.id`. Nếu task có `journeyAssignmentId`, nhân sự trong assignment phải khớp `task.newHireId`. Thông tin mentor/phòng ban hiển thị bằng join theo ID.

Ví dụ user: `usr-newhire-001`, `usr-mentor-001`, `usr-hr-001`, `usr-admin-001`; hồ sơ hội nhập: `nh-001`; tài liệu: `doc-001`. Hai thư viện và AI nguồn tài liệu sử dụng cùng `doc-001`, không tạo bản ghi riêng theo role.

- Vai trò chỉ dùng `newhire`, `mentor`, `hr`, `admin`. Nhãn tiếng Việt nằm trong cấu hình chung.
- Trạng thái lưu bằng mã thống nhất: task `pending`, `in_progress`, `submitted`, `changes_requested`, `completed`, `canceled`; document `draft`, `published`, `archived`; user `active`, `disabled`; journey `draft`, `active`, `archived`; journeyAssignment/newHire `active`, `completed`, `archived`; checkin `scheduled`, `completed`, `canceled`; department `active`, `archived`.
- Nhãn và màu trạng thái dùng chung. Không lưu lúc là `Hoàn thành`, lúc là `done`, lúc là số `1`. Quy tắc chuyển trạng thái được chốt ở đợt nghiệp vụ và kiểm tra trong repository.
- Ngày không có giờ dùng `YYYY-MM-DD`; thời điểm dùng ISO 8601 UTC. Hiển thị theo `vi-VN`; tránh biến ngày thuần thành ngày trước/sau do múi giờ.
- Tiến độ, số task và số người rủi ro được tính từ cùng dữ liệu/quy tắc trong selector/service chung, trên toàn bộ bản ghi thuộc quyền đọc trước phân trang. Không tính thống kê chỉ từ các hàng đang hiển thị hoặc viết cứng phần trăm khác nhau ở dashboard Newhire, Mentor và HR.

### 8.3. Kho dữ liệu mô phỏng và chuyển sang API

- Seed chỉ khởi tạo kho mock khi chưa có dữ liệu; không nạp lại và ghi đè dữ liệu đã sửa mỗi lần mở trang. Có phiên bản schema; khi schema thay đổi phải có migration hoặc reset demo riêng với xác nhận, không tự xóa kho cũ.
- `seed.json` dùng object cấp cao có `schemaVersion` và các khóa đúng tên thực thể trong bảng 8.2. Mỗi khóa thực thể chứa mảng bản ghi; `settings` cũng là mảng có bản ghi `system`. Không tạo ba schema khác nhau như `employees`, `staff`, `newEmployees` để cùng chỉ nhân sự mới.
- Nếu dùng LocalStorage về sau, một adapter quản lý namespace `onboardai:*`; phiên mô phỏng và dữ liệu nghiệp vụ tách khóa. Không tạo `hrDocuments`, `mentorDocuments`, `adminUsers` độc lập.
- LocalStorage chỉ dùng chung giữa các trang trong cùng trình duyệt và cùng origin. Khác trình duyệt, máy hoặc cổng server không tự đồng bộ. GitHub đồng bộ code/seed, không đồng bộ dữ liệu chạy của người dùng. Test nhiều máy cùng dữ liệu thì dùng một MockAPI/backend chung qua adapter API.
- Sau mutation: cập nhật kho chung, tải lại dữ liệu liên quan và tính lại số liệu. Trang mở sẵn có thể refetch khi quay lại/được focus; nếu cần cập nhật tức thì bổ sung cơ chế thông báo chung, không sao chép state theo role.
- Giữ nguyên render/form và hợp đồng khi chuyển mock → API; đổi adapter/cấu hình. Nếu API trả schema khác, chuyển đổi tại adapter, không sửa cấu trúc trong 18 file trang.

### 8.4. Cách kết nối giữa ba phần giao diện

| Dữ liệu/điểm nối | Trang tạo/sửa hoặc chọn dữ liệu về sau | Trang đọc/tái sử dụng | Hợp đồng phải giữ ngay từ UI |
|---|---|---|---|
| Tài khoản/hồ sơ | Admin quản lý tài khoản; từng người sửa trường cá nhân của mình | Login, header, profile; bảng mentee/HR join theo user | `users.id`; role không thay user ID; không lưu bản sao hồ sơ ở bốn trang |
| Phòng ban | Admin quản lý phòng ban | Form user/journey, bộ lọc tài liệu/HR, profile | `departmentId`; tên phòng ban lấy qua join |
| Journey đã gán | HR quản lý mẫu và assignment | Dashboard/checklist nhân sự, bảng mentor/HR | `journeyId`, `journeyAssignmentId`, `newHireId` |
| Task | Mentor giao/điều chỉnh; nhân sự cập nhật phần được phép; mentor xử lý kết quả | Checklist/dashboard nhân sự, mentee list, dashboard HR | Một `task.id` và status enum; không tạo bản task riêng cho Mentor/Newhire |
| Check-in | Mentor chuẩn bị/lưu ghi chú | Lịch sử check-in và các vùng đã được chốt quyền | `checkin.id`, `newHireId`, `mentorId`; không tự chia sẻ ghi chú riêng sang mọi dashboard |
| Tài liệu/sổ tay | HR/Admin quản lý và phát hành | Hai thư viện, chi tiết tài liệu, nguồn AI | Một `documentId`, nội dung và trạng thái phát hành; quyền theo role/phòng ban |
| Số liệu tiến độ | Selector/service tính từ dữ liệu được cấp quyền | Newhire, Mentor, HR | Một công thức; không đọc tỷ lệ phần trăm từ text của trang khác |

Trong đợt UI, SV1/SV3 đề xuất field/bản ghi cần cho trang mình, SV2 đưa vào seed/contract chung qua PR. Đây là phối hợp dữ liệu minh họa, không phải phân công toàn bộ nghiệp vụ của đợt sau. Không gửi dữ liệu giữa các trang bằng cách copy text từ DOM, sửa HTML của trang khác hoặc lưu một JSON theo từng role.

## 9. Hồ sơ và quyền sử dụng

- **Danh tính lấy theo user ID, quyền lấy theo role cùng phạm vi đối tượng.** Role giống nhau không có nghĩa là cùng một hồ sơ. Không lấy hồ sơ đầu tiên của danh sách hoặc dùng `role === 'hr'` để chọn một người cố định.
- `profile.html` gọi `getMyProfile()`; nút Lưu gọi `updateMyProfile(...)`. Không nhận `?userId=...` làm căn cứ để sửa người khác. Xem tài khoản người khác thuộc trang quản lý tương ứng.
- Các trường cá nhân được tự sửa mặc định: `fullName`, `phone`, `avatarUrl`. Email, mã tài khoản, role, phòng ban, mentor và thông tin hội nhập hiển thị theo dữ liệu chính thức; thay đổi chúng qua đúng luồng quản lý được phân quyền, không gửi trong patch hồ sơ.
- Trường mentor/ngày bắt đầu hội nhập chỉ xuất hiện khi hồ sơ có bản ghi `newHires` phù hợp. Các vai trò khác vẫn dùng cùng bố cục và trường cá nhân chung.
- Đổi tài khoản/logout phải xóa trạng thái người dùng, draft nhạy cảm và cache gắn với phiên trước; tải hồ sơ mới. Không giữ `profile` global rồi dùng lại cho tài khoản tiếp theo.
- Quyền mở trang khai báo trong `routes.js`; quyền thao tác/đối tượng khai báo một nguồn trong `permissions.js`. UI ẩn/khóa nút và adapter mô phỏng cùng kiểm tra quy tắc trước đọc/ghi. Không kiểm tra role rải rác trong từng trang.

| Phạm vi | Nhân sự mới | Mentor | HR | Admin |
|---|---|---|---|---|
| Hồ sơ cá nhân | Hồ sơ của mình | Hồ sơ của mình | Hồ sơ của mình | Hồ sơ của mình |
| Task/checklist | Task của mình; thao tác theo luồng được duyệt | Mentee được giao | Theo quyền theo dõi hội nhập được duyệt | Không tự cấp quyền chỉ vì là Admin |
| Check-in | Chỉ phần được chia sẻ nếu có trong thiết kế | Mentee được giao | Không mặc định đọc ghi chú riêng | Không mặc định đọc ghi chú riêng |
| Journey/dashboard HR | Không | Không | Có | Chỉ thêm khi có yêu cầu cụ thể |
| Phòng ban/tài khoản/cài đặt | Không | Không | Không | Có |
| Tài liệu đã phát hành | Đọc trong phạm vi | Đọc trong phạm vi | Đọc/quản lý | Đọc/quản lý |
| Tài liệu nháp/lưu trữ; thêm/sửa/phát hành/lưu trữ | Không | Không | Có | Có |

Quyền tài liệu HR/Admin quản lý, Mentor đọc là mặc định của bộ quy tắc này theo phân công đã trao đổi; nếu nhóm chốt khác, sửa một nguồn trước khi code. Không mặc định role “cao hơn” được mở mọi trang. Bản frontend chỉ mô phỏng phân quyền; khi nối backend thật, server phải kiểm tra lại danh tính, quyền và phạm vi ở mọi thao tác.

## 10. Chuẩn bị giao diện AI và chức năng phụ

- Chuẩn bị đủ luồng giao diện cho AI-1 Policy Q&A (`newhire-ai-help`), AI-2 Checklist Personalizer (`mentor-task-assignment`), AI-3 Progress Risk (`hr-dashboard`). Thuật toán và kết nối dữ liệu sẽ làm sau.
- Luồng: nhập → validation → đang xử lý → kết quả → lý do/nguồn → Chấp nhận/Sửa/Từ chối/Tạo lại/Lưu; có trạng thái thất bại hoặc không đủ dữ liệu và thao tác thử lại.
- Kết quả AI là draft. Không tự thay đổi checklist, tài liệu hoặc hồ sơ chính thức khi chỉ vừa render gợi ý. Chấp nhận/Lưu về sau phải đi qua repository và đúng quyền.
- Nguồn AI Q&A dẫn đến `document-detail.html?id=<documentId>` trong kho tài liệu chung. Sửa câu trả lời/ghi chú của người dùng không đồng nghĩa với sửa chính sách gốc.
- Danh sách, form và modal có vị trí cho loading, empty, lỗi trường, lỗi lưu và thành công. Các state này là biến thể của trang/component; không tự tăng số HTML độc lập.
- Mỗi nút phải có hành vi hoặc trạng thái chưa sẵn sàng rõ ràng. Không để nút trông hoạt động nhưng không xử lý gì, không tạo thông báo thành công giả.

## 11. Ghép code bằng Git/GitHub

1. Một repo chung; `main` là bản ổn định, `dev` là nhánh tích hợp. Mỗi task tạo `feature/<task-id>-<screen>` hoặc `fix/<task-id>-<issue>` từ `dev` đã cập nhật.
2. Bộ khung CSS/JS, cấu hình role/route và hợp đồng dữ liệu được merge vào `dev` trước. Cả ba lấy cùng bộ khung; không ghép bằng cách copy ba thư mục dự án vào nhau.
3. PR trang chủ yếu sửa HTML/CSS/JS trang mình và tài nguyên riêng. Thay đổi token, component, route, quyền hoặc schema là thay đổi chung: mô tả tác động và nhờ thành viên khác review trước merge.
4. Đăng ký route cho mỗi trang ở task đầu tiên của trang; khi có xung đột `routes.js`, giữ cả hai đăng ký. Không chọn toàn bộ “ours/theirs” làm mất trang của người khác.
5. Commit rõ việc: `feat: add profile layout`, `fix: prevent duplicate modal listeners`, `style: align shared table spacing`. Không dùng `update`, `done`, `final`; không tạo hàng loạt commit rỗng.
6. PR ghi task, trang đã làm, file chung đã đổi, cách chạy/thử, ảnh khi cần và phần còn ở giai đoạn sau. Một thành viên khác review; chỉ merge khi đã xử lý xung đột và kiểm tra điều hướng/tác động chung.
7. Không format lại toàn repo, đổi tên hàng loạt, viết lại file người khác hoặc chỉnh cấu hình chạy ngoài nhiệm vụ. Không force-push nhánh chung, `reset --hard`, xóa code người khác để giải quyết xung đột.
8. Không commit bí mật, file tạm hoặc bản chép dữ liệu người thật. Seed dùng dữ liệu giả. Tuân thủ `.gitignore` và formatter của repo; thống nhất UTF-8/LF trong cấu hình chung.
9. Sau merge, các thành viên cập nhật `dev` trước task mới. `main` nhận bản tích hợp đã kiểm tra, không nhận ba bản giao diện chưa thống nhất.

### 11.1. Quy trình khi cần thay đổi component chung

- Owner trang mô tả phần còn thiếu, tìm registry và kiểm tra nơi đang dùng. Nếu component đã đủ thì dùng trực tiếp, không mở thêm file chung để đổi tên.
- Nếu thiếu biến thể thật sự: PR patch nhỏ vào đúng file common, cập nhật registry/markup/callback contract nếu có. Tách PR common trước PR trang khi trang mới phụ thuộc thay đổi đó.
- Reviewer kiểm tra ít nhất một nơi dùng hiện có và trang cần biến thể mới. Khi biến thể chỉ thay một thuộc tính, không sao chép toàn bộ rule gốc.
- Sau merge common, owner trang cập nhật nhánh và dùng lại; bỏ các style/helper tạm đã hết cần thiết. Không để hai bản component chạy song song.
- Xung đột file chung được giải quyết theo từng khối: giữ class/route/field hợp lệ từ cả hai phía, xóa trùng có kiểm tra. Không chọn nguyên file chỉ vì bản của mình mới hơn.

### 11.2. Nội dung PR tối thiểu

```markdown
Task: UI-xx / CORE-xx
Owner và reviewer:
Trang/role được kiểm tra:
Thay đổi giao diện và tương tác:
Component/class dùng lại:
Class riêng/biến thể mới và lý do:
File chung/schema/contract thay đổi:
Cách thử ở 1440/768/390px, modal/form và điều hướng:
Phần đang preview, phần còn chờ dữ liệu/CRUD/AI:
Ảnh hoặc video minh họa khi cần:
```

Một PR giao diện không đạt nếu bổ sung một bộ button/table/modal/font trùng bộ chung, sửa schema không thông báo, dùng role riêng trong page, có link/file mất, hoặc báo lưu thành công khi chưa có lưu trữ.

## 12. Điều kiện bàn giao và kiểm tra

### Đợt giao diện hiện tại

- Đúng filename, owner, thiết kế và khung chung; link menu/chi tiết/quay lại không hỏng. Không thêm các bản profile/library theo role.
- Chạy qua HTTP server tĩnh với cùng quy ước của nhóm; không dùng `file://` để thử ES modules/JSON. Không có lỗi console hoặc tài nguyên 404 khi mở và chuyển trang.
- Tương tác giao diện cần thiết dùng được: modal, tab, tìm/lọc, validation, xác nhận; bàn phím và responsive ở ba kích thước đã thống nhất.
- Dữ liệu minh họa tập trung, có ID, UI qua repository; không có mảng dữ liệu/role giả riêng trong trang. Có vùng render và state phù hợp để nối dữ liệu.
- Khi đổi CSS/JS chung, kiểm tra ít nhất login, profile của bốn vai trò, một trang bảng và một trang form/dashboard bị ảnh hưởng. Không chỉ kiểm tra trang của người sửa.
- Cập nhật bảng màn hình/task và `docs/ai-usage-report.md` theo yêu cầu bài tập. Không ghi “hoàn thành BTL” khi mới xong web tĩnh.

### Checklist riêng cho từng người trước bàn giao

| Người | Nội dung bắt buộc tự kiểm tra |
|---|---|
| SV1 | Đủ UI-01…06; component CSS có tên trong registry; cả hai thư viện dùng được card tài liệu chuẩn; form có lỗi đúng field; profile đúng user khi đổi bốn role và hai user cùng role; không có profile theo từng role. |
| SV2 | Đủ UI-07…12; callback/modal không nhân đôi listener; thư viện quản lý hiển thị đúng nút theo role; doc ID và backlink nối với SV1/SV3; 403/404 dùng cùng error module; UI/repository trả cùng kiểu kết quả. |
| SV3 | Đủ UI-13…18; map đủ 18 route/menu; sidebar/header có cùng class và chỉ khởi tạo một lần; responsive common không đè layout riêng sai; dashboard lấy số liệu mẫu chung; 404 không tạo CSS/JS lỗi mới. |
| Cả ba | Không copy CSS/helper, không có font/reset/token riêng, không có global CSS trong file trang; seed một nguồn; tên field/ID thống nhất; PR được người khác review; mỗi người cập nhật task và minh chứng của mình. |

Phân biệt hai loại kiểm tra: trong đợt UI, kiểm tra render và quyền hiển thị preview; khi hoàn thiện nghiệp vụ, kiểm tra đọc/ghi thật trong kho mô phỏng hoặc API. Không coi việc ẩn nút đã chứng minh đủ quyền truy cập dữ liệu.

### Kiểm tra khi nối dữ liệu ở đợt sau

- Seed có tài khoản cho đủ bốn vai trò, ít nhất hai nhân sự mới để kiểm tra không lẫn hồ sơ/dữ liệu; thêm mentor thứ hai nếu kiểm tra phạm vi mentee.
- Mentor giao task → đúng nhân sự mới thấy task → nhân sự gửi kết quả → mentor xử lý → dashboard HR tính lại từ cùng kho. Tài khoản không liên quan không đọc/sửa được bản ghi.
- HR/Admin phát hành hoặc cập nhật tài liệu → người đủ phạm vi đọc đúng bản đã phát hành qua cả hai thư viện/trang chi tiết; Mentor/Newhire không xem bản nháp.
- Đổi tài khoản trên cùng trình duyệt không lẫn profile/draft; thử URL trực tiếp và sửa ID/query để kiểm tra quyền đối tượng, không chỉ việc ẩn menu.
- Thử lưu rồi reload, hủy form, dữ liệu rỗng, ID không tồn tại, lỗi adapter và reset demo. Chuyển adapter không làm thay đổi HTML/render của trang.
- Hoàn thiện CRUD, responsive, AI, task/PR/review và OBS theo bảng màn hình cuối cùng được duyệt. 18 trang là phân công hiện tại của nhóm, không thay thế việc duyệt bảng kiểm kê. Modal và biến thể role không tự tính thành trang/video riêng; theo quyết định duyệt thực tế.

## 13. Cách Codex trả kết quả sau mỗi task

Thực hiện trọn nhiệm vụ được giao trong phạm vi trên. Không tự mở rộng sang trang khác hoặc công việc dữ liệu/AI chưa phân công. Khi xong, báo ngắn gọn: đã đổi gì, file đã sửa, cách kiểm tra, thành phần chung đã tái sử dụng và điểm dữ liệu còn mô phỏng/chưa nối. Nếu thiếu chi tiết thiết kế nhỏ, dùng token/component chung và nêu giả định; chỉ hỏi khi thiếu thông tin ảnh hưởng nghiệp vụ, phân quyền hoặc hợp đồng chung.

Mẫu yêu cầu cho từng thành viên:

> Đọc AGENTS.md và bộ khung hiện có. Tôi là SV[1/2/3], thực hiện [tên màn hình/task] theo ảnh kèm. Chỉ làm giai đoạn giao diện HTML/CSS/JS đã quy định. Tái sử dụng thành phần chung, dùng repository cho dữ liệu minh họa, giữ nguyên hợp đồng và không sửa trang của người khác ngoài phụ thuộc cần thiết. Hoàn thành, kiểm tra và báo các file đã đổi cùng phần còn chờ nối dữ liệu.

Nếu giao cả phần của một thành viên, chỉ rõ sáu task của họ và các file chung họ phụ trách ở mục 3.4. Không dùng yêu cầu mơ hồ “làm toàn bộ vai trò HR” vì thư viện HR và profile đã thuộc owner khác. Mọi lần mở rộng class/CSS phải theo mục 6, không tự dựng một vocabulary mới dù code đang chạy trên nhánh cá nhân.
