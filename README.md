# OnboardAI

Giao diện onboarding dùng HTML5, CSS và JavaScript thuần (ES modules). Một khung ứng dụng, một seed và một repository dùng chung cho Newhire, Mentor, HR và Admin.

## Chạy dự án

Cần Node.js 24 trở lên để dùng các script kiểm tra có sẵn, không cần cài package. Từ thư mục gốc:

```powershell
node scripts/serve.cjs
```

Mở http://127.0.0.1:8000/ để xem trang chủ `index.html`. Nút Đăng nhập dẫn đến `pages/login.html` để chọn tài khoản demo. Có thể dùng `node scripts/serve.cjs 8080` để đổi cổng. Dừng server bằng Ctrl+C. Không mở HTML bằng file:// vì ES modules và JSON cần HTTP.

## Phạm vi hiện tại

- Sau đăng nhập, bấm logo trên header để mở/thu gọn sidebar ở cả bốn vai trò. Desktop thu gọn mở rộng vùng nội dung; mobile dùng drawer, đóng bằng logo/Escape/chạm ngoài.
- Trang Admin “Quản lý hệ thống” tổng hợp tài khoản/phòng ban/tài liệu và biểu mẫu thông tin tổ chức/quy tắc hội nhập. Thay đổi chỉ xem trước; fixture AI vẫn thuộc màn hình AI, không còn là form quản trị.

- Trang chủ công khai theo ảnh Onvera: tin tức/thông báo/sự kiện, tìm/lọc/sắp xếp/phân trang và modal thông tin phụ. Dữ liệu minh họa tối thiểu trong `seed.portalPosts`, truy cập bằng repository chung; thay adapter để nối dữ liệu thật. Ảnh bài viết chưa được cung cấp riêng nên dùng icon chung thay thế, có sẵn field `imageUrl`. Chi tiết nội bộ, đăng ký sự kiện và chính sách chính thức chờ đợt nghiệp vụ.

- 18 trang, điều hướng theo vai trò, tìm/lọc, form, modal, tab, responsive và luồng AI minh họa.
- Dữ liệu đọc từ `assets/data/seed.json` qua repository. Thay đổi form/task/AI là bản nháp xem trước trong trang, mất khi tải lại; không báo đã lưu vào kho.
- Auth chỉ chọn user mẫu theo ID. Mật khẩu trong form chỉ dùng thử validation; không phải hệ đăng nhập nghiệp vụ.
- CRUD, persistence, backend và AI thật thuộc đợt sau. Không thêm API key hoặc dữ liệu người thật vào frontend.

## Quy tắc và hợp đồng

Đọc [AGENTS.md](AGENTS.md) và quy tắc owner trong [docs/rules](docs/rules) trước mỗi task. Bảng màn hình ở [docs/screen-inventory.md](docs/screen-inventory.md); các field bổ sung ở [docs/data-contract.md](docs/data-contract.md). Mỗi owner cập nhật phần của mình trong [docs/ai-usage-report.md](docs/ai-usage-report.md).

## Kiểm tra

```powershell
node --experimental-vm-modules scripts/check-integration.cjs
node scripts/smoke-http.cjs
```

Kiểm tra trình duyệt được mô tả trong [docs/ui-validation.md](docs/ui-validation.md). Profile cần thử cả bốn vai trò và hai user cùng vai trò. Form Hủy phải trả về bản gốc; tài liệu ngoài scope/ID thiếu phải có thông báo phù hợp; không có lỗi console, tài nguyên thiếu hoặc body cuộn ngang ở 1440/768/390px.

Ảnh tham chiếu hiện có nằm ở `design/references`. Chưa có thiết kế đầy đủ của 18 màn hình để xác nhận độ khớp Figma. Các minh chứng OBS/review PR thực tế do từng thành viên bổ sung; không coi việc dựng UI là hoàn thành toàn bộ bài tập.
