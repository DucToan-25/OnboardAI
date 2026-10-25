# Báo cáo sử dụng AI và rà soát kỹ thuật

Ngày cập nhật: 25/10/2026. OnboardAI luôn chạy được bằng Mock Mode; Gemini Mode là tích hợp Frontend tùy chọn. Tài liệu này mô tả code hiện có, không xác nhận API thật đã kết nối khi chưa có key hợp lệ và bằng chứng trình duyệt.

## Ba tính năng AI

| Tính năng | Mock Mode bắt buộc | Gemini Mode tùy chọn | Kiểm soát trước khi ghi |
|---|---|---|---|
| Policy Q&A — SV1 | So khớp `aiMockData`, chỉ dùng tài liệu tài khoản được đọc | Gửi câu hỏi, danh mục tài liệu được đọc và chính sách đã xác thực; mã nguồn ngoài quyền bị loại và kết quả bị đánh dấu không chắc chắn | Generate/Edit/Regenerate chỉ tạo draft; Save/Accept/Reject mới ghi lịch sử của đúng tài khoản |
| Checklist Personalizer — SV2 | Dùng role, phòng ban, journey, chức danh và mục tiêu để chọn fixture | Gửi cùng bối cảnh và tiêu đề task hiện có; chỉ nhận 3–6 item đúng category/priority, không trùng tiêu đề hiện có | Mentor sửa/duyệt draft; Accept mới ghi history + task trong transaction với ID ổn định |
| Progress Risk — SV3 | JavaScript tính level, tiến độ, quá hạn, blocked và liên kết thiếu từ store | Gemini chỉ viết summary/reason/recommendations; level, tone, progress và signals luôn giữ từ JavaScript | HR kiểm soát Save/Accept/Reject; kết quả không tự đổi task hoặc hồ sơ |

## Kiến trúc hiện hành

- `js/config/ai-config.js`: Mock mặc định; allowlist `gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-3.6-flash`; timeout mặc định 20 giây; key chỉ nằm trong biến module.
- `js/services/gemini-api.js`: gọi `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`; key ở header `x-goog-api-key`; có AbortController, timeout, hủy request cũ, chuẩn hóa lỗi HTTP 400/401/403/404/429/5xx, mất mạng, response rỗng và JSON sai.
- `js/services/ai-service.js`: dựng context theo quyền, chọn Mock/Gemini và kiểm tra dữ liệu không tin cậy từ model trước khi tạo draft.
- `js/common/ai-ui.js`: status bar, modal cấu hình, nhãn gắn với control, vùng trạng thái live, badge nguồn và thao tác thử lại/chuyển Mock.
- `js/data/ai-history.js`: lưu `aiSource` và `model` để lịch sử không phải suy đoán nguồn; không lưu API key.

Code đối chiếu REST endpoint/header/model với tài liệu chính thức Google Gemini API ngày 25/10/2026. Model được khóa trong allowlist; không nhận ID tùy ý từ DOM.

## Bảo mật và giới hạn

- Key không được hardcode, không ghi LocalStorage/SessionStorage/JSON/`aiHistory`, không đặt trong URL và không chèn vào lỗi/console.
- UI chỉ hiển thị key đã che. F5 hoặc đóng trang làm mất key.
- Request trực tiếp từ trình duyệt vẫn lộ key trong DevTools Network; chỉ phù hợp demo có kiểm soát. Bản công khai cần backend/proxy, nằm ngoài phạm vi CSE122 này.
- Gemini không được coi là nguồn dữ liệu chuẩn. Policy source ID, checklist schema/trùng lặp và Progress Risk baseline đều được JavaScript kiểm tra.
- Không có API key hợp lệ trong phiên rà soát này, vì vậy kết nối Gemini live chưa được đánh dấu PASS. Test dùng response HTTP giả lập; Mock Mode được kiểm thử tự động và không cần Internet.

## Kiểm thử hiện hành

| Kiểm tra | Kết quả | Phạm vi |
|---|---|---|
| `npm test` | 65 đạt, 0 thất bại | Vòng đời draft, source permission, schema checklist, risk baseline, key in-memory, header/URL, HTTP errors, timeout, JSON sai và fallback Mock cùng các luồng nghiệp vụ khác |
| `npm run check` | 0 lỗi, 0 cảnh báo | 19 route, 47 module JavaScript, import/asset, schema/enum/ID/foreign key và quy tắc storage |
| `git diff --check` | Chạy ở bước nghiệm thu cuối | Whitespace và conflict marker |
| Gemini live | Chưa kiểm chứng | Cần key hợp lệ do nhóm tự nhập trong phiên demo; không đưa key vào repository |

## Cách demo

1. Chạy `npm run serve`, mở http://127.0.0.1:8000/ và đăng nhập bằng tài khoản trong README.
2. Mock: mở trang AI tương ứng vai trò và Generate; status bar phải ghi Mock, không phát sinh request Internet.
3. Gemini: chọn **Cấu hình AI**, nhập key tạm, chọn model, bấm **Kiểm tra kết nối**, rồi **Lưu & Áp dụng**. Chỉ coi là đã kết nối khi phép thử trả thành công.
4. Với key sai, mất mạng hoặc quota: kiểm tra nút **Thử lại** và **Chuyển sang Mock Mode**. Xác nhận lịch sử/task không đổi trước khi người dùng Save/Accept/Reject.

## Khai báo AI hỗ trợ phát triển

| Nội dung | Ghi nhận của phiên rà soát chung |
|---|---|
| Công cụ | OpenAI Codex hỗ trợ kiểm kê, sửa code, viết test và đồng bộ tài liệu |
| Prompt chính | Yêu cầu cuối: tối ưu/tái cấu trúc toàn bộ OnboardAI, giữ 19 route, CRUD và ba trải nghiệm AI; kiểm tra JSON/LocalStorage/Gemini và báo cáo minh bạch |
| Phần AI hỗ trợ tạo/sửa | Schema checker, test hồi quy, vòng đời draft idempotent, adapter Gemini, UI cấu hình/fallback, tài liệu kỹ thuật và các patch dọn dependency/asset |
| Phần cần sinh viên review | Nghiệp vụ theo owner SV1/SV2/SV3, wording UI, model/prompt, thay đổi trực tiếp khi bảo vệ và mọi bằng chứng Git/PR/OBS/Figma |
| Lỗi phát hiện từ nội dung AI | Tài liệu ghi model 1.5 và key trên URL dù code dùng model 3.x/header; alias auth dư; response Gemini chưa kiểm tra đủ chặt; test chưa thực sự kiểm timeout |
| Cách kiểm chứng | Đọc source/dependency, đối chiếu đề bài và tài liệu Google chính thức, chạy static checker/integration test/diff check; phần browser/Gemini live ghi riêng nếu chưa có bằng chứng |
| Điều rút ra | Kết quả LLM phải là draft không đáng tin, luôn bị kiểm quyền/schema/quan hệ và chỉ tác động nghiệp vụ sau quyết định của người dùng |

Mỗi thành viên phải bổ sung prompt/công cụ và phần tự chỉnh sửa của chính mình nếu đã dùng AI ngoài phiên rà soát chung. Không dùng bảng này thay cho minh chứng cá nhân, commit, PR hoặc OBS.
