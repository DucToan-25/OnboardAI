# OnboardAI

OnboardAI là nguyên mẫu Frontend cho hành trình hội nhập nhân sự mới, viết bằng HTML5, CSS3 và JavaScript ES modules. Ứng dụng có 19 route, bốn vai trò, CRUD mô phỏng trên LocalStorage, ba trải nghiệm AI chạy được ở Mock Mode và tích hợp Google Gemini tùy chọn. Dự án không có backend và không phải hệ thống xác thực dùng cho sản xuất.

## Chạy dự án

Yêu cầu Node.js 20 trở lên. Tại thư mục dự án, chạy:

```powershell
npm run serve
```

Mở http://127.0.0.1:8000/. Có thể đổi cổng bằng `node scripts/serve.cjs 8080`; không mở trực tiếp bằng `file://` vì ES modules và JSON cần HTTP.

## Đăng nhập và bốn vai trò

Form nhận email hoặc ID cùng mật khẩu seed. Một tài khoản active đại diện cho mỗi vai trò:

| Vai trò | Email | Mật khẩu | Phạm vi chính |
|---|---|---|---|
| Nhân sự mới | `an.nguyen@example.com` | `MinhAn2026` | Dashboard, checklist, tài liệu, Policy Q&A |
| Mentor | `ha.le@example.com` | `ThuHa123` | Mentee, task, check-in, Checklist Personalizer |
| HR | `linh.pham@example.com` | `NgocLinh2007` | Journey, hồ sơ hội nhập, tài liệu, Progress Risk |
| Admin | `minh.do@example.com` | `admin` | Tài khoản, phòng ban, cấu hình và reset demo |

Đây là mật khẩu mô phỏng lưu trong JSON/LocalStorage và có thể đọc bằng DevTools; không dùng lại các giá trị này ở hệ thống thật. Phiên chỉ lưu `userId`. Query string không cấp quyền, và logout giữ nguyên dữ liệu nghiệp vụ.

## Dữ liệu JSON và LocalStorage

Mười hai collection trong [assets/data](assets/data) là nguồn khởi tạo duy nhất; [version.json](assets/data/version.json) là manifest phát hành dữ liệu. `main.js` chờ store nạp xong rồi mới kiểm tra phiên, quyền và render trang. Chỉ [store.js](js/data/store.js) truy cập LocalStorage.

- Collection thiếu hoặc có version mới được thay toàn bộ bằng JSON nguồn trước khi render; quy tắc này áp dụng cả thêm, sửa và xóa.
- Collection không đổi version giữ dữ liệu người dùng đã thao tác trên trình duyệt.
- Một đợt đồng bộ ghi collection và `onboardai_seedVersions` theo transaction có rollback; lỗi tải, JSON, schema, ID/email hoặc storage không được đánh dấu đã cập nhật.
- Muốn sửa seed thủ công: sửa JSON, tăng số nguyên dương của đúng collection trong `version.json`, rồi tải lại trang.
- Công cụ `node scripts/excel-to-json.cjs <file.xlsx> --write` chỉ thêm ID mới cho `journeys`, `companyInfo`, `news` và tự tăng version của collection đã đổi.

LocalStorage chỉ dùng chung giữa các tab có cùng protocol, hostname, port và hồ sơ trình duyệt. Git đồng bộ mã/JSON giữa thành viên, không đồng bộ LocalStorage giữa các máy.

## Ba trải nghiệm AI

Generate/Edit/Regenerate chỉ tạo bản nháp trong bộ nhớ. Save/Accept/Reject mới ghi `aiHistory`; Accept checklist lưu history và task trong cùng transaction với ID ổn định để thử lại không nhân đôi.

### Mock Mode

Đây là chế độ mặc định, không cần Internet hoặc API key:

- Policy Q&A tra `aiMockData` và chỉ trích tài liệu tài khoản được phép đọc.
- Checklist Personalizer dùng hồ sơ mentee cùng fixture để tạo draft nhiệm vụ.
- Progress Risk tính mức rủi ro từ tasks/newHires/check-ins bằng quy tắc JavaScript, không dùng số ngẫu nhiên.

### Gemini Mode tùy chọn

Trên một trong ba màn hình AI, chọn **Cấu hình AI**, nhập key thử nghiệm, chọn model và dùng **Kiểm tra kết nối**. Key chỉ nằm trong bộ nhớ JavaScript của trang, mất khi F5/đóng tab, không ghi vào LocalStorage, SessionStorage, JSON hoặc lịch sử AI. Request dùng endpoint `generateContent` và header `x-goog-api-key`.

Gọi Gemini trực tiếp từ trình duyệt chỉ phù hợp demo có kiểm soát vì key vẫn hiện trong DevTools Network. Triển khai công khai cần backend/proxy bảo mật. Khi Gemini lỗi, giao diện cho thử lại hoặc chuyển sang Mock Mode; kết quả lỗi không tự ghi dữ liệu. Repository không chứa key và lần rà soát này không xác nhận kết nối thật vì không có key hợp lệ được cung cấp.

Chi tiết kiến trúc và giới hạn nằm trong [báo cáo AI](docs/ai-usage-report.md).

## Kiểm tra và reset

```powershell
npm run check
npm test
git diff --check
```

`npm run check` kiểm tra schema/enum/ngày/URL, ID, foreign key, lịch check-in trùng, route/menu, import và asset. `npm test` dùng storage trong bộ nhớ và HTTP server tạm; không sửa seed hoặc LocalStorage của trình duyệt.

Để khôi phục demo, đăng nhập Admin, mở **Quản lý hệ thống** và chọn **Đặt lại dữ liệu demo**. Thao tác có xác nhận, chỉ thay các khóa `onboardai_*` đã đăng ký, nạp lại đủ JSON/manifest và đăng xuất.

## Giới hạn và minh chứng còn cần nhóm hoàn tất

- Đây là frontend mô phỏng: không có database, server auth, gửi email, upload file hoặc cơ chế giữ bí mật API key ở môi trường công khai.
- Browser smoke test thủ công, responsive, bàn phím, Figma/Canva, Trello/Jira/Notion, PR/review và video OBS phải được nhóm xác nhận bằng bằng chứng thật trong [biên bản UI](docs/ui-validation.md); repository không tự tạo các bằng chứng này.
- Seed hiện có 23 users, 12 newHires, 84 tasks, 13 departments, 15 documents, 12 check-ins, 6 journeys, 1 companyInfo, 12 news, 21 aiMockData, 0 aiHistory và 1 settings.

Tài liệu hiện hành: [AGENTS.md](AGENTS.md), [quy tắc LocalStorage](OnboardAI_QuyTac_LocalStorage.md), [hợp đồng dữ liệu](docs/data-contract.md), [bảng màn hình](docs/screen-inventory.md) và [báo cáo refactor cuối](docs/final-refactor-report.md).
