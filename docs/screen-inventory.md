# Bảng màn hình UI

## Trạng thái tích hợp ngày 19/10/2026

| Owner | Trang/task | Kết quả |
|---|---|---|
| SV1 | UI-01–06 | Dashboard/checklist, Q&A, thư viện, đăng nhập mật khẩu và profile dùng dữ liệu chung |
| SV2 | UI-07–09 | Mentee theo quyền, task/check-in CRUD; checklist AI mô phỏng, duyệt và áp dụng có thể thử lại |
| SV2 | UI-10–12 | HR/Admin quản lý tài liệu, Mentor đọc; detail theo ID/quyền; 403 dùng module lỗi chung |
| SV3 | UI-13–14 | Quản lý journey và gán hồ sơ; dashboard/Progress Risk; quản lý công ty/tin tức |
| SV3 | UI-15–17 | CRUD phòng ban/tài khoản, cấu hình được lưu, reset có xác nhận; dùng chung quản lý công ty/tin tức |
| SV3 | UI-18 / UI-PUBLIC | 404 dùng module chung; index đọc tin published và company-001 |

Đủ 19 route, không có admin-company-info/admin-news-management riêng. Kiểm tra 57 lượt trang/viewport ở 1440, 768, 390px không thấy lỗi tải, ID DOM trùng hoặc tràn ngang. 16 luồng thao tác trình duyệt đã đạt. Kiểm tra bổ sung 42 ca hồi quy trên users snapshot đã commit và ba luồng lỗi/đăng nhập trên trình duyệt đạt. Nguồn duy nhất hiện là 12 JSON assets/data; npm run check báo cụ thể lỗi/cảnh báo seed. Kết quả seed hiện tại phụ thuộc việc người dùng sửa ID trùng; xem báo cáo AI. Những bảng phía dưới mô tả các đợt cũ.

## Trạng thái tích hợp ngày 18/10/2026

| Phạm vi | Trạng thái hiện tại |
|---|---|
| UI-01 / UI-02 | Đọc hire theo userId; task và tiến độ từ dịch vụ chung; đổi trạng thái lưu LocalStorage |
| UI-03 | Policy Q&A tra cứu mock, nguồn theo quyền; lưu/sửa/chấp nhận/từ chối/tạo lại/xóa lịch sử riêng |
| UI-04 / UI-11 | Thư viện và detail đọc documents thật theo ID/quyền; tệp đính kèm chưa được cung cấp |
| UI-05 / UI-06 | Email + password của users.json, phiên userId; profile bốn role, tự sửa fullName/email |
| UI-PUBLIC | Tin published, tìm/lọc/phân trang/chi tiết; sứ mệnh từ company-001 |
| Shell / 403 / 404 | Guard role từ tài khoản active, đăng xuất và thay đổi phiên giữa các tab |
| Các trang SV2/SV3 còn lại | Bố cục tĩnh; nghiệp vụ CRUD/Checklist Personalizer/Progress Risk chưa nối |

Các bảng và ghi chú ngày 15/10/2026 trở xuống là lịch sử. Kiểm tra kỹ thuật của đợt này ghi trong báo cáo AI; chưa phải nghiệm thu toàn bộ BTL.


> Cập nhật 15/10/2026: giữ đủ 19 màn hình và phân công; các màn hình hiện hiển thị nội dung tĩnh trong HTML. Tìm/lọc, modal, form và shell chạy bằng JS thuần. Các ghi chú về repository/seed/AI ở bảng cũ bên dưới là lịch sử trước đợt dọn; không còn là trạng thái runtime. Không còn ảnh tham chiếu hay bộ test cũ trong repository.

Shell/UI-17 cập nhật theo yêu cầu 07/10/2026: logo header toggle sidebar trên cả bốn vai trò; bỏ hamburger/dấu X/sidebar header trùng. Desktop thu gọn mở rộng nội dung, mobile drawer giữ bàn phím/Escape. UI-17 chuyển sang thông tin tổ chức, quy tắc hội nhập, tổng quan kho quản trị và liên kết trang hiện có; không còn form câu trả lời AI mẫu.

UI-PUBLIC điều hướng theo vị trí cuộn: màu primary và gạch chân chuyển động khi hover/focus/active; `is-active` đồng bộ `aria-current="location"`. Dùng anchor thật, giảm chuyển động theo prefers-reduced-motion. Desktop Thông báo/Sự kiện cùng hàng giữ mục người dùng vừa chọn; mobile theo thứ tự section dọc.

UI-PUBLIC bổ sung: header sticky giữ logo/menu khi cuộn. Mobile dùng cùng DOM, header hai hàng (logo/đăng nhập và bốn liên kết), tìm kiếm tại phần Tin tức; breakpoint 1023/767px, có khoảng cuộn tránh tiêu đề bị header che.

Bổ sung 07/10/2026 — `UI-PUBLIC`: root `index.html`, route public, marker `page--index`, prefix `index`, `css/pages/index.css` + `js/pages/index.js`. Theo ảnh “Onvera · Tin tức & Thông báo” do người dùng cung cấp; SV3 điều phối tích hợp và owner file chung review. Ngoài 18 trang nghiệp vụ bên dưới; chưa phân lại sáu task mỗi người. Dùng modal chung cho tin/thông báo/lịch/FAQ/footer; nút đăng nhập đi `pages/login.html`. Ảnh bài viết đang dùng icon thay thế, dữ liệu tối thiểu chờ nối API.

Theo phân công trong AGENTS.md. Mỗi màn hình vẫn có cùng owner; các biến thể role/modal không tính thành HTML riêng.

| Task | Owner | Trang | Phạm vi sử dụng | Trạng thái tích hợp |
|---|---|---|---|---|
| UI-01 | SV1 | newhire-onboarding-dashboard.html | Newhire | Render và dữ liệu đọc chung |
| UI-02 | SV1 | newhire-checklist.html | Newhire | Lọc, chi tiết, kết quả draft |
| UI-03 | SV1 | newhire-ai-help.html | Newhire | Q&A/nguồn/ghi chú preview |
| UI-04 | SV1 | newhire-document-library.html | Newhire | Documents đã phát hành trong scope |
| UI-05 | SV1 | login.html | Public | Chọn user demo/validation/modal |
| UI-06 | SV1 | profile.html | Bốn role | Chính mình, ba field tự sửa |
| UI-07 | SV2 | mentor-mentee-list.html | Mentor | Thống kê/lọc/chi tiết đúng scope |
| UI-08 | SV2 | mentor-checkin-note.html | Mentor | Form chung, ngày giờ UTC/draft |
| UI-09 | SV2 | mentor-task-assignment.html | Mentor | Giao việc/AI checklist draft |
| UI-10 | SV2 | hr-document-library.html | HR/Admin/Mentor | Quản lý preview hoặc chỉ đọc theo quyền |
| UI-11 | SV2 | document-detail.html | Bốn role đủ quyền | ID, nội dung, mục lục, backlink |
| UI-12 | SV2 | 403.html | Public | Module error dùng chung |
| UI-13 | SV3 | hr-journey-management.html | HR | Mẫu hành trình/assignment/draft |
| UI-14 | SV3 | hr-dashboard.html | HR | Thống kê/AI risk draft |
| UI-15 | SV3 | admin-department-management.html | Admin | Form/chi tiết/cảnh báo tham chiếu |
| UI-16 | SV3 | admin-user-management.html | Admin | Form/lọc/quyền field/draft |
| UI-17 | SV3 | admin-system-settings.html | Admin | Quản lý hệ thống: thống kê, tổ chức/hội nhập, preview/validation/Hủy/khôi phục |
| UI-18 | SV3 | 404.html | Public | Cùng CSS/JS lỗi với 403 |

Đã kiểm tra 19 màn hình ở 1440/768/390px sau khi chuyển sang HTML tĩnh. Chưa tích hợp đăng nhập, CRUD, API hoặc AI.
