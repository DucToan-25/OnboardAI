# OnboardAI

Website ở giai đoạn giao diện, dùng HTML5, CSS và JavaScript thuần (ES modules). Giữ nội dung tĩnh của thiết kế trong HTML; chưa có dữ liệu nghiệp vụ, đăng nhập, backend hoặc AI thật.

## Chạy dự án

Từ thư mục gốc, dùng Node.js:

```powershell
node scripts/serve.cjs
```

Mở http://127.0.0.1:8000/ để xem trang chủ. Có thể đổi cổng bằng `node scripts/serve.cjs 8080`. Dừng server bằng Ctrl+C; không mở bằng file:// vì JavaScript dùng ES modules.

Mở trực tiếp các màn hình theo vai trò:

- Nhân sự mới: [Tổng quan](pages/newhire-onboarding-dashboard.html).
- Mentor: [Danh sách mentee](pages/mentor-mentee-list.html).
- HR: [Tổng quan nhân sự](pages/hr-dashboard.html).
- Admin: [Quản lý tài khoản](pages/admin-user-management.html).
- Dùng chung: [Đăng nhập](pages/login.html), [Hồ sơ](pages/profile.html).

Sidebar dẫn tới các màn hình còn lại. Tham số `?role=mentor`, `?role=hr` hoặc `?role=admin` chỉ chọn menu của trang dùng chung, không phải xác thực hay cấp quyền.

## Phạm vi giao diện

- 19 trang: trang chủ và 18 màn hình nghiệp vụ, một bộ CSS/component/header/sidebar.
- Nội dung card, bảng, form và tài liệu là HTML tĩnh. Không tải seed, không có repository giả hoặc tài khoản demo.
- Logo đóng/mở sidebar; modal hỗ trợ bàn phím/Escape; tìm kiếm và bộ lọc hoạt động trên nội dung đang có trong HTML.
- Biểu mẫu kiểm tra trường nhập; Hủy/khôi phục trả nội dung ban đầu. Đăng nhập, lưu, xóa và AI báo chưa kết nối dữ liệu, không giả thành công.
- Giữ logo/avatar/icon trong `assets/`. Ảnh tham chiếu, ảnh chụp kiểm thử, cache trình duyệt, seed và các script test cũ đã được dọn.

Quy tắc nằm ở [AGENTS.md](AGENTS.md), [quy tắc từng thành viên](docs/rules/) và [bảng màn hình](docs/screen-inventory.md). [Hợp đồng dữ liệu](docs/data-contract.md) là tài liệu cho đợt tích hợp sau; [báo cáo AI](docs/ai-usage-report.md) ghi các thay đổi đã hỗ trợ.
