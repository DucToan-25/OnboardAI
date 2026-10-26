# OnboardAI

OnboardAI là nguyên mẫu frontend hỗ trợ hành trình hội nhập nhân sự mới. Ứng dụng được viết bằng HTML5, CSS3 và JavaScript ES modules, không dùng framework, công cụ build hoặc backend.

Phiên bản hiện tại có 19 route cho bốn vai trò NewHire, Mentor, HR và Admin. Dữ liệu được khởi tạo từ JSON, lưu trong LocalStorage và chỉ được truy cập qua `js/data/store.js`.

README này cung cấp hướng dẫn chạy nhanh. Chi tiết về dữ liệu, màn hình, AI và kiểm thử được duy trì trong các tài liệu ở thư mục `docs/`.

## Chức năng chính

- NewHire theo dõi dashboard, checklist, tài liệu và dùng Policy Q&A.
- Mentor quản lý mentee, task, check-in và dùng Checklist Personalizer.
- HR quản lý hành trình hội nhập, hồ sơ nhân sự, tài liệu và theo dõi Progress Risk.
- Admin quản lý tài khoản, phòng ban, cấu hình hệ thống và dữ liệu demo.
- Các trang đăng nhập, hồ sơ, chi tiết tài liệu, 403 và 404 được dùng chung theo quyền.

Danh sách đầy đủ của 19 route, owner và luồng CRUD nằm trong [bảng màn hình](docs/screen-inventory.md).

## Chạy dự án

Yêu cầu Node.js 20 trở lên. Tại thư mục gốc của dự án, chạy:

```powershell
npm run serve
```

Mở `http://127.0.0.1:8000/` trên trình duyệt. Có thể đổi cổng bằng lệnh:

```powershell
node scripts/serve.cjs 8080
```

Không mở dự án trực tiếp bằng `file://` vì ES modules và các tệp JSON cần được tải qua HTTP.

## Tài khoản demo

Form đăng nhập chấp nhận email hoặc ID cùng mật khẩu trong dữ liệu seed.

| Vai trò | Email | Mật khẩu | Trang mặc định |
|---|---|---|---|
| NewHire | `ndt03012007@example.com` | `@Toan2007` | Onboarding Dashboard |
| Mentor | `phantang03102007@example.com` | `@Tang2007` | Danh sách mentee |
| HR | `vitrungkien2006@example.com` | `@Kien2006` | Tổng quan nhân sự |
| Admin | `admin@example.com` | `admin` | Quản lý tài khoản |

Đây là cơ chế xác thực mô phỏng ở frontend. Mật khẩu nằm trong JSON và LocalStorage nên có thể đọc bằng DevTools. Không sử dụng các giá trị này cho hệ thống thật.

Phiên chỉ lưu `userId`. Vai trò và trạng thái tài khoản luôn được đọc lại từ collection `users`; tham số trên URL không cấp quyền truy cập.

## Dữ liệu và đồng bộ seed

Thư mục `assets/data/` chứa 12 collection JSON canonical. Tệp `assets/data/version.json` lưu version riêng của từng collection.

- Khi version tăng, `initStore()` kiểm tra và thay toàn bộ collection tương ứng trước bước xác thực và render.
- Collection không đổi version giữ nguyên dữ liệu đã thao tác trong trình duyệt.
- Dữ liệu và `onboardai_seedVersions` được ghi trong cùng transaction và được rollback nếu có lỗi.
- Chỉ `js/data/store.js` được truy cập LocalStorage.
- Reset dữ liệu demo chỉ dành cho Admin tại trang Quản lý hệ thống và chỉ tác động đến các khóa `onboardai_*` đã đăng ký.

Schema, quan hệ, enum, quyền và snapshot seed hiện hành nằm trong [hợp đồng dữ liệu](docs/data-contract.md). Quy tắc đồng bộ chi tiết nằm trong [quy tắc LocalStorage](OnboardAI_QuyTac_LocalStorage.md).

## Ba trải nghiệm AI

OnboardAI có ba tính năng AI:

1. Policy Q&A dành cho NewHire.
2. Checklist Personalizer dành cho Mentor.
3. Progress Risk dành cho HR.

Mock Mode là chế độ mặc định và hoạt động không cần mạng hoặc API key. Gemini Mode là tích hợp tùy chọn.

Generate, Edit và Regenerate chỉ tạo draft trong bộ nhớ. Chỉ Save, Accept hoặc Reject mới ghi `aiHistory`. Khi Mentor chấp nhận checklist, history và task được ghi trong cùng transaction với ID ổn định để thao tác thử lại không tạo bản ghi trùng.

API key Gemini chỉ tồn tại trong bộ nhớ của trang và được gửi bằng header `x-goog-api-key`. Key không được lưu vào JSON, LocalStorage, SessionStorage hoặc lịch sử AI. Việc gọi Gemini trực tiếp từ trình duyệt chỉ phù hợp cho bản demo có kiểm soát vì key vẫn có thể xuất hiện trong DevTools Network.

Xem [báo cáo sử dụng AI](docs/ai-usage-report.md) để biết kiến trúc, giới hạn và cách kiểm thử từng chế độ.

## Kiểm tra dự án

Chạy các lệnh sau trước khi bàn giao:

```powershell
npm run check
npm test
git diff --check
```

`npm run check` kiểm tra route, import, asset, schema, enum, ID, foreign key và quy tắc storage. `npm test` kiểm tra quyền, CRUD, đồng bộ version, reset dữ liệu và vòng đời AI bằng LocalStorage trong bộ nhớ cùng HTTP server tạm.

Kết quả tự động không thay thế kiểm thử giao diện thủ công. Trạng thái smoke test, accessibility, viewport, bàn phím, Figma, quản lý công việc, PR review và OBS được theo dõi trong [biên bản kiểm tra giao diện](docs/ui-validation.md).

## Giới hạn

- Dự án không có database, xác thực máy chủ, gửi email hoặc upload file thật.
- LocalStorage chỉ được chia sẻ giữa các tab có cùng protocol, hostname, port và hồ sơ trình duyệt.
- Git đồng bộ mã nguồn và JSON, không đồng bộ dữ liệu LocalStorage giữa các máy.
- Gemini live chưa được xác nhận trong repository khi chưa có API key hợp lệ và bằng chứng phiên demo.
- Progress Risk là công thức phục vụ demo, không phải mô hình dự báo nhân sự dùng trong sản xuất.

## Tài liệu

- [Quy tắc phát triển](AGENTS.md)
- [Quy tắc LocalStorage](OnboardAI_QuyTac_LocalStorage.md)
- [Hợp đồng dữ liệu](docs/data-contract.md)
- [Bảng màn hình](docs/screen-inventory.md)
- [Biên bản kiểm tra giao diện](docs/ui-validation.md)
- [Báo cáo sử dụng AI](docs/ai-usage-report.md)
- [Báo cáo refactor cuối](docs/final-refactor-report.md)
