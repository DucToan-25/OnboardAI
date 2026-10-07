# Bảng màn hình UI

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

Kiểm tra tích hợp xem [ui-validation.md](ui-validation.md). 18 trang đã dựng và kiểm tra render/responsive ở mức UI; chưa đánh dấu hoàn thành CRUD/API/AI nghiệp vụ hoặc bàn giao BTL. Thiết kế đủ 18 frame, owner review và OBS cần nhóm bổ sung. Các ảnh tham chiếu hiện có được giữ trong design/references.
