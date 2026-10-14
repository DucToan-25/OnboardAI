# Dữ liệu dùng trong bài giữa kỳ

Bản một trang theo yêu cầu mới của người dùng và `KiemTraGiuaKi.md`. Schema bài viết kế thừa đề tài OnboardAI; không cần repository hoặc quyền truy cập của toàn hệ thống.

## JSON: nội dung công ty

`assets/data/seed.json` chứa:

- `organization`: tên/giới thiệu công ty, các bước hội nhập, nội dung giới thiệu/liên hệ/FAQ.
- `portalPosts`: 25 bản ghi tin tức, thông báo và sự kiện.
- `schemaVersion`, `contentVersion`: thông tin phiên bản của dữ liệu nguồn; bài cơ bản không có cơ chế nâng cấp schema.

Mỗi bài có `id`, `kind`, `title`, `summary`, `content`, `publishedAt`, `publisher`, `status`, `visibility`, `requiresLogin`.

- News: thêm `category`, `readMinutes`.
- Notice: thêm `label`, `important`.
- Event: thêm `eventDate`, `startsAt`, `location`. Ngày eventDate khớp startsAt theo giờ Việt Nam.
- Chỉ hiển thị `published` và `public`. Với requiresLogin, chỉ hiện giới thiệu.
- Không đặt dữ liệu nội bộ, mật khẩu hoặc hồ sơ cá nhân vào JSON công khai. Bộ lọc JavaScript không phải cơ chế bảo mật.
- Muốn thêm bài: sao chép một object cùng loại, đặt ID mới không trùng và điền các trường tương ứng.

## localStorage: lựa chọn của người xem

Một khóa: `onvera-midterm-preferences`.

```json
{
  "search": "",
  "category": "all",
  "sort": "newest",
  "page": 1,
  "readIds": [],
  "savedIds": [],
  "interestedIds": []
}
```

`loadSettings(posts)` đọc chuỗi, JSON.parse rồi kiểm tra kiểu cơ bản. `saveSettings(settings)` dùng JSON.stringify và setItem; trả false nếu trình duyệt không cho lưu. Trang vẫn dùng object trong bộ nhớ.

Không lưu bản sao nội dung công ty, không đồng bộ giữa thiết bị/tab và không quản lý đăng nhập. Các khóa cache/preferences của bản nâng cao trước đây không còn được sử dụng hoặc tự động chuyển đổi. Khi chạy bản giữa kỳ lần đầu, lựa chọn bắt đầu từ mặc định; không xóa khóa dữ liệu khác.

Mỗi lần mở trang: đọc JSON → chỉ lấy bài công khai → đọc lựa chọn → render. Khi có thao tác: sửa settings → lưu → render lại. Nếu JSON không tải được, hiện lỗi và nút Thử lại; nếu localStorage hỏng, dùng lựa chọn mặc định.

Sự kiện xét theo giờ startsAt thực tế, không tự dịch ngày mẫu. Khi lịch hết hạn, xem Đã diễn ra hoặc cập nhật lịch mẫu trước khi demo.
