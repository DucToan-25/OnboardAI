# AI hỗ trợ — bản giữa kỳ CSE122

AI được dùng để đối chiếu `KiemTraGiuaKi.md`, rút gọn code và hướng dẫn cách đọc. Theo đề, sinh viên phải tự hiểu, chạy thử, trình bày và sửa được lỗi cơ bản; không coi file này là minh chứng đã tự trình bày.

Thay đổi trong bản `Onvera`:

- Giữ trang tin Onvera, dữ liệu minh họa OnboardAI và các thao tác công khai.
- Rút từ 16 file JavaScript xuống 3 file, từ 5 CSS xuống 1 CSS chỉ dành cho trang.
- Bỏ router, auth, phân quyền, repository/adapter, cache nội dung, đồng bộ nhiều tab và bộ test cũ khỏi bản nộp.
- Dùng template HTML, DOM/textContent, sự kiện, mảng/object, JSON và một khóa localStorage.
- Dùng dialog của trình duyệt thay cho stack modal tự quản lý; xóa lựa chọn dùng confirm cơ bản.
- Bổ sung mục bắt buộc của README và dàn ý video 3 phút. Chưa có link Figma/GitHub/video thực tế.

Đã kiểm tra bản rút gọn bằng Chrome headless ngày 14/10/2026:

- Render đủ dữ liệu, một CSS; không tràn ngang ở 1440/768/390px.
- Tìm có/không dấu, không có kết quả, lọc, sắp xếp và phân trang; bộ lọc giữ sau tải lại.
- Dialog mở/đóng bằng nút và Escape; số thông báo chưa đọc thay đổi khi đọc.
- Lưu bài/quan tâm sự kiện rồi tải lại vẫn còn; sự kiện đã diễn ra không cho thêm quan tâm mới.
- Xóa lựa chọn: thử cả Hủy và xác nhận.
- Nội dung yêu cầu đăng nhập chỉ có phần giới thiệu; nút cổng nhân viên có hướng dẫn và không dẫn tới file thiếu.
- localStorage hỏng/bị chặn không làm trang ngừng chạy; lỗi tải JSON có thông báo và nút Thử lại hoạt động.
- Không có exception JavaScript chưa xử lý hoặc HTTP 404 trong luồng bình thường.