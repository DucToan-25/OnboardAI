# OnboardAI

Website HTML5/CSS/JavaScript thuần (ES modules), tích hợp LocalStorage cho cả SV1, SV2 và SV3. Giữ 19 route và một bộ dịch vụ chung; chưa có backend hoặc AI thật.

## Chạy dự án

```powershell
node scripts/serve.cjs
```

Mở http://127.0.0.1:8000/. Đổi cổng bằng `node scripts/serve.cjs 8080`; không mở bằng file://. Đăng nhập bằng email hoặc ID và password trong [assets/data/users.json](assets/data/users.json), tài khoản phải active. Mật khẩu là dữ liệu mô phỏng có thể đọc từ trình duyệt, không dùng mật khẩu thật.

## Các luồng đã nối

- SV1: đăng nhập, profile bốn vai trò, dashboard/checklist và tiến độ, thư viện và Policy Q&A với lịch sử riêng.
- SV2: mentee theo phân công, tạo/sửa/lưu trữ task, check-in có kiểm tra trùng lịch và ghi chú riêng; quản lý tài liệu theo quyền; Checklist Personalizer cho phép sửa, từ chối và duyệt để giao việc.
- SV3: quản lý journey, tạo/gán hồ sơ hội nhập, dashboard và Progress Risk; Admin quản lý tài khoản, phòng ban và cấu hình hệ thống.
- HR/Admin dùng chung phần thông tin công ty và tin tức trong các trang hiện có. Trang chủ chỉ đọc company-001 và tin published.
- Tiến độ tính từ tasks chung, bỏ archived. Checklist thử lại sau lỗi lưu dùng ID ổn định, không nhân đôi task. HR/Admin không đọc hoặc tìm kiếm ghi chú check-in riêng của Mentor.
- Phiên chỉ lưu userId. Query role không cấp quyền. Đổi phiên/role hoặc vô hiệu hóa tài khoản làm tab khác tải lại và bỏ draft. Logout giữ dữ liệu nghiệp vụ.

Ba chức năng AI dùng aiMockData hoặc tính toán mô phỏng từ dữ liệu hiện có; không gọi mô hình bên ngoài. Cấu hình số ngày hội nhập được dùng khi tạo journey; không tự thay journey cũ hoặc gửi nhắc việc.

## Dữ liệu và đồng bộ

12 JSON ở assets/data là nguồn khởi tạo duy nhất, gồm aiHistory.json và settings.json. Store chỉ đọc các file này khi chưa có khóa; tổng cộng 14 khóa đăng ký, schemaVersion 1. Không còn seed/import, dữ liệu nghiệp vụ nhúng trong HTML hoặc store song song.

LocalStorage chỉ dùng chung giữa các trang/tab cùng protocol, hostname, port và hồ sơ trình duyệt. Git đồng bộ mã nguồn/JSON giữa ba thành viên, không đồng bộ dữ liệu đang dùng giữa ba máy. Demo hỗ trợ một tab ghi tại một thời điểm.

Sau khi sửa JSON, F5 vẫn giữ dữ liệu trình duyệt. Dùng **Đặt lại dữ liệu demo** tại Hồ sơ hoặc Quản lý hệ thống để nạp seed mới: thao tác có xác nhận, kiểm tra toàn bộ JSON trước khi xóa đúng khóa dự án và đăng xuất; giữ dữ liệu website khác. Seed lỗi được báo trước khi xóa; lỗi ghi có bước khôi phục dữ liệu trước đó. JSON lỗi, ID trùng hoặc schema không hỗ trợ sẽ báo lỗi, không tự sửa/gộp hoặc ghi đè dữ liệu cũ.

## Kiểm tra

```powershell
npm run check
npm test
```

npm run check kiểm tra JSON/ID/liên kết, import, route/menu và tài nguyên. Bộ kiểm tra hồi quy dùng bộ nhớ giả cùng HTTP server tạm, không ghi seed hoặc LocalStorage trình duyệt. Kiểm tra route/module, auth/quyền, CRUD, tiến độ, lỗi lưu/thử lại, AI, reset và schema. Script thử trình duyệt, ảnh và profile tạm nằm ngoài repo. Kết quả cụ thể xem [báo cáo AI](docs/ai-usage-report.md).

## Giới hạn và dữ liệu cần nhóm xử lý

- Người dùng đang tự sửa ID trùng user-006 trong users.json. Cần ID duy nhất trước khi khởi tạo/reset từ seed hiện tại; không đổi ID của tài khoản cũ đang được tham chiếu.
- task-004 và hire-002 lệch journeyId: giữ seed, chặn cập nhật liên kết không nhất quán. Các nhóm check-in trùng lịch và bất nhất timestamp cũ cũng cần nhóm quyết định, không tự gộp ghi chú.
- Các tệp assets/docs trong seed chưa được cung cấp. Detail báo thiếu tệp; tài liệu mới có URL HTTP(S) mở được liên kết ngoài. Chưa có upload tệp.
- NewHire chưa có quyền tự tạo task; quên mật khẩu chỉ hướng dẫn liên hệ, không gửi email hoặc đặt lại mật khẩu giả.

Quy tắc hiện hành: [AGENTS.md](AGENTS.md), [LocalStorage](OnboardAI_QuyTac_LocalStorage.md), [bảng màn hình](docs/screen-inventory.md). Các phần tài liệu cũ có mốc ngày được giữ làm lịch sử; mục ngày 19/10/2026 có ưu tiên. Owner review và OBS do nhóm thực hiện trước merge.
