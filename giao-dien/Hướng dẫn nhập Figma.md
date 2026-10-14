# Giao diện Onvera — bài giữa kỳ CSE122

Bộ giao diện cho **một trang chính** của đề tài OnboardAI. Tên file và tên giao diện đều bằng tiếng Việt. Mỗi giao diện có hai định dạng cùng tên:

- **SVG:** hình vector và chữ, phù hợp để nhập và chỉnh sửa trong Figma; không phải ảnh PNG nhúng trong SVG.
- **PNG:** ảnh chụp giao diện đang chạy để xem nhanh và đối chiếu.

## Danh sách giao diện

| Tên giao diện | Kích thước | Mục đích |
| --- | --- | --- |
| 01 - Trang chủ - Máy tính | 1440 × 2347 | Bố cục desktop đầy đủ: header, giới thiệu, thông báo, sự kiện, tin tức và footer |
| 02 - Trang chủ - Điện thoại | 390 × 4366 | Phương án responsive: một cột, menu gọn và tìm kiếm trong khu vực tin tức |
| 03 - Tìm kiếm tin tức - Máy tính | 1440 × 2347 | Trạng thái đã nhập từ khóa “mentor”, kết quả và bộ lọc |
| 04 - Chi tiết bài viết - Máy tính | 1440 × 1000 | Modal nội dung công khai, nút Lưu bài và nút Đóng |
| 05 - Lịch sự kiện - Máy tính | 1440 × 1000 | Modal lịch với bộ lọc sắp diễn ra, đã diễn ra và tất cả |
| 06 - Bài đã lưu và sự kiện quan tâm - Máy tính | 1440 × 1000 | Modal có một bài đã lưu, một sự kiện quan tâm, thao tác bỏ lưu/xóa lựa chọn |

**01 và 02 là hai bố cục đáp ứng yêu cầu desktop/mobile của đề.** 03–06 là các trạng thái bổ sung của cùng trang, giúp giải thích tương tác; không phải bốn trang nghiệp vụ mới và không bắt buộc tạo thêm HTML cho chúng.

## Đưa vào Figma

1. Tạo file thiết kế cho bài giữa kỳ trong tài khoản Figma của bạn.
2. Kéo hai file SVG 01 và 02 vào trang thiết kế trước; thêm các file 03–06 để trình bày luồng nếu cần.
3. Đặt tên frame theo tên file tiếng Việt. Giữ chiều rộng desktop 1440 và mobile 390.
4. Chỉnh sửa chữ, màu hoặc vị trí khi cần. Chữ SVG được tách theo dòng; nếu Figma báo thiếu font, chọn font sẵn có rồi đối chiếu PNG để kiểm tra xuống dòng.
5. Có thể nối nút Đọc bài tới giao diện 04, Xem lịch tới 05, Đã lưu & quan tâm tới 06 và nút Đóng về trang chủ. Đây là thao tác tạo prototype trong Figma; SVG không tự chứa các liên kết đó.
6. Chia sẻ file Figma với quyền xem và điền link vào bảng thông tin nộp bài trong `../README.md`.

SVG là bản vector của bố cục đang có, **không phải file `.fig`, không có Auto Layout hay prototype sẵn**. Bộ file này đã được kiểm tra hiển thị trong trình duyệt; chưa được kiểm tra nhập trong tài khoản Figma của bạn. PNG không thay cho file thiết kế và link Figma mà đề yêu cầu.

## Luồng trình bày ngắn

Trang chủ máy tính → nhập “mentor” → xem kết quả → đọc bài → lưu bài → mở mục đã lưu. Sau đó giới thiệu trang chủ điện thoại để giải thích cách chuyển từ hai cột sang một cột.

Màu chủ đạo `#2563EB`, nền `#F5F7FB`, card trắng, chữ `#1E293B`, bo góc 8px. Bố cục giữ nhận diện hiện tại của dự án. Dữ liệu mẫu khi xuất được cố định ngày 14/10/2026 để các ảnh cùng một trạng thái; website thực tế vẫn dùng thời gian hiện tại.

Không có mã ứng dụng mới trong bộ giao diện này. Trang hoạt động vẫn là `../index.html` cùng ba file JavaScript đã rút gọn.
