# Field bổ sung cho giai đoạn giao diện

> Trạng thái 15/10/2026: đây là hợp đồng **dự kiến cho giai đoạn dữ liệu**, không phải mã đang chạy. Hiện tại card/bảng/form hiển thị HTML tĩnh, không có seed, repository, phiên đăng nhập hoặc AI fixture. Các mô tả xác minh/lưu/preview dữ liệu bên dưới chỉ được triển khai khi nhóm bắt đầu nối dữ liệu. Form hiện tại chỉ validate và báo chưa kết nối, không xác minh tài khoản hoặc giả đặt lại mật khẩu thành công.

## Khôi phục mật khẩu — UI-05 (08/10/2026)

Login xác minh một tài khoản đang hoạt động bằng cặp `users.email` + `users.phone` đã có trong seed/repository. Email được chuẩn hóa không phân biệt hoa thường; số điện thoại chỉ so sánh chữ số sau khi loại khoảng trắng/ký hiệu. Khi khớp, UI chuyển sang form `newPassword`/`confirmPassword` và kiểm tra tối thiểu 8 ký tự, có chữ và số. Bản giao diện chỉ dựng preview thành công; không gửi email giả, không ghi mật khẩu vào seed và không gọi HR. Nút `contact-hr` vẫn là luồng hỗ trợ riêng cho trường hợp không xác minh được hoặc cần trợ giúp.

## Quản lý hệ thống — UI-17 (07/10/2026)

Giữ bản ghi `settings.id = system`. Các field Admin được chuẩn bị sửa qua `getEditableFields`:

| Field | Kiểu / validation |
|---|---|
| organizationName | Chuỗi bắt buộc, trim, tối đa 120 ký tự |
| supportEmail | Email hỗ trợ nhân sự, bắt buộc; fixture `hr@example.com`, không gửi email |
| supportPhone | Chuỗi điện thoại tùy chọn, dùng rule phone chung |
| onboardingDays | Số nguyên 1–365, thời gian hội nhập mặc định dự kiến |
| reminderDays | Số nguyên 0–30, số ngày nhắc trước hạn nhiệm vụ dự kiến; 0 là đúng ngày đến hạn |

Form tạo draft `{ id, organizationName, supportEmail, supportPhone, onboardingDays, reminderDays }`, không gửi toàn bộ settings hay fixture AI. Baseline lấy từ repository; Hủy/khôi phục bỏ draft, không mutate seed. `capabilities.write=false` nên chỉ xem trước, chưa áp dụng tới auth/layout/journey/task hoặc gửi nhắc việc. API về sau áp dụng cùng validation và quyền Admin phía server; điểm ghi là `repository.update('settings', 'system', patch)` khi được triển khai.

Số liệu quản trị lấy từ list users/departments và documents published trong scope, không giả trạng thái máy chủ/log/sao lưu. Phạm vi giao diện theo ROLE_MENUS, không dùng bảng này cấp quyền dữ liệu. Các fixture aiPreview/checklistPreview/riskPreview vẫn được màn hình AI đọc, nhưng không còn trong field quản trị được sửa.

## Trang chủ công khai — UI-PUBLIC (07/10/2026)

`portalPosts` là mảng trong seed chung, đọc bằng `repository.list('portalPosts')` / `get('portalPosts', id)`. Contract list vẫn `{ items, total }`. Không có kho riêng hoặc request trong module trang. Khi nối API, adapter trả cùng schema và server phải áp dụng phạm vi công khai.

| Field | Kiểu / cách dùng |
|---|---|
| id, kind | ID chuỗi ổn định; kind: `news`, `notice`, `event` |
| status, visibility | `draft`/`published`/`archived`; `public`/`internal`. Chỉ published + public được đọc, kể cả khi có user preview. |
| title, summary, publishedAt | Chuỗi hiển thị công khai; ngày đăng `YYYY-MM-DD` |
| content | Văn bản thuần công khai, tùy chọn; không chứa nội dung nội bộ. UI dùng textContent. |
| requiresLogin | Boolean, chỉ dẫn phần chi tiết cần phiên. Không phải quyền đọc; không đưa chi tiết bị khóa vào seed này. |
| category, readMinutes, imageUrl | News: `company`/`internal`/`event`, số phút đọc tùy chọn, URL ảnh tùy chọn (relative từ index.html hoặc HTTPS). category internal là nhãn chủ đề, không thay visibility. Không có ảnh/lỗi ảnh thì dùng icon chung. |
| label, important, publisher | Notice: nhãn, boolean nhấn mạnh, đơn vị đăng |
| eventDate, startsAt, location | Event: ngày địa phương YYYY-MM-DD, giờ ISO UTC, địa điểm. eventDate phải khớp startsAt theo múi giờ cấu hình. |

