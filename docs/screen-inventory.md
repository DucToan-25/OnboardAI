# Bảng màn hình OnboardAI

Trạng thái hiện hành ngày 25/10/2026. Có 19 route: 12 màn hình nền tảng theo đề, 6 màn hình dùng chung và trang chủ công khai.

| Task | Owner | Route | Role | CRUD/luồng chính | AI | Minh chứng ngoài repo |
|---|---|---|---|---|---|---|
| UI-PUBLIC | SV3 | `index.html` | Public | Đọc company-001 và news published | — | TODO Figma/OBS/PR |
| UI-01 | SV1 | `newhire-onboarding-dashboard.html` | NewHire | Đọc tiến độ/task/tài liệu/mentor | — | TODO Figma/OBS/PR |
| UI-02 | SV1 | `newhire-checklist.html` | NewHire | Đọc/lọc task, đổi status, lưu kết quả | — | TODO Figma/OBS/PR |
| UI-03 | SV1 | `newhire-ai-help.html` | NewHire | History: create/read/archive/delete | Policy Q&A draft → Save/Accept/Reject | TODO Figma/OBS/PR |
| UI-04 | SV1 | `newhire-document-library.html` | NewHire | Đọc/lọc tài liệu theo scope | — | TODO Figma/OBS/PR |
| UI-05 | SV1 | `login.html` | Public | Login/logout/hướng dẫn hỗ trợ | — | TODO Figma/OBS/PR |
| UI-06 | SV1 | `profile.html` | 4 role | Đọc/sửa hồ sơ cá nhân; reset demo | — | TODO Figma/OBS/PR |
| UI-07 | SV2 | `mentor-mentee-list.html` | Mentor | Đọc/lọc mentee và tiến độ | — | TODO Figma/OBS/PR |
| UI-08 | SV2 | `mentor-checkin-note.html` | Mentor | Create/read/update/cancel check-in | — | TODO Figma/OBS/PR |
| UI-09 | SV2 | `mentor-task-assignment.html` | Mentor | CRUD/archive task | Checklist draft → Save/Accept/Reject | TODO Figma/OBS/PR |
| UI-10 | SV2 | `hr-document-library.html` | Mentor/HR/Admin | Mentor read; HR/Admin create/update/publish/archive | — | TODO Figma/OBS/PR |
| UI-11 | SV2 | `document-detail.html` | 4 role | Đọc document theo ID và quyền | — | TODO Figma/OBS/PR |
| UI-12 | SV2 | `403.html` | Public | Điều hướng lỗi quyền | — | TODO Figma/OBS/PR |
| UI-13 | SV3 | `hr-journey-management.html` | HR | CRUD/archive journey, quản lý hồ sơ/gán | — | TODO Figma/OBS/PR |
| UI-14 | SV3 | `hr-dashboard.html` | HR | Đọc tiến độ, history read/archive/delete | Progress Risk draft → Save/Accept/Reject | TODO Figma/OBS/PR |
| UI-15 | SV3 | `admin-department-management.html` | Admin | CRUD/archive phòng ban | — | TODO Figma/OBS/PR |
| UI-16 | SV3 | `admin-user-management.html` | Admin | CRUD/vô hiệu hóa/khôi phục tài khoản | — | TODO Figma/OBS/PR |
| UI-17 | SV3 | `admin-system-settings.html` | Admin | Read/update/reset singleton settings; Reset thay Delete | — | TODO Figma/OBS/PR |
| UI-18 | SV3 | `404.html` | Public | Điều hướng route không tồn tại | — | TODO Figma/OBS/PR |

## Trạng thái kỹ thuật

- Route guard lấy quyền từ session/user active; URL điều hướng sạch, không có `?role=`.
- Trang gọi service/store chung; không có LocalStorage trực tiếp ngoài `store.js`.
- AI-1/AI-2/AI-3 có validation, loading nhìn thấy được, result, explanation, uncertainty/error, Edit/Regenerate/Save/Accept/Reject. Generate/Edit/Regenerate không ghi history.
- Mock Mode chạy offline theo mặc định; Gemini Mode là tùy chọn, phân biệt nguồn/model và có Retry/Fallback nhưng chưa được kiểm chứng live bằng key thật trong lần rà soát này.
- `npm test`: 65/65. `npm run check`: 0 lỗi, 0 cảnh báo; 19 route và 47 module JavaScript tại lần cập nhật tài liệu này.
- Kiểm tra thủ công desktop/tablet/mobile và bằng chứng OBS chưa thể xác nhận từ repository; trạng thái chi tiết và chỗ cần nhóm điền nằm ở [ui-validation.md](ui-validation.md).

Lịch sử triển khai cũ được ghi trong Git; tài liệu này chỉ giữ một trạng thái hiện hành để tránh mô tả “chưa kết nối” mâu thuẫn với runtime.
