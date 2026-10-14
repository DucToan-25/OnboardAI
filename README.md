# OnboardAI — Cổng thông tin công ty Onvera

Bài kiểm tra giữa kỳ **CSE122 – Phát triển ứng dụng Web cơ bản**. Thực hiện **một trang chính**: trang tin tức, thông báo và sự kiện công ty, dựa trên đề tài hội nhập nhân sự OnboardAI. Đối tượng: nhân sự mới và người muốn tìm hiểu công ty.

Onvera và lịch hoạt động là dữ liệu minh họa cho dự án. Bản này được rút gọn theo [đề giữa kỳ](KiemTraGiuaKi.md); chỉ thay đổi trong `index-only`, không thay kiến trúc của website nhóm ở bên ngoài.

## Thông tin nộp bài — sinh viên cần điền

| Nội dung | Thông tin |
| --- | --- |
| Họ tên / mã sinh viên | Chưa cung cấp — cần điền |
| Link Figma Desktop và phương án Mobile | Chưa cung cấp — cần bổ sung link có quyền xem |
| Link GitHub cá nhân | Chưa cung cấp — cần tạo repository cá nhân và điền link |
| Link video trên Channel học phần | Chưa cung cấp — cần quay, upload rồi điền link |

Chưa thể xác nhận độ khớp Figma khi chưa có bản thiết kế. Code và kiểm tra chạy được không thay thế ba link nộp bài.

Bộ giao diện SVG + PNG để nhập Figma nằm trong [giao-dien](giao-dien/): trang chủ máy tính/điện thoại và bốn trạng thái tương tác của cùng trang. Xem [hướng dẫn nhập Figma](<giao-dien/Hướng dẫn nhập Figma.md>). Đây là file cục bộ; vẫn cần đưa vào Figma và điền link chia sẻ ở bảng trên.

## Chạy trang

1. Mở thư mục `index-only` trong VS Code.
2. Dùng **Live Server** mở `index.html`. Không cần npm, framework hoặc build.
3. Nếu đang mở cả dự án nhóm, chạy `node scripts/serve.cjs` tại thư mục gốc rồi mở http://127.0.0.1:8000/index-only/index.html.

Cần HTTP/Live Server vì JavaScript đọc file JSON bằng `fetch`. Không mở bằng `file://`. Khi nộp GitHub cá nhân, đưa **nội dung bên trong** `index-only` lên repo; trang không cần các file bên ngoài để chạy.

## Chức năng chính

- Render 12 tin tức, 6 thông báo, 7 sự kiện từ JSON.
- Tìm kiếm có/không dấu, lọc danh mục, sắp xếp và phân trang.
- Xem chi tiết và thông tin công ty trong một modal.
- Lưu/bỏ lưu bài, ghi nhận đã đọc, quan tâm/bỏ quan tâm sự kiện.
- Xem lịch sắp diễn ra/đã diễn ra và danh sách đã lưu.
- Giữ lựa chọn bằng localStorage; xóa có xác nhận.
- Responsive tại 1023px và 767px; tìm kiếm mobile nằm trong mục Tin tức.

Nút **Đăng nhập/Vào cổng nhân viên** mở hướng dẫn, không xác thực tài khoản. Nếu nhóm có cổng nhân viên thật, điền URL vào `EMPLOYEE_PORTAL_URL` ở đầu `js/main.js`. Khi chưa có, để trống để bản nộp độc lập không có liên kết hỏng. Quan tâm sự kiện không phải đăng ký tham dự.

## Công nghệ và cấu trúc

HTML5, CSS3, JavaScript thuần, JSON, localStorage. Không backend/database, router, phân quyền, framework hoặc AI API.

```text
index-only/
├── index.html              # Semantic HTML, form, template, dialog
├── css/style.css           # Màu, thành phần, Grid/Flex và media query
├── js/main.js              # Render và các sự kiện của trang
├── js/data.js              # Đọc JSON, đọc/ghi localStorage
├── js/ui.js                # Mở/đóng dialog, thông báo, tạo DOM
├── assets/data/seed.json   # Nội dung công ty
├── assets/images/          # Logo dùng chung từ dự án
├── assets/icons/           # SVG dùng chung từ dự án
├── docs/                   # Mô tả dữ liệu và AI hỗ trợ
├── KiemTraGiuaKi.md        # Đề gốc, giữ nguyên
└── README.md
```

