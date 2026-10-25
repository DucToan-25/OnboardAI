# Báo cáo refactor cuối OnboardAI

Ngày chốt kỹ thuật: 25/10/2026. Phạm vi đối chiếu: đề bài BTL-20, 19 route hiện có, mã nguồn/JSON/tài nguyên/tài liệu và working tree chưa commit. Báo cáo không thay thế Figma, PR/review, OBS hoặc kiểm tra thủ công của nhóm.

## A. Báo cáo cấu trúc

| File/thư mục cũ | Thao tác | Vị trí sau | Lý do | Cách xác nhận không mất chức năng |
|---|---|---|---|---|
| `js/data/auth.js` | Xóa | Consumer import `js/common/auth.js` | Alias hai dòng không còn cần thiết | Tìm toàn repo không còn import alias; 65 test và 19 route đạt |
| `js/pages/ad.js` | Xóa | Không thay thế | Module không có route/import/dynamic import | Static dependency audit không báo module thiếu |
| Ba CSS trang nhỏ: settings, thư viện HR, mentee list | Xóa | Dùng component/page CSS còn lại | Selector không còn consumer hoặc trùng style chung | Checker asset/style link đạt; smoke 19 route đạt |
| `assets/docs/doc-016.pdf`…`doc-100.pdf` | Xóa 85 file | Giữ `doc-001`…`doc-015` | Không còn document JSON nào tham chiếu | Checker đối chiếu mọi `fileUrl`; 15/15 PDF còn dùng tồn tại |
| `js/data/schema.js` | Thêm | `js/data/schema.js` | Một nơi kiểm schema/enum/ngày/URL seed | Store và checker dùng chung; test JSON/schema đạt |
| `js/config/ai-config.js` | Thêm/sửa | Giữ trong `js/config/` | Cấu hình model/mode/key/timeout tập trung | Test key in-memory, allowlist và timeout đạt |
| `js/services/gemini-api.js` | Thêm/sửa | Giữ trong `js/services/` | Chỉ phụ trách HTTP và lỗi Gemini | Test header, URL, HTTP 400/401/403/404/429/5xx, timeout, JSON đạt |
| `js/services/ai-service.js` | Thêm/sửa | Giữ trong `js/services/` | Tách nghiệp vụ AI khỏi HTTP | Test quyền Policy, schema/trùng Checklist và baseline Risk đạt |
| `js/common/ai-ui.js` | Thêm/sửa | Giữ trong `js/common/` | UI cấu hình/status/fallback dùng chung ba trang | Không còn inline style JS; label/ARIA được nối; smoke route đạt |
| `scripts/excel-to-json.cjs` | Giữ và sửa | `scripts/` | Vẫn hữu ích để nhập ba sheet, không có package ngoài | `node --check` đạt; dry-run đọc được workbook và chặn companyInfo sai singleton |
| JSON canonical | Sửa/thu gọn | `assets/data/` | Sửa ID/quan hệ/trùng lịch/dữ liệu chết, giữ dữ liệu đủ demo | Checker schema/foreign key/asset 0 lỗi; version đã tăng đúng collection |
| README và tài liệu hiện hành | Sửa/tinh gọn | Root + `docs/` | Đồng bộ Gemini/Mock, 65 test, 47 module và giới hạn | Rà soát text cũ; link/tên lệnh khớp source |

Số file theo snapshot Git trước refactor và trạng thái dự kiến sau refactor: 219 → 136 file (không tính `.git`; không tính `.vscode/launch.json` chưa track của người dùng). Tổng xóa 90 file, thêm 7 file dự án; giảm ròng 83 file.

## B. Báo cáo lỗi đã xử lý

