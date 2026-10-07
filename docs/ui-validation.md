# Kiểm tra tích hợp giao diện

## Shell bằng logo và Quản lý hệ thống — 07/10/2026

- Integration: 33 JS/19 route; field settings Admin chỉ gồm năm field tổ chức/hội nhập, các role khác không được mở UI-17 hoặc sửa cấu hình. HTTP: 19 trang, 65 tài nguyên/liên kết.
- Browser: 57 trang/viewport (1440/768/390). Mọi trang app chỉ có một toggle là logo, không hamburger/X sidebar; desktop đóng làm rộng main, mobile mở khóa nền và trap focus, đóng trả khả năng tương tác. Modal/Escape, profile của năm tài khoản/bốn vai trò và các luồng AI/library/form sẵn có đều qua; không console/network error, ID trùng hay overflow toàn trang.
- UI-17: số tài khoản khớp repository, bốn hàng phạm vi vai trò, không còn input câu hỏi AI; email sai/ngày ngoài giới hạn có lỗi cạnh trường. Xem trước hiển thị draft; Hủy và khôi phục có xác nhận trả baseline. Nút dùng nhãn xem trước, không báo ghi kho thành công.
- Rà ảnh chụp desktop/mobile và trạng thái sidebar tại `.tmp/system-*.png` (không commit). Các fixture AI tiếp tục hoạt động; không nối lưu cấu hình, áp dụng thời hạn/nhắc việc hoặc email. Owner review và OBS của nhóm vẫn cần bổ sung.

## Bổ sung UI-PUBLIC — 07/10/2026

- Menu theo vị trí cuộn: Chrome 1440/768/390/320px xác nhận active chuyển giữa các section khi cuộn, chỉ một `aria-current`/`is-active`, click Sự kiện giữ đúng mục cả khi nằm ngang với Thông báo. Kiểm tra reduced motion tắt transition, anchor vẫn không bị header che, không tràn ngang; integration và HTTP đều qua.

- Header sticky/mobile: kiểm tra Chrome ở 1440/768/390/320px; cuộn 700px vẫn giữ header tại đỉnh, bấm Tin tức không che tiêu đề, không cuộn ngang. Header mobile dưới 125px, logo/menu/đăng nhập cùng DOM; tìm kiếm tại toolbar Tin tức. HTTP vẫn qua 19 trang/62 tài nguyên.

- Integration: 33 module JS, 19 HTML/route (root index + 18 nghiệp vụ); kiểm tra repository từ chối portalPosts internal/draft qua list và get, dữ liệu trả về là bản sao.
- HTTP: 19 trang, 62 tài nguyên, `/` trả index.html; assets/link của root được kiểm tra cùng pages.
- Browser: 57 tổ hợp trang/viewport ở 1440/768/390px không body overflow/ID trùng hoặc lỗi console/network; các luồng profile năm tài khoản/bốn role, form/AI/modal/library hiện có vẫn qua.
- Index: tìm/lọc có empty state, Xem thêm phục hồi danh sách, FAQ mở/đóng bằng Escape và trả focus, lịch sự kiện mở modal, nút Đăng nhập chuyển đúng trang chung.
- Kiểm tra thủ công bằng Chrome headless với prefix `/preview/`: index, CSS, JS, sprite và link login giữ đúng prefix. Ảnh chụp rà soát trong `.tmp/index-1440.png` và `.tmp/index-390.png` (không commit).
- Ảnh bài viết hiện là icon thay thế vì chưa có ảnh tách riêng. Dữ liệu chỉ minh họa; chi tiết nội bộ, đăng ký, chính sách và nội dung liên hệ chính thức chưa nối. Chưa có owner review/OBS trong phiên này.

Môi trường: Node.js 24, Chrome headless có sẵn trên Windows, HTTP server dùng scripts/serve.cjs. Không thêm dependency/build framework vào ứng dụng. Browser test dùng Chrome DevTools Protocol qua WebSocket của Node.

## Lệnh kiểm tra

```powershell
node --experimental-vm-modules scripts/check-integration.cjs
node scripts/smoke-http.cjs
```

Để chạy browser test, mở một Chrome headless riêng bằng PowerShell (hồ sơ tạm trong dự án, cửa sổ ẩn):

```powershell
$validationProfile = Join-Path (Get-Location) '.tmp/chrome-validation'
Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList @('--headless=new', '--remote-debugging-port=9223', ('--user-data-dir="' + $validationProfile + '"'), '--no-first-run', '--no-default-browser-check', 'about:blank') -WindowStyle Hidden
node scripts/browser-smoke.cjs
```

Browser test tự chạy HTTP server trên cổng tạm và đóng server sau khi xong. Nếu Chrome nằm ở đường dẫn khác, điều chỉnh FilePath. Chỉ đóng instance Chrome dùng hồ sơ validation khi dọn dẹp; không đóng trình duyệt cá nhân. Sandbox của phiên Codex chặn Chrome khởi tạo tiến trình con; lượt kiểm tra thực tế đã chạy Chrome sau khi được phép vượt sandbox cho thao tác này.

## Các kiểm tra đã qua

| Kiểm tra | Kết quả |
|---|---|
| Parse source, module exports/imports | 32/32 JS |
| HTML/route/availablePages/module loader | Đủ 18 trang |
| HTTP và dependency/tài nguyên | 18 trang, 56 tài nguyên |
| Render, không body overflow hoặc ID trùng | 18 trang × 1440/768/390px = 54 trường hợp |
| Profile | Đúng ID/tên cho 5 tài khoản, đủ 4 role và 2 Newhire |
| Repository | Scope tài liệu, quyền check-in, profile fields, tham chiếu phòng ban; chặn ghi PREVIEW_ONLY |
| Ngày giờ/tiến độ/rủi ro | UTC↔datetime-local; ngày Việt Nam; bỏ canceled; thiếu dữ liệu không gán rủi ro |
| Settings | Đọc đúng notes; submit preview rồi Hủy trả baseline |
| Check-in | Giữ giờ địa phương khi sửa; URL ID thiếu có phản hồi |
| Task | Form tạo draft và Hủy; kho gốc giữ nguyên |
| AI checklist/risk | success/insufficient/error; chấp nhận/từ chối và hành vi draft |
| Library/detail | Vai trò Newhire/Mentor chỉ đọc; HR/Admin có quản lý; backlink theo role; doc draft bị chặn, ID thiếu có lỗi |
| Admin user | Row disable có draft cụ thể sau confirm; validation phone |
| Modal/drawer | Vừa viewport 390px, Escape đóng; aria-expanded đồng bộ |
| Console và mạng trong lượt browser test | Không có lỗi console hoặc tài nguyên HTTP lỗi |
| CSS | Không còn CSS trang rỗng, !important trang, selector riêng hết dùng hoặc class common ngoài registry |

Các script kiểm tra những luồng nêu trên; không coi đó là bằng chứng đã kiểm thử mọi tổ hợp input/state. Trạng thái loading/error ở các list có guard trong source để bộ lọc không xóa thông báo hoặc retry. CRUD/AI/persistence thật ngoài phạm vi UI hiện tại.

## Còn cần nhóm bổ sung

- Thiết kế/Figma đủ 18 trang để đối chiếu bố cục chi tiết; hiện chỉ có bốn ảnh tham chiếu SV1.
- Owner/reviewer PR của nhóm, OBS và minh chứng do từng thành viên thực hiện.
- Kiểm thử nghiệp vụ đọc/ghi, đăng nhập thật và AI thật sau khi triển khai ở đợt sau.
