# Quy tắc Codex cho SV3 — HR, Admin, khung ứng dụng và tích hợp

> Vị trí trong repo: `docs/rules/SV3-RULES.md`. Trước mỗi task của SV3, đọc [AGENTS.md chính](../../AGENTS.md), sau đó đọc file này. File này giao việc cụ thể, không thay thế quy tắc chính.

## 1. Phạm vi và cách kế thừa

- SV3 làm hai trang HR, ba trang Admin và 404 trong phân công hiện tại; tổng cộng sáu trang.
- HR/Admin dùng thư viện quản lý và detail do SV2 làm; cả hai dùng profile/login do SV1 làm. Không tạo thêm profile, thư viện hoặc đăng nhập vì đang phụ trách các vai trò này.
- Đợt này làm HTML/CSS/JS giao diện, responsive, khung ứng dụng, điều hướng, quyền preview và tích hợp. CRUD đầy đủ, đăng nhập nghiệp vụ, thuật toán AI/API/phát hành sẽ phân công sau theo yêu cầu nhóm.
- Màu/font/token, registry class, chữ ký JS, schema và ma trận quyền là nguồn chính trong `AGENTS.md`. Không làm một hệ Admin khác về giao diện/data với phần Newhire/Mentor.
- Khi quy tắc chính cập nhật, đồng bộ phần dẫn xuất trong file này trước task mới. Yêu cầu mới thay nghiệp vụ cần cập nhật hợp đồng/nơi dùng qua cùng PR.

## 2. Sáu trang và namespace được giao

| Task | HTML trong `pages/` | Marker trên body, đi cùng `page` | Prefix CSS riêng |
|---|---|---|---|
| `UI-13` | `hr-journey-management.html` | `page--hr-journey-management` | `hr-journeys` |
| `UI-14` | `hr-dashboard.html` | `page--hr-dashboard` | `hr-dashboard` |
| `UI-15` | `admin-department-management.html` | `page--admin-department-management` | `admin-departments` |
| `UI-16` | `admin-user-management.html` | `page--admin-user-management` | `admin-users` |
| `UI-17` | `admin-system-settings.html` | `page--admin-system-settings` | `admin-settings` |
| `UI-18` | `404.html` | `page--error` | `error-page` |

JS/CSS riêng lấy cùng tên gốc HTML khi cần, nằm đúng thư mục chung. Ngoại lệ 404 dùng `js/pages/error.js`, `css/pages/error.css` do SV2 duy trì; không tạo `404.js`, `404.css`. `data-page` của lỗi là `404`.

## 3. File chung SV3 phụ trách

| File/phạm vi | Công việc của SV3 | Reviewer |
|---|---|---|
| `css/layout.css` | Shell/header/sidebar/nav/page header/grid, layout đơn giản login/lỗi | SV1 |
| `css/responsive.css` | Reflow shell và component/layout chung | SV1 |
| `js/main.js` | Điểm khởi tạo duy nhất, await auth/repository/page, xử lý route/lỗi | SV2 |
| `js/common/layout.js` | Dựng header/sidebar/menu theo current user, listener chung một lần | SV2 |
| `js/config/roles.js` | Role labels/menu/trang mặc định theo ma trận chính | SV2 |
| `js/config/routes.js` | Đủ route 18 trang, layout/public/allowedRoles/lazy loader | SV2 |
| `js/config/app.js` | Chế độ preview/mock/API, cấu hình dùng chung không có bí mật | SV2 |
| `js/common/permissions.js` | Contract và kiểm tra route/action/field ở mức preview | SV2 |
| `AGENTS.md`, `README.md`, bảng màn hình/phân công | Điều phối cập nhật; mỗi người tự ghi task/minh chứng mình | SV1 và SV2 |

Không nhận việc làm hết CSS trang/responsive riêng của SV1/SV2. Khi tích hợp thấy lỗi ở trang nào, owner trang sửa; SV3 sửa đúng lỗi common do mình phụ trách hoặc patch được phối hợp.

## 4. Yêu cầu riêng từng màn hình

### UI-13 — Quản lý hành trình HR

