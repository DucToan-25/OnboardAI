# CSE122 — Cổng thông tin Onvera

## Thông tin bài làm

| Mục | Thông tin |
| --- | --- |
| Tên đề tài BTL | OnboardAI — hệ thống hỗ trợ hội nhập nhân sự mới |
| Trang thực hiện | Trang chủ cổng thông tin Onvera — Tin tức và thông báo |
| Sinh viên | Nguyễn Đức Toàn |
| Mã sinh viên | 2551969688 |
| Repository GitHub | https://github.com/DucToan-25/onvera-trangthongtin_OnbroadAI |
| Thiết kế Figma | https://www.figma.com/design/j0AmwQikDkrlmCzYHiRk4m/overa?node-id=0-1&t=wNbMBUQPA8GSaGv1-1 |
| Video trình bày | https://www.youtube.com/watch?v=2VKXuFbtWFw |


## Mục đích trang

Cổng thông tin dành cho nhân sự mới và nhân viên OnboardAI, giúp xem tin tức công ty, thông báo quan trọng, sự kiện nội bộ và thông tin hội nhập. Dữ liệu hiện là dữ liệu minh họa lưu trong `assets/data/seed.json`; trang chưa kết nối backend hay đăng nhập thật.

## Chức năng chính

- Tải và hiển thị bài viết công khai từ file JSON; chỉ lấy nội dung có trạng thái `published` và phạm vi `public`.
- Tìm kiếm tin tức theo từ khóa, hỗ trợ tìm cả từ có dấu và không dấu.
- Lọc tin theo danh mục, sắp xếp mới nhất/cũ nhất và chuyển trang.
- Mở hộp thoại xem nội dung bài viết; đánh dấu thông báo đã đọc.
- Lưu/bỏ lưu bài viết và đánh dấu/bỏ quan tâm sự kiện.
- Xem danh sách bài đã lưu, sự kiện quan tâm và lọc lịch theo sự kiện sắp diễn ra/đã diễn ra.
- Ghi nhớ bộ lọc và lựa chọn của người xem bằng `localStorage` trên trình duyệt hiện tại.
- Hiển thị thông báo và nút thử lại khi tải JSON thất bại; vẫn dùng được với lựa chọn trong bộ nhớ nếu trình duyệt chặn `localStorage`.
- Bố cục responsive cho màn hình máy tính và điện thoại.

Các lựa chọn lưu trong `localStorage` chỉ nằm trên trình duyệt đó, không đồng bộ giữa thiết bị và không phải dữ liệu đăng ký sự kiện hay xác nhận nghiệp vụ.

## Công nghệ sử dụng

- HTML5: cấu trúc semantic, biểu mẫu tìm kiếm, template và hộp thoại `dialog`.
- CSS3: biến CSS, Flexbox, Grid, trạng thái hover/focus và media query responsive.
- JavaScript ES Modules: DOM, hàm, mảng/object, sự kiện, tìm kiếm/lọc, render template HTML và xử lý tương tác.
- JSON: nội dung công ty và các bài viết mẫu.
- Web Storage API (`localStorage`): lưu lựa chọn cá nhân trên trình duyệt.
- SVG: biểu tượng giao diện và bản vector tham khảo thiết kế.

Không sử dụng framework, backend, cơ sở dữ liệu hay API bên ngoài.

## Cấu trúc thư mục

```text
index-only/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── data.js
│   └── ui.js
├── assets/
│   ├── data/seed.json
│   ├── icons/sprite.svg
│   └── images/logo-mark.svg
├── docs/
│   ├── ai-usage-report.md
│   └── data-contract.md
└── README.md
```

## Cách chạy

Trang dùng JavaScript ES Modules và `fetch()` để đọc JSON, vì vậy cần mở qua máy chủ HTTP, không mở trực tiếp bằng `file://`.

**Cách 1 — VS Code Live Server:** mở thư mục `Onvera`, nhấn chuột phải vào `index.html` và chọn **Open with Live Server**.

**Cách 2 — Python:** mở Terminal tại thư mục `Onvera`, chạy:

```bash
python -m http.server 8000
```

Sau đó mở `http://localhost:8000` trên trình duyệt.

## Luồng hoạt động chính

1. `index.html` cung cấp cấu trúc trang và các `<template>` cho bài viết/thông báo.
2. `js/main.js` gọi `loadData()` để lấy dữ liệu, khởi tạo trạng thái và gắn sự kiện tìm kiếm, lọc, phân trang, modal, lưu bài và lịch.
3. `js/data.js` tải `assets/data/seed.json`, lọc dữ liệu công khai, đọc/ghi lựa chọn vào `localStorage`.
4. `js/ui.js` tạo phần tử DOM an toàn bằng `textContent`, mở/đóng hộp thoại và hiển thị thông báo.
5. `css/style.css` định dạng giao diện và thay đổi bố cục theo kích thước màn hình.

## Chạy thử chức năng

- Nhập `mentor` hoặc `hoi nhap` vào ô tìm kiếm để xem tìm kiếm có dấu/không dấu.
- Chọn danh mục, đổi thứ tự sắp xếp và chuyển trang.
- Mở một tin để xem chi tiết; thử nút lưu bài và xem mục **Đã lưu & quan tâm**.
- Mở **Xem lịch**, đổi bộ lọc lịch và thử quan tâm một sự kiện sắp diễn ra.
- Tải lại trang để kiểm tra các lựa chọn được giữ trên trình duyệt.
- Thu nhỏ cửa sổ hoặc dùng chế độ thiết bị di động trong DevTools để kiểm tra responsive.

## AI và phạm vi bài làm

AI có hỗ trợ tạo giao diên, code theo, rà soát và kiểm tra cấu trúc code theo yêu cầu.
Sinh viên đọc, rà soát, kiểm tra code. Hiểu và giải thích được phần HTML, CSS, JavaScript mình trình bày. Chi tiết được ghi trong [`docs/ai-usage-report.md`]['docs/ai-usage-report.md'].