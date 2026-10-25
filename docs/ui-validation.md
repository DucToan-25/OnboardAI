# Biên bản kiểm tra giao diện

Ngày cập nhật: 25/10/2026. Tài liệu này tách kết quả đã chạy được khỏi phần cần nhóm kiểm tra thủ công; không dùng unit/integration test để thay thế bằng chứng UI.

## Môi trường

| Hạng mục | Giá trị |
|---|---|
| Cách chạy | `node scripts/serve.cjs 8000`, mở `http://127.0.0.1:8000/` |
| Công nghệ | HTML/CSS/JavaScript ES Modules, JSON, LocalStorage |
| Kiểm tra tự động | `npm test` 65/65; `npm run check` 0 lỗi/0 cảnh báo; 19 route, 47 module JavaScript |
| Browser smoke tự động | Chrome Headless 155.0.8059.86: 19/19 route tải được, không hiện lỗi bootstrap hoặc `ERROR:CONSOLE` |
| Trình duyệt/version kiểm tra thủ công | TODO nhóm điền |
| OBS | TODO nhóm dán link |

## Ma trận viewport

Smoke test headless đã mở đủ 19 URL trên HTTP; route bảo vệ được kiểm tra ở trạng thái chưa đăng nhập nên có thể điều hướng về login. Cần nhóm tiếp tục chạy từng route sau đăng nhập ở 1440×900, 768×1024 và 390×844. Cột “Kết quả thủ công” vẫn để TODO vì chưa có ảnh/video và chưa thao tác đầy đủ trong trình duyệt thật.

| Route | Role/tài khoản | Thao tác tối thiểu | Kết quả thủ công | Console/404 asset | OBS |
|---|---|---|---|---|---|
| `index.html` | Public | tìm/lọc, mở modal, điều hướng section/login | TODO | TODO | TODO |
| `pages/login.html` | Public | validation, login 4 role, hỗ trợ quên mật khẩu | TODO | TODO | TODO |
| `pages/profile.html` | 4 role | sửa/hủy, reset có confirm | TODO | TODO | TODO |
| `pages/newhire-onboarding-dashboard.html` | NewHire | mở task/checklist/tài liệu | TODO | TODO | TODO |
| `pages/newhire-checklist.html` | NewHire | lọc, đổi trạng thái, lưu kết quả | TODO | TODO | TODO |
| `pages/newhire-ai-help.html` | NewHire | Generate/Edit/Regenerate/Save/Accept/Reject/archive/delete | TODO | TODO | TODO |
| `pages/newhire-document-library.html` | NewHire | tìm/lọc/mở tài liệu | TODO | TODO | TODO |
| `pages/mentor-mentee-list.html` | Mentor | lọc, mở chi tiết, chuyển trang theo mentee | TODO | TODO | TODO |
| `pages/mentor-checkin-note.html` | Mentor | create/update/cancel, thử lịch trùng | TODO | TODO | TODO |
| `pages/mentor-task-assignment.html` | Mentor | CRUD task và toàn bộ vòng đời Checklist AI | TODO | TODO | TODO |
| `pages/hr-document-library.html` | Mentor/HR/Admin | đọc hoặc CRUD/publish/archive theo role | TODO | TODO | TODO |
| `pages/document-detail.html?id=doc-001` | 4 role | nội dung, backlink, ID sai/quyền sai | TODO | TODO | TODO |
| `pages/hr-journey-management.html` | HR | CRUD/archive journey, gán hồ sơ | TODO | TODO | TODO |
| `pages/hr-dashboard.html` | HR | lọc, phân tích risk, Edit/Regenerate/Save/Accept/Reject/archive/delete | TODO | TODO | TODO |
| `pages/admin-department-management.html` | Admin | CRUD/archive và cảnh báo tham chiếu | TODO | TODO | TODO |
| `pages/admin-user-management.html` | Admin | CRUD/vô hiệu hóa/khôi phục | TODO | TODO | TODO |
| `pages/admin-system-settings.html` | Admin | sửa/hủy/reset, company/news | TODO | TODO | TODO |
| `pages/403.html` | Public | nút về trang phù hợp | TODO | TODO | TODO |
| `pages/404.html` | Public | quay lại/trang mặc định | TODO | TODO | TODO |

## Checklist accessibility và state

- [x] Mọi `<th>` hiện có `scope="col"`.
- [x] Label form liên kết input/select/textarea bằng `for`/`id`.
- [x] Modal dùng `role="dialog"`, `aria-modal`, tiêu đề liên kết, focus ban đầu, trap Tab, Escape và trả focus khi đóng.
- [x] Toast/loading/error dùng vùng `aria-live` hoặc `role=status/alert`; submit AI bị disable trong lúc xử lý và khôi phục trong `finally`.
- [x] Focus-visible dùng token/component chung; sidebar drawer hỗ trợ Escape, click ngoài và trap focus.
- [ ] Dùng bàn phím đi hết từng route trên trình duyệt thật.
- [ ] Xác nhận loading/empty/success/error/disabled/pending/rejected/completed/archive/cancel bằng ảnh hoặc OBS.
- [ ] Xác nhận không tràn ngang và không lỗi console/asset ở cả ba viewport.

## Liên kết quy trình

- Figma/Canva: TODO nhóm cung cấp.
- Trello/Jira/Notion: TODO nhóm cung cấp.
- PR/review chéo: TODO nhóm cung cấp.
- OBS: TODO nhóm cung cấp.