Chỉ có 3 news, 3 notice, 2 event minh họa theo ảnh. Không ghi cứng tổng 24 bài/8 trang; số đếm, kết quả, phân trang suy từ dữ liệu. Sự kiện lọc từ ngày hiện tại theo timezone chung; fixture cũ sẽ tự hết hạn. Có thể để mảng rỗng để thử empty state. Bộ lọc/phân trang hiện xử lý trong trang vì dữ liệu nhỏ; khi có quy mô lớn, mở rộng query adapter chung. Chính sách/điều khoản/liên hệ chính thức chờ nội dung được cung cấp, không tạo giả email hỗ trợ.

Nguồn chuẩn cho thực thể, ID/status, quyền và repository là [AGENTS.md](../AGENTS.md) mục 7–9. Tài liệu này đặc tả phần bổ sung dùng trong seed và form hiện tại; không định nghĩa lại contract theo thành viên.

| Field | Kiểu/default | Cách dùng và phạm vi |
|---|---|---|
| tasks.relatedDocumentIds | string[], mặc định [] | Tham chiếu documents.id; UI mở nguồn sau khi repository kiểm tra quyền đọc. |
| tasks.result | null hoặc { url: string, note: string, fileName: string } | Kết quả mẫu/nộp xem trước. Không upload tệp; fileName chỉ là tên hiển thị. Newhire gửi theo quyền tasks:submit, không tự duyệt completed. |
| journeys.steps | string[], mặc định [] | Bước mẫu, tách khỏi task và assignment của từng nhân sự. |
| checkins.sharedWithNewHire | boolean, mặc định false | Cho phép Newhire liên quan đọc thông tin lịch; adapter vẫn loại note riêng. HR/Admin không được mặc định đọc ghi chú. |
| settings.aiPreview | { question, answer, explanation: string; documentIds: string[]; notes: PreviewNote[] } | Fixture Q&A tập trung. Ghi chú ở aiPreview.notes; không có bản sao settings.notes. Chỉ render nguồn trong quyền. |
| settings.checklistPreview | { explanation: string; documentIds: string[]; tasks: { title, description: string }[] } | Fixture AI checklist. Mentor tạo ID draft, gắn newHireId trong scope và assignedById hiện tại; không tự ghi task thật. |
| settings.riskPreview | { scenarios: { value, label: string }[]; errorMessage: string } | Scenario success/insufficient/error để kiểm tra state của AI risk; kết quả tính từ tasks qua selector chung. |

PreviewNote có `{ id, title, body, updatedAt, documentIds }`; updatedAt là ISO UTC, documentIds tham chiếu kho tài liệu chung. Các ghi chú minh họa thuộc fixture, không phải ghi chú riêng của một người thật. Bản sửa nằm trong module trang, không làm đổi fixture.

`scheduledAt` luôn là ISO 8601 UTC. Form dùng input datetime-local theo APP_CONFIG.timeZone qua toDateTimeInput/fromDateTimeInput; khi không sửa ngày giờ phải giữ nguyên ISO gốc để không mất giây. Ngày không có giờ như dueDate/startDate dùng YYYY-MM-DD.

Quyền action/field nằm trong permissions.js. `profile` chỉ sửa fullName/phone/avatarUrl của chính mình. `users` là form Admin quản lý; departments/journeys/documents/settings và tasks/checkins dùng danh sách field của entity tương ứng. UI preview có thể hiển thị draft hợp lệ nhưng mọi method ghi của adapter hiện trả PREVIEW_ONLY, capabilities.write=false.

`getDepartmentReferences(id)` trả số users/journeys/documents tham chiếu một phòng ban cho Admin để cảnh báo. Đây là tổng hợp từ seed trong adapter, không trả dữ liệu journey cho Admin hoặc thay đổi ma trận route. Archive vẫn cần xác nhận, chưa thực hiện ghi/xóa dây chuyền.
