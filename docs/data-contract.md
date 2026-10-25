# Hợp đồng dữ liệu OnboardAI

Trạng thái hiện hành ngày 25/10/2026. Đây là hợp đồng runtime cho web frontend HTML/CSS/JavaScript, JSON và LocalStorage; không có backend. Mock AI chạy offline, còn Gemini API là tích hợp tùy chọn gọi trực tiếp từ trình duyệt demo.

## Nguồn và đồng bộ

- 12 collection canonical nằm trong `assets/data/`; `version.json` chứa version nguyên dương của từng collection.
- `schemaVersion` cố định là 1. Khi version collection tăng, `initStore()` kiểm tra rồi thay toàn bộ collection đó bằng JSON trước auth/render. Collection không đổi version giữ dữ liệu trình duyệt.
- Dữ liệu và `onboardai_seedVersions` được ghi theo transaction có rollback best-effort. Lỗi tải, JSON, schema, ID/email trùng hoặc ghi storage không được đánh dấu đã áp dụng.
- Trang chỉ gọi service. Chỉ `js/data/store.js` truy cập LocalStorage.

## Collection hiện hành

| Collection | Khóa/trường chính | Enum và quan hệ quan trọng |
|---|---|---|
| `users` | `id`, `fullName`, `email`, `password`, `role`, `departmentId`, `jobTitle`, `status`, `createdAt` | role: `newHire/mentor/hr/admin`; status: `active/inactive/invited`; email duy nhất |
| `newHires` | `id`, `userId`, `departmentId`, `jobTitle`, `mentorId`, `journeyId`, `startDate`, `status`, `notes` | user phải là NewHire; mentor phải là Mentor; phòng ban khớp user |
| `tasks` | `id`, `newHireId`, `journeyId`, `assignedTo`, nội dung, hạn, trạng thái, audit | status: `todo/inProgress/blocked/completed/archived`; journey/assignedTo khớp hồ sơ |
| `departments` | `id`, `name`, `description`, `managerId`, `status`, audit | status: `active/inactive` |
| `documents` | metadata, `fileUrl`, `departmentId`, `targetRole`, `status`, audit | URL HTTP(S) hoặc `assets/docs/...`; status: `draft/active/archived` |
| `checkins` | `id`, `newHireId`, `mentorId`, `scheduledAt`, `status`, `note`, `nextAction`, audit | không trùng `newHireId + mentorId + instant`; note riêng của Mentor |
| `journeys` | `id`, nội dung, `targetRole`, `departmentId`, `durationDays`, `status`, audit | duration 1–365; status `active/inactive` |
| `companyInfo` | singleton `company-001`, nội dung tổ chức, `logoUrl`, audit | logo HTTP(S) hoặc `assets/images/...` có thật |
| `news` | nội dung, category, status, feature/publish/archive timestamps | chỉ `published` hiển thị công khai |
| `aiMockData` | `featureType`, keywords, kết quả, lý do, nguồn, confidence, status | chỉ Policy Q&A, Checklist và một fallback; Progress Risk không dùng fixture |
| `aiHistory` | `draftId`, feature, owner, hire, input/result/reason, `aiSource`, `model`, decision, task IDs, archive/audit | source: `mock/gemini/rule-based`; decision: `pending/accepted/rejected`; owner-scoped |
| `settings` | singleton `system`, thông tin hỗ trợ và số ngày | onboarding 1–365; reminder 0–30; email hợp lệ |

Ngày không có giờ dùng `YYYY-MM-DD`. Thời điểm chấp nhận ISO hoặc thời gian Việt Nam `YYYY-MM-DD HH:mm` theo helper chung. Checker báo lỗi dưới dạng `collection/id/field` và kiểm tra foreign key, lịch trùng, URL cùng asset path.

## Quyền và phạm vi

- Session chỉ lưu `userId`; service đọc lại role/status từ users. Query URL không cấp hoặc truyền role.
- Mọi mutation gọi `requireRoles` và kiểm tra quan hệ đối tượng trong service. `permissions.js` cung cấp cùng rule cho route/action/field; `getEditableFields()` được dùng cho profile, user và newHire update.
- Profile chỉ tự sửa `fullName/email`. Admin quản lý tài khoản/phòng ban/settings; HR quản lý journey/hồ sơ và dashboard; Mentor chỉ ghi task/check-in cho mentee hiện tại; NewHire chỉ thao tác task/hồ sơ của mình.
- Password không được trả sang page. Input AI không bị quét bằng password của users; UI chỉ cảnh báo không nhập mật khẩu, token hoặc dữ liệu nhạy cảm.

## Vòng đời AI

1. Validate input và hiển thị trạng thái loading trong lúc service xử lý.
2. Generate trả draft có `draftId`; chưa ghi LocalStorage.
3. Edit/Regenerate chỉ thay draft.
4. Save gọi `saveHistoryDraft()` và tạo một history `pending`; gọi lại cùng `draftId` trả cùng bản ghi.
5. Accept/Reject lưu decision. Accept checklist lưu history và task trong cùng transaction; task ID theo `task-<historyId>-<index>` nên thử lại không nhân đôi.
6. History hỗ trợ đọc, sửa bản pending đã lưu ở service, lưu trữ và xóa khi không có task cần đối chiếu.

Policy Q&A chỉ trích dẫn document tồn tại và người dùng được đọc. Checklist dùng role tài khoản, `departmentId`, tên phòng ban, `journeyId`, tên hành trình, `jobTitle`, mục tiêu Mentor và task hiện có; kết quả Gemini phải qua schema/trùng lặp trước khi thành draft. Progress Risk tính từ tasks/check-ins/liên kết hiện tại, dùng tiến độ chung và coi thiếu dữ liệu là `unknown`; Gemini chỉ được bổ sung giải thích/đề xuất. Kết quả accepted tác động tới badge/thống kê dashboard HR.

## Snapshot seed hiện tại

Seed có 23 users, 12 newHires, 84 tasks, 13 departments, 15 documents, 12 checkins, 6 journeys, 1 companyInfo, 12 news, 21 aiMockData, 0 aiHistory và 1 settings. Các record và PDF không còn consumer đã được thu gọn; toàn bộ foreign key và asset path còn lại được checker xác minh.