- Dựng toolbar, danh sách journey, vùng bước/chi tiết và form theo thiết kế; dùng card/table/form/badge chung.
- Tách mẫu `journeys` và việc gán `journeyAssignments`. Không gắn progress cố định của từng người vào mẫu hành trình.
- Form tạo/sửa mẫu hành trình dùng cùng cấu trúc. Gán nhân sự/chỉnh bước/lưu trữ chỉ dựng theo giao diện đã chốt; thao tác ghi đầy đủ làm ở đợt sau.
- Đối tượng chọn bằng `journeyId`, `newHireId`, `journeyAssignmentId`; không dùng tên nhân sự/hành trình làm khóa.
- Các bước/assignment sẽ nối với tasks của Mentor và checklist Newhire bằng cùng IDs. Không xây một kho task riêng cho HR.

### UI-14 — Dashboard HR và AI Progress Risk

- Dựng card thống kê, bộ lọc, biểu đồ/bảng tiến độ và khu vực rủi ro theo thiết kế; dùng stats-grid/stat-card/progress/ai-panel chung.
- Số liệu lấy từ seed/repository/selector chung, cùng công thức với Mentor/Newhire; không nhập một bộ tỷ lệ tiến độ riêng cho biểu đồ.
- Tìm/lọc nhân sự, mở chi tiết trong page/modal đúng thiết kế. Không tạo một HTML hồ sơ HR để xem người khác hoặc dùng profile tự phục vụ làm trang quản lý nhân sự.
- AI risk có input/đang xử lý/kết quả/lý do và Chấp nhận/Sửa/Từ chối/Tạo lại/Lưu; có trạng thái thiếu dữ liệu/thất bại. Cảnh báo AI là draft, chưa tự ghi can thiệp vào kho.
- Thống kê tính toàn bộ bản ghi trong scope trước phân trang; không suy tổng từ những hàng đang hiển thị.

### UI-15 — Phòng ban

- Dựng toolbar, bảng, chi tiết và form thêm/sửa theo thiết kế. Hai chế độ dùng cùng form và field theo departments schema.
- ID phòng ban giữ nguyên khi đổi tên. Users/journeys/tài liệu tham chiếu ID, không giữ các tên phòng ban riêng cần sửa tay tại từng trang.
- Chuẩn bị validation và confirm archive/delete phù hợp ảnh. Nếu bản ghi đang được tham chiếu, vùng UI có thể báo lý do không thể thực hiện theo quy tắc được chốt.
- Không tự xóa dây chuyền user/task/journey hoặc đổi phòng ban tất cả tài khoản khi bấm nút ở bản UI.
- Dữ liệu dropdown/bộ lọc về sau đọc cùng departments, không giữ một mảng HR và một mảng Admin.

### UI-16 — Tài khoản

- Dựng bảng và bộ lọc role/status/phòng ban; form quản lý và confirm vô hiệu hóa/khôi phục theo ảnh.
- Form thao tác bản ghi `users.id`; `role` thuộc tập bốn giá trị trong quy tắc chính, department lấy ID của kho chung.
- Form quản lý người khác nằm tại trang này; không copy `profile.html`, không gọi `updateMyProfile` để cập nhật user đang chọn trong bảng.
- Cho xem preview trường quản lý theo quyền Admin; dữ liệu thật/validation nghiệp vụ/trạng thái sẽ nối repository ở đợt sau.
- Thay tài khoản/role/phòng ban về sau phải phản ánh đúng khi auth/layout/profile tải lại; không làm một bản user riêng cho header của Admin.
- Nút bị ẩn không thay kiểm tra quyền. Patch fields/capability giữ cùng hợp đồng của permission/repository.

### UI-17 — Cài đặt

- Dựng các nhóm form cấu hình theo ảnh, dùng card/form/tabs/button chung; không tự thêm module ngoài thiết kế.
- Mỗi field khớp schema settings được nhóm chốt, bản ghi có `id: 'system'`. Field mới góp vào hợp đồng/seed với SV2, không đổi tên riêng trong page.
- Có validation, draft và Hủy; action reset/khôi phục có confirm nếu thiết kế có. Chưa có persistence thì không báo cấu hình đã áp dụng cho toàn hệ thống.
- Không đặt API key/password/token trong trang cài đặt hoặc code frontend. Không tự gọi dịch vụ thật từ nút preview.