| Mức độ | File/phạm vi | Nguyên nhân | Cách sửa | Kết quả |
|---|---|---|---|---|
| Nghiêm trọng | Store/version | Seed cũ không đồng bộ đủ thêm/sửa/xóa và có nguy cơ tiêu thụ version khi lỗi | Preflight đủ manifest/collection, transaction + rollback, version theo 12 collection | Test lỗi mạng/JSON/quota/version/reset đạt |
| Nghiêm trọng | AI history/checklist | Generate từng có thể bị hiểu là đã lưu; retry có thể tạo trùng/để ghi dở | Draft in-memory, `draftId`, transaction history + task, ID task ổn định | Save/Accept idempotent; Reject không tạo task |
| Nghiêm trọng | JSON/quan hệ | Sai `user-097`, task/journey lệch, 42 check-in trùng, companyInfo/AI fixture dư | Sửa quan hệ có căn cứ, bỏ bản ghi trùng/chết, tăng version | Checker 12 collection 0 lỗi |
| Cao | Gemini transport | Model từ DOM chưa bị khóa; lỗi upstream có thể bị phản chiếu; response/timeout test chưa chặt | Allowlist model, key header-only, lỗi thân thiện không kèm body, kiểm response/timeout | Integration test đạt; live API chưa kiểm vì thiếu key |
| Cao | Gemini nghiệp vụ | Có thể chấp nhận JSON thiếu/sai, task trùng hoặc AI đổi diễn giải risk thiếu kiểm soát | Validate object/field/giới hạn; chống trùng task; khóa level/progress/signals từ JS | Test adversarial Risk và Checklist đạt |
| Cao | Công cụ Excel | `--write` không tăng version và có thể nhập nhiều companyInfo | Ghi JSON + manifest cùng đợt có rollback; ép singleton `company-001` | Dry-run workbook sai bị từ chối, không ghi file |
| Trung bình | Auth/import | Alias `data/auth.js` tạo hai đường import | Chuyển ba consumer cuối về `common/auth.js`, xóa alias | Static audit còn 47 module, không import thiếu |
| Trung bình | AI UI | Label chưa liên kết control, nhiều style gán trong JS, callback cập nhật lặp | `htmlFor`/ARIA, class trong `components.css`, callback chỉ render lúc áp dụng | Source audit sạch `.style.*`; smoke đạt |
| Thấp | Tài liệu | README/report ghi không có Gemini, model 1.5, key trên URL, 58 test/48 module | Viết lại theo runtime và nêu rõ phần chưa kiểm chứng | Tài liệu hiện hành khớp kết quả cuối |

## C. Báo cáo chức năng

| Vai trò/tính năng | Dữ liệu | CRUD/hành động chính | Trạng thái kiểm thử | Hạn chế |
|---|---|---|---|---|
| NewHire | users/newHires/tasks/documents/aiHistory | Login/profile, task status/result, đọc tài liệu, Policy Q&A/history | Integration đạt; route smoke đạt | Chưa thao tác browser thủ công ở ba viewport |
| Mentor | newHires/tasks/checkins/documents/aiHistory | CRUD/archive task, create/update/cancel check-in, duyệt checklist | Integration quyền/scope/trùng lịch/idempotence đạt | Chưa quay OBS/E2E browser tương tác |
| HR | journeys/newHires/documents/company/news/tasks/checkins/aiHistory | CRUD journey/hồ sơ/tài liệu/tin; dashboard/risk | Integration quan hệ/quyền/progress đạt | Gemini live và UX thủ công chưa xác nhận |
| Admin | users/departments/settings/company/news | CRUD/vô hiệu hóa tài khoản, phòng ban, settings, reset | Integration validation/quyền/reset đạt | Auth chỉ là mô phỏng frontend |
| AI-1 Policy Q&A | aiMockData + tài liệu đọc được | Generate/Edit/Regenerate/Save/Accept/Reject/archive/delete | Mock và response Gemini giả lập đạt | Không có RAG/file content thật; live key chưa thử |
| AI-2 Checklist | hồ sơ + task hiện có + aiMockData | Draft 3–6 item, sửa/lưu/từ chối/chấp nhận tạo task | Schema, trùng lặp, transaction và retry đạt | Chất lượng ngữ nghĩa Gemini cần người dùng duyệt |
| AI-3 Progress Risk | tasks/newHires/checkins | Tính risk bằng JS; AI chỉ giải thích; lưu/quyết định/archive/delete | Baseline và response đối kháng đạt | Công thức demo, không phải mô hình dự báo HR thật |

## D. Báo cáo kỹ thuật