Chỉ có **3 file JS và 1 file CSS**. Code giữ token và class phù hợp giao diện nhóm nhưng bỏ các phần dành cho 18 trang nội bộ. Các helper cũ, cache nội dung, đồng bộ nhiều tab và bộ kiểm thử của kiến trúc cũ đã được bỏ khỏi bản nộp.

## Cách đọc và giải thích code

Đọc theo thứ tự `index.html → style.css → main.js → data.js → ui.js`.

| Phần code | Giải thích ngắn |
| --- | --- |
| HTML: header/nav/main/section/footer | Chia trang thành các vùng có ý nghĩa |
| HTML: template | Mẫu card/hàng; JS sao chép rồi điền dữ liệu, không lặp sẵn 25 bài |
| CSS: :root | Màu và khoảng cách dùng lại, đổi một nơi áp dụng nhiều vùng |
| CSS: Grid/Flex | Chia cột nội dung và xếp các nút/menu |
| CSS: media query | Đưa bố cục về một cột và thu gọn header khi màn hình nhỏ |
| main.js: phần 1 | Mảng posts, object settings và các hàm nhỏ |
| main.js: renderNews | filter → sort → slice → clone template → textContent |
| main.js: showPost/showSaved/showCalendar | Tạo nội dung cho một dialog dùng chung |
| main.js: handleClick | Đọc data-action để biết nút nào được bấm |
| main.js: toggleItem | Dùng includes/push/filter để thêm hoặc bỏ ID trong mảng |
| main.js: init | Chờ JSON tải xong, đọc lựa chọn, render rồi gắn sự kiện |
| data.js | fetch đọc JSON; JSON.parse/stringify đổi giữa object và chuỗi localStorage |
| ui.js | showModal/close mở đóng dialog; textContent hiển thị thông báo |

`import/export` chỉ giúp chia ba file theo nhiệm vụ. `async/await` dùng để chờ đọc file JSON trước khi render. `dialog.showModal()` sử dụng chức năng có sẵn của trình duyệt để giữ focus và đóng bằng Escape, tránh phải tự viết hệ thống modal.

Luồng mẫu: người dùng nhập “mentor” → sự kiện input gọi updateFilters → renderNews lọc mảng → hiển thị bài phù hợp → bấm Lưu bài → thêm ID vào savedIds → JSON.stringify lưu localStorage → tải lại vẫn thấy bài trong Đã lưu.

## Kiểm tra thủ công trước khi nộp

1. Trang tải được dữ liệu và Console không có lỗi JavaScript.
2. Gõ “hoi nhap”, lọc danh mục, đổi sắp xếp, chuyển trang; thử từ khóa không tồn tại.
3. Mở thông báo, đóng bằng nút hoặc Escape; số chưa đọc giảm.
4. Lưu bài, tải lại, mở Đã lưu; bỏ lưu và kiểm tra lại.
5. Mở lịch, xem sự kiện cũ/mới; quan tâm một sự kiện chưa bắt đầu rồi tải lại.
6. Xóa dữ liệu: thử Hủy trước, sau đó xác nhận; chỉ lựa chọn của trang này bị xóa.
7. Thu màn hình về 768px và 390px; không tràn ngang, modal và nút vẫn dùng được.
8. So với Figma của bạn, điền ba link nộp bài và tự giải thích từng phần chính.

Đây là bài một trang. Không cần học bộ test Node/CDP hoặc hệ repository của phiên bản trước.

## Dàn ý video khoảng 3 phút

- **0:00–0:30:** tên, đề tài OnboardAI, trang Onvera, đối tượng và mục đích.
- **0:30–1:00:** mở Figma; giới thiệu header, tin tức, thông báo, sự kiện và phương án mobile.
- **1:00–1:30:** mở sản phẩm; chỉ bố cục tương ứng với Figma.
- **1:30–2:30:** mở HTML semantic/template, CSS Grid/media query, JS renderNews và sự kiện tìm kiếm.
- **2:30–3:00:** tìm “mentor”, mở bài, lưu bài và tải lại để chứng minh localStorage.

Tên video theo đề: `CSE122-GK-SVxx-TenSinhVien-TrangThongTinOnvera`. Thay mã và tên thật, upload đúng Channel của học phần rồi điền link ở đầu README.