### UI-18 — 404

- Dựng HTML dùng simple-layout chung và error component do SV2 duy trì; `data-page='404'`, prefix `error-page`, cùng button/logo/font với 403.
- Nạp cùng `error.css` và `error.js`; cấu hình/nội dung nhận biết qua pageId, không chép hai file rồi đổi con số.
- Nút về login/trang mặc định theo phiên; thao tác quay lại hợp lý khi history không có trang ứng dụng trước đó.
- 404 là public và không gây vòng chuyển hướng quyền. Bản ghi thiếu trong một trang xử lý state phù hợp theo quy tắc chính, không tự tạo thêm các trang lỗi.

## 5. Quy tắc shell, route và quyền

- Giữ template và điểm mount ở `AGENTS.md` mục 5: header/sidebar/main/modal/toast. Layout điền vào mount, không tạo DOM khung trùng lặp.
- `main.js` là script HTML duy nhất. Trình tự: route → current user → kiểm tra quyền → repository gắn user → render shell → await `initPage(context)`; có đầu mối bắt lỗi.
- `context` chính xác là `{ currentUser, repository, permissions, ui, pageId }`. Không thêm role/user giả cho mỗi page; page module không import ngược main.
- `ROUTES` có đủ 18 key trùng data-page, giữ `{ public, allowedRoles, layout, loadPage }`. Login/403/404 public; page loader lazy import đúng JS module, hai lỗi cùng loader module error.
- Giữ trang mặc định từ quy tắc chính: Newhire → onboarding dashboard, Mentor → mentee list, HR → HR dashboard, Admin → user management. Không thêm admin dashboard thứ 19 để sửa link mặc định.
- Menu của cả bốn role có profile; link library theo role. HR/Admin/Mentor mở `hr-document-library.html`, Newhire mở `newhire-document-library.html`. Detail/backlink không cố định HR.
- Role quyết định capability, user ID và quan hệ quyết định scope. Admin không mặc định được mở tất cả trang HR/Mentor; dùng ma trận quyền chính.
- `canOpenPage`, `can`, `getEditableFields` giữ chữ ký ở quy tắc chính. Phối hợp SV2 để repository kiểm tra quan hệ thật từ kho, không tin role/mentor ID gửi từ form/URL.
- Chưa có phiên chuyển login; có phiên thiếu quyền chuyển 403; route thiếu xử lý 404. Public error routes vẫn chạy khi user null.
- `layout.js` quản lý action toggle-sidebar/logout chung; page không bắt lại event đó. Khi user đổi, dùng cơ chế auth của SV2 và tải lại dữ liệu/layout, không giữ hồ sơ phiên trước.

## 6. CSS và responsive thống nhất

- `layout.css` chỉ viết block công khai như `app-shell`, `app-header`, `app-sidebar`, `app-nav`, `app-main`, `page-header`, `content-grid`, `stats-grid`, `simple-layout` trong registry.
- Không đặt lại button/card/input/table/modal của SV1. Thêm khoảng cách/layout riêng không được tạo một bộ Admin component khác.
- CSS trang scope theo marker/prefix, ví dụ `.page--hr-dashboard .hr-dashboard__chart`. Form, table, badge và AI card bên trong vẫn dùng class chung.
- Breakpoint đúng quy tắc chính: max-width 1023px và 767px. `responsive.css` xử lý phần common; owner trang xử lý layout đặc thù ở CSS riêng với cùng breakpoint.
- Sidebar drawer, toolbar/card/grid, table-wrap và modal phải dùng được ở 1440/768/390px. Không làm toàn body cuộn ngang; không tạo thêm HTML mobile.
- Không gom 18 trang vào responsive.css hoặc chồng override cho từng người. Nếu component gốc sai, sửa đúng nguồn với owner; không dùng `!important` ở trang.
- Các marker/prefix chỉ là namespace cho phần cần style riêng. Không tạo class rỗng/utility số pixel/reset/token lặp để tăng số lượng file.

## 7. Điểm nối dữ liệu với SV1/SV2

- Page UI chỉ gọi repository qua context. Không fetch seed/API, đọc/ghi storage hoặc tạo mảng users/departments/journeys riêng trong page.
- Thực thể chủ yếu là users, departments, journeys, journeyAssignments, newHires, tasks, settings. Giữ ID/field/status theo quy tắc chính và cùng seed với SV2.
- Field/dropdown mới được bổ sung contract và seed qua PR, không sửa schema một phía để form chạy trước.
- Header/profile của SV1 đọc cùng users mà trang quản lý tài khoản sẽ cập nhật; library/detail do SV2 đọc cùng documents được HR/Admin quản lý.
- Nối mock → API bằng adapter/cấu hình chung về sau; HTML/form/render không chứa endpoint hoặc mapping response riêng của Admin.
- Dashboard tính qua selector/service chung, không đọc text DOM từ dashboard của người khác. Cùng task ID/status sẽ phản ánh tiến độ Newhire/Mentor/HR sau khi data được nối.

## 8. Trình tự tích hợp và review

1. Làm `CORE-02`: skeleton/layout/main/role/route và config preview. Phối hợp SV1 vocabulary CSS, SV2 user/repository/UI contracts; kiểm tra bộ khung tại CORE-04.
2. Triển khai UI-18 theo error module SV2; làm UI-15/UI-16/UI-17 và UI-13/UI-14 theo phụ thuộc của thiết kế, không tự tạo các trang chung thay owner khác.
3. PR shell/main/config/quyền được SV2 review; PR layout/responsive chung được SV1 review; page của SV3 được SV1 review.
4. SV3 review page/repository/auth/error của SV2 và CSS chung của SV1 theo bảng chính. Mỗi người sửa lỗi phần mình sau kiểm tra tích hợp.
5. Tích hợp vào dev, kiểm tra menu/link/role/data/viewport chung rồi mới đưa bản ổn định sang main theo quy trình nhóm. Không force-push/reset hoặc chọn nguyên ours/theirs khi mất route/class của người khác.
6. Điều phối README/bảng màn hình/phân công; SV1/SV2 tự cập nhật task, AI usage và OBS của họ. Không nhận thay mọi minh chứng.

## 9. Điều kiện bàn giao

- Đúng sáu trang, đủ route 18 trang; không có profile/login/library/error hoặc bộ data bị nhân bản theo role.
- Cùng token/class/component, shell chỉ khởi tạo một lần; menu và active item đúng current user.
- Form/modal/validation/filter/AI state có hành vi preview rõ ràng; Hủy không đổi kho; không báo lưu/reset đã chạy nếu chưa có persistence.
- ID của user/phòng ban/journey/assignment liên thông; số liệu dashboard từ dữ liệu chung, không từ bộ phần trăm riêng.
- Thử profile/library/detail bằng từng role, public error khi không có phiên, URL không có quyền, ID không tồn tại.
- Kiểm tra 1440/768/390px, bảng/modal/drawer/keyboard, console/tài nguyên và các trang bị ảnh hưởng bởi CSS/JS chung.
- PR ghi file chung/class/schema/contract thay đổi, cách thử và phần chờ data; các task/AI usage/OBS theo bảng được duyệt.
- Việc triển khai/publish website chỉ tiến hành khi có nhiệm vụ đó của nhóm; đợt này tập trung giao diện và tích hợp source.

## 10. Lệnh giao việc cho Codex của SV3

> Đọc AGENTS.md ở gốc repo và docs/rules/SV3-RULES.md. Tôi là SV3, thực hiện [CORE-02 hoặc UI-13…UI-18/tên task] theo thiết kế kèm. Làm HTML/CSS/JS và responsive cho HR/Admin hoặc shell được giao, giữ đúng route/context/quyền và class của quy tắc chính. Tái sử dụng profile/login của SV1, library/detail/error/helper/repository của SV2; không tạo bộ component/data riêng cho Admin. Chỉ làm giai đoạn giao diện và các điểm nối cần thiết. Kiểm tra tích hợp với phần hai người còn lại, báo file đã đổi, component dùng lại, cách thử và phần còn preview.