- 219 → 136 file dự án; JavaScript runtime 48 → 47 module sau khi bỏ auth alias. Giữ đủ 19 HTML route và 12 collection JSON.
- Không thêm dependency hoặc framework; `package.json` chỉ dùng Node để serve/check/test.
- Nguồn dữ liệu duy nhất là JSON canonical → store → service → page. Chỉ `store.js` truy cập LocalStorage.
- Auth dùng một implementation. Route/menu/quyền lấy session và user active, không lấy role từ query.
- AI tách bốn lớp rõ: config → HTTP adapter → business service → shared UI/page. Mock là mặc định; Gemini là tùy chọn.
- AI history lưu nguồn/model, không lưu key. Key chỉ trong memory và gửi bằng `x-goog-api-key`.
- CSS AI chuyển khỏi `element.style` sang component class; không đổi hệ màu/bố cục tổng thể.
- `.vscode/launch.json` là file chưa track có sẵn của người dùng và không bị sửa/xóa.

## E. Kết quả kiểm thử

| Kiểm tra | Kết quả cuối | Ghi chú |
|---|---|---|
| `npm test` | 65 PASS, 0 FAIL | Bốn role, CRUD, version/reset, AI lifecycle và Gemini adapter giả lập |
| `npm run check` | 0 lỗi, 0 cảnh báo | 19 route, 47 module, 12 collection, import/asset/schema/quan hệ |
| `node --check scripts/excel-to-json.cjs` | PASS | Cú pháp công cụ import |
| Dry-run `OnboardAI.xlsx` | Từ chối đúng dữ liệu không hợp lệ | Chặn 103 companyInfo ngoài singleton; không ghi workspace |
| `git diff --check` | PASS | Có thông báo autocrlf cho ba file nhưng không có whitespace error |
| Chrome Headless 155 | 19/19 URL PASS | Không có lỗi bootstrap/`ERROR:CONSOLE`; route bảo vệ smoke ở trạng thái chưa login |
| E2E nghiệp vụ bốn role | PASS ở tầng integration | Chưa tự động hóa thao tác browser đầy đủ |
| Desktop/tablet/mobile thủ công | Chưa xác nhận | Nhóm cần kiểm 1440×900, 768×1024, 390×844 và lưu ảnh/OBS |
| Gemini với key thật | Chưa xác nhận | Không có key hợp lệ được cung cấp; tuyệt đối không ghi key vào repo |

## F. Đánh giá theo đề bài CSE122

| Yêu cầu | Đánh giá | Căn cứ/việc còn lại |
|---|---|---|
| HTML5/CSS3/Vanilla JS/ES modules | Đạt | Không framework/build dependency |
| Bốn vai trò, ít nhất ba màn hình và navigation | Đạt | 19 route, menu/guard dùng chung |
| CRUD/trạng thái nghiệp vụ có ý nghĩa | Đạt | Integration test bốn vai trò và dữ liệu liên thông |
| DOM/event/form validation/search/filter/modal | Đạt | Module trang/helper chung và route smoke |
| JSON/LocalStorage/API phù hợp | Đạt | 12 JSON, version manifest, transaction/rollback; Gemini tùy chọn |
| Ba trải nghiệm AI có người dùng kiểm soát | Đạt | Mock ổn định; draft → giải thích → quyết định → ghi nghiệp vụ |
| Responsive và accessibility | Đạt một phần | Source có media query/ARIA/focus; cần kiểm thủ công ba viewport/bàn phím |
| Gemini API thật | Không thuộc phạm vi bắt buộc; chưa xác nhận live | Adapter/test giả lập đạt, thiếu key live |
| Git branch/commit/PR/review | Đạt một phần/chưa đủ bằng chứng | Repo có Git; nhóm phải cung cấp liên kết/quy trình thật |
| Figma/Canva, Trello/Jira/Notion, OBS | Chưa đạt bằng chứng | Các ô TODO được giữ, không tự bịa |

Kết luận: mã nguồn đạt baseline kỹ thuật tự động và giữ đầy đủ nghiệp vụ đã triển khai, nhưng không tuyên bố hoàn thành 100% bài nộp cho đến khi nhóm bổ sung kiểm tra responsive/bàn phím thủ công, Gemini live nếu muốn demo, cùng Figma/quản lý công việc/PR/OBS thật.
