# OnboardAI

Website HTML5/CSS/JavaScript thuần (ES modules). Đã tích hợp phần SV1 theo [quy tắc LocalStorage](OnboardAI_QuyTac_LocalStorage.md); chưa có backend hoặc AI thật.

## Chạy dự án

```powershell
node scripts/serve.cjs
```

Mở http://127.0.0.1:8000/ rồi chọn Đăng nhập. Có thể đổi cổng bằng `node scripts/serve.cjs 8080`. Không mở bằng file://.

Dùng email và password tương ứng trong [assets/data/users.json](assets/data/users.json), tài khoản phải có status active. Mật khẩu bạn bổ sung được giữ nguyên khi chuyển JSON từ data-json sang assets/data. Không có cách đăng nhập chỉ bằng role hoặc userId. Mật khẩu này phục vụ mô phỏng frontend và có thể đọc từ trình duyệt; không dùng mật khẩu thật.

## Phần SV1 đã nối

- Store chung: khởi tạo 10 JSON và aiHistory rỗng khi khóa chưa tồn tại; kiểm tra ID/JSON/phiên bản; giữ thay đổi qua F5; lỗi có hướng dẫn thử lại.
- Login/profile dùng danh tính trong users; profile bốn vai trò, sửa fullName/email duy nhất. Query role/userId không thay danh tính hoặc cấp quyền.
- Dashboard/checklist đọc hire theo userId, tính tiến độ chung; đổi todo/inProgress/blocked/completed qua tasks.updateTaskStatus.
- Thư viện/detail dùng documents và quyền đọc. Không có tệp đính kèm trong dữ liệu được giao nên detail hiển thị metadata và thông báo thiếu tệp.
- Policy Q&A tra cứu aiMockData với nguồn phù hợp quyền; fallback khi thiếu thông tin; lịch sử riêng có sửa/chấp nhận/từ chối/tạo lại/xóa.
- Trang chủ đọc news published, tìm/lọc/phân trang/chi tiết; sứ mệnh từ company-001.
- Header/sidebar/route dùng phiên chung; thay phiên ở tab khác làm kiểm tra lại quyền. Logout giữ dữ liệu nghiệp vụ.
- API people/ai-history đã sẵn sàng cho SV2/SV3 gọi; chữ ký và cách thử lại thao tác nhiều bước nằm trong quy tắc LocalStorage.

Dữ liệu chỉ dùng chung giữa các trang/tab cùng protocol, hostname và port trên cùng hồ sơ trình duyệt. Các tab cùng dùng một tài khoản hiện tại; phạm vi demo chỉ một tab ghi tại một thời điểm.

## Reset và lỗi dữ liệu

Nút **Đặt lại dữ liệu demo** ở Hồ sơ có xác nhận: xóa đúng 13 khóa onboardai_*, đăng xuất và nạp JSON ban đầu, giữ dữ liệu website khác. Màn hình lỗi khởi tạo cũng có Thử lại/Đặt lại/Đăng xuất. Không reset tự động; mảng [] đã lưu không bị seed lại.

Sau khi sửa JSON, F5 vẫn giữ LocalStorage cũ. Dùng reset có xác nhận nếu muốn nạp seed mới. Schema chưa hỗ trợ hoặc JSON hỏng sẽ dừng thao tác và báo lỗi, không tự thay bằng dữ liệu rỗng.

## Phạm vi bàn giao còn lại

Các trang mentor, quản trị HR/Admin và thư viện quản lý vẫn giữ giao diện tĩnh, thao tác ghi báo chưa kết nối. SV2/SV3 tiếp tục CRUD và hai AI Checklist Personalizer/Progress Risk; không tạo store hoặc dịch vụ trùng. Nút thêm việc cá nhân chưa có quyền tạo task trong hợp đồng này; quên mật khẩu/liên hệ HR chưa gửi email hay đặt lại mật khẩu.

Dữ liệu gốc cần nhóm xử lý có chủ đích:

- task-004 gắn journeys-001, trong khi hire-002 gắn journeys-002; cập nhật task này bị chặn.
- 42 nhóm check-in trùng newHireId/mentorId/scheduledAt; giữ nguyên nội dung để SV2 rà soát.
- 100 fileUrl tài liệu chưa có tệp; không tạo nội dung chính sách giả để thay thế.
- Các bất nhất timestamp đã được nêu trong quy tắc LocalStorage vẫn cần owner dữ liệu xử lý.

Quy tắc chung ở [AGENTS.md](AGENTS.md); tình trạng từng trang ở [bảng màn hình](docs/screen-inventory.md); kiểm tra và AI hỗ trợ ở [báo cáo AI](docs/ai-usage-report.md). Script, ảnh và hồ sơ trình duyệt kiểm thử chỉ dùng trong thư mục tạm, không lưu vào repo.
