# Báo cáo AI hỗ trợ sửa giao diện

## UI-05 — khôi phục mật khẩu — 08/10/2026

- Thay hướng dẫn quên mật khẩu gây nhầm bằng luồng xác minh email + số điện thoại và form đặt mật khẩu mới trong cùng modal. Dùng users/repository và validation chung; không tạo trang/helper riêng.
- Vì adapter hiện `write=false`, kết quả thành công ghi rõ là preview, không giả gửi email hoặc lưu mật khẩu. Nút Liên hệ HR vẫn giữ cho trường hợp cần hỗ trợ.

## Shell chung và UI-17 — yêu cầu 07/10/2026

- Codex sửa layout chung: logo header là toggle duy nhất, bỏ hamburger/dấu X sidebar và tiêu đề lặp; desktop mở rộng nội dung khi đóng, mobile giữ drawer/accessibility. Xóa selector/markup cũ, không dựng shell theo từng role.
- Thay form cấu hình AI mẫu bằng Quản lý hệ thống: số liệu từ repository, thông tin tổ chức, quy tắc hội nhập, liên kết tài khoản/phòng ban/tài liệu, phạm vi từ ROLE_MENUS. Giữ filename, quyền Admin, preview/validation/Hủy/khôi phục; seed/schema/field permissions cập nhật đồng bộ. Fixture AI không bị xóa để các trang AI tiếp tục dùng.
- Tái sử dụng card/form/field/table/alert/confirm của common, sửa SVG instance để icon không bị tô đen. Không thêm dependency hoặc backend. Owner review/OBS do nhóm bổ sung; kết quả kiểm tra ghi trong ui-validation.md.

Lần sửa theo yêu cầu: khắc phục các điểm không đúng quy tắc được rà soát ngày 06/10/2026. Codex kiểm tra/sửa theo owner bằng các agent song song trên cùng repository. Đây là ghi nhận hỗ trợ của phiên làm việc; mỗi thành viên cần tự xác nhận phần của mình và bổ sung minh chứng/OBS thực tế.

## SV1 — UI-01 đến UI-06 và CSS component

Codex hỗ trợ tái sử dụng task-item ở checklist, giới hạn field hồ sơ theo contract profile, phục hồi baseline sau preview, loading/error thư viện, nhãn/draft sửa câu trả lời và timestamp AI. Xóa CSS rỗng/selector thừa, dùng lại form/card, chuyển base/components sang style dễ đọc. Không thêm trang/profile/data riêng cho role.

Kiểm tra source: sáu module cú pháp và cấu trúc/ID/tài nguyên sáu HTML. Kiểm tra trình duyệt tổng hợp gồm profile bốn role/hai newhire, render 18 trang ở ba viewport và các tương tác được mô tả trong ui-validation.md.

## SV2 — UI-07 đến UI-12 và helper/dữ liệu

Codex khôi phục DOM thư viện/danh sách mentee, thay bản JS giao việc bị chép bằng form task và AI checklist đúng phạm vi, sửa check-in ngày giờ/URL/draft/xác nhận. Dùng STATUS_META, permissions, ui/renderers/validation/format chung; fixture AI ở seed, không tạo kho hoặc gọi AI thật. Module error/detail tiếp tục dùng chung.

Kiểm tra source: các module sửa đạt cú pháp/hook DOM/import; kiểm tra tích hợp repository xác nhận scope/quyền, ID/status, ngày giờ và preview không ghi kho. Các scenario và thao tác trình duyệt được ghi tại ui-validation.md.

## SV3 — UI-13 đến UI-18, shell và tích hợp

Codex sửa baseline/ghi chú settings, draft AI risk và kịch bản thiếu dữ liệu/lỗi, hợp nhất nhãn trạng thái, quyền action/field và cảnh báo tham chiếu. Dùng component/helper/repository hiện có; 404 giữ module error. Khung chung đăng ký class, reflow, bootstrap và menu dùng một nguồn; thêm hướng dẫn HTTP, contract, kiểm tra và cấu hình UTF-8/LF.

Kiểm tra source: năm module trang và hook DOM tương ứng; kiểm tra tích hợp 32 JS/18 route, seed/quyền/helper; HTTP và trình duyệt ở 1440/768/390px. Chưa xác nhận độ khớp Figma cho toàn bộ 18 trang do thiếu bộ thiết kế đầy đủ.

## Phần nhóm tiếp tục xác nhận

- Mỗi thành viên đọc, giải thích và tự kiểm tra code phần mình; ghi task/PR/reviewer thực tế.
- Bổ sung ảnh/video OBS theo màn hình được duyệt, không tự tính modal thành màn hình riêng.
- Chốt persistence, CRUD, đăng nhập nghiệp vụ và AI thật ở đợt sau; phiên này chỉ sửa giao diện và hợp đồng đọc/preview.

## Bổ sung UI-PUBLIC — 07/10/2026

- Bổ sung theo yêu cầu menu sinh động: transition màu/gạch chân, tự đánh dấu section khi cuộn, hash/back-forward và resize. Chỉ sửa HTML/CSS/JS index, dùng state chuẩn và ARIA, hỗ trợ reduced motion; không thêm thư viện.

- Yêu cầu tiếp theo: giữ logo/menu khi cuộn và tối ưu mobile. Codex chỉnh CSS trang index: sticky, khoảng cuộn tới section, header mobile hai hàng, dùng ô tìm kiếm sẵn có trong Tin tức. Không thêm HTML mobile, JS cuộn hoặc thư viện.

- Yêu cầu: dựng root index.html theo ảnh Onvera, tái sử dụng CSS/JS, nối login và các nút phụ, chuẩn bị đổ dữ liệu.
- Codex hỗ trợ HTML/CSS/module trang, route công khai, kết nối portalPosts vào repository/permissions/seed chung và tài liệu contract. Không thêm framework, backend, auth mới hoặc kho dữ liệu riêng.
- Tái sử dụng button/card/toolbar/badge/pagination/modal, format, icon và entry main. CSS đặc thù chỉ trong index.css. Các nội dung nội bộ/chính sách chưa có thể hiện rõ trạng thái chờ; ảnh bài viết dùng icon thay thế.
- Patch components.css triển khai pagination theo registry có sẵn và nét vẽ btn__icon; không thêm class component công khai. Cần owner review trước merge. Kiểm tra integration/HTTP/browser và prefix triển khai đều qua; 57 tổ hợp trang/viewport.
- Task bổ sung do SV3 điều phối theo phạm vi shell, không đại diện minh chứng cá nhân của cả ba SV. Owner review, OBS và xác nhận nội dung chính thức do nhóm bổ sung; xem ui-validation.md cho kiểm tra kỹ thuật.

## Dọn giao diện tĩnh — 15/10/2026

Theo yêu cầu chung của người dùng, Codex chuyển nội dung thiết kế sang HTML tĩnh, giữ 19 màn hình và helper UI dùng chung; bỏ seed, auth/repository mô phỏng, nút chọn demo, bộ chọn tình huống AI, ảnh tham chiếu và các script/cache kiểm thử. Đây là task dọn chung theo yêu cầu trực tiếp, không thay phân công owner/reviewer.

Kiểm tra bằng Chrome headless cục bộ: 19 trang ở 1440/768/390px không lỗi khởi tạo, console, tài nguyên, ID trùng hay cuộn ngang; kiểm tra modal/validation, bộ lọc, khôi phục form, sidebar và ID tài liệu. Kiểm tra dependency xác nhận các module dữ liệu đã bỏ không còn được import hoặc request. Script và ảnh kiểm tra tạm được xóa sau khi chạy; các báo cáo test cũ được nhắc ở phần lịch sử phía trên cũng đã dọn. Không có đăng nhập, lưu dữ liệu hoặc AI thật.

## SV1 — LocalStorage và đăng nhập bằng mật khẩu — 18/10/2026

Yêu cầu: triển khai toàn bộ phần SV1 trong OnboardAI_QuyTac_LocalStorage.md, dùng password người dùng đã thêm vào users.json, rồi rà soát mã nguồn toàn dự án.

Codex triển khai store/auth/people/ai-history; nối sáu màn hình SV1 và trang chủ; bổ sung phần dịch vụ đọc/cập nhật trạng thái tối thiểu của tasks/resources/organization để tránh bản lưu riêng. Sửa shell/route/logout theo phiên; detail đọc document đúng ID/quyền; đồng bộ role newHire, ngày Việt Nam và tài liệu bàn giao. Người dùng đã sửa users.json trước task; mật khẩu được giữ nguyên khi chuyển toàn bộ JSON sang assets/data. Không tạo tài khoản demo hoặc mật khẩu mới trong seed.

Tái sử dụng component CSS, modal/xác nhận/toast, form validation, avatar/icon và bố cục hiện có; không thêm framework, package build hoặc CSS hệ mới. Profile chỉ ghi fullName/email; quản trị tài khoản/hồ sơ qua API people. Thao tác nhiều khóa có ID ổn định và khả năng thử lại, không tuyên bố có giao dịch như database. Policy Q&A là tra cứu mock, có fallback, nguồn và lịch sử theo user; không gọi AI thật.

Kiểm tra đã chạy:

- 29 kiểm tra dịch vụ: init dùng chung Promise; không seed lại []; fetch lỗi/JSON lỗi/ID trùng/quota/quyền storage; schema chưa hỗ trợ; mật khẩu/session; profile whitelist/email duy nhất; quyền task; completedAt; AI owner/pending/fallback/xóa; thử lại tạo user/hire và chuyển phòng ban; reset đúng namespace; ngày Việt Nam.
- 50 kiểm tra Chrome headless: đăng nhập form thực tế, task giữ sau điều hướng, profile/header cập nhật, chống role/userId query, Policy Q&A/sửa lịch sử, thư viện/detail/ID lỗi, profile bốn role, các module trang và logout.
- 70 kiểm tra Chrome bổ sung: 19 trang × 3 viewport 1440/768/390px không tràn ngang toàn trang/ID trùng/lỗi khởi tạo; đổi tài khoản giữa tab, đăng xuất, profile/task đồng bộ, reset có xác nhận, JSON hỏng/schema sai có màn hình phục hồi, modal/drawer mobile và Escape. Không có ngoại lệ JavaScript chưa xử lý. Đã xem ảnh checklist mobile, bảng cuộn trong vùng riêng theo bố cục hiện có.
- Cú pháp 37 module JavaScript; đường dẫn tài nguyên/import trong HTML/JS không thiếu; git diff --check sạch. Kiểm tra JSON không có ID trùng; nội dung seed ngoài password đã được cung cấp không thay đổi.
- 5 kiểm tra cuối sau chỉnh giao diện: email trùng báo ngay cạnh trường nhập; badge task dashboard hiển thị và không gây tràn ngang ở cả ba viewport; không có ngoại lệ trình duyệt. Tổng đợt: 29 kiểm tra dịch vụ và 125 kiểm tra trình duyệt.

Phát hiện dữ liệu giữ nguyên để bàn giao: task-004/hire-002 lệch journeyId (dịch vụ chặn cập nhật), 42 nhóm check-in trùng lịch và 100 fileUrl không có tệp. Các bất nhất timestamp cũ nằm trong quy tắc LocalStorage, không tự đoán để sửa seed. Tệp tài liệu thiếu được báo rõ trên detail, không hiển thị chính sách tĩnh không thuộc dữ liệu.

Các trang CRUD mentor/HR/Admin, Checklist Personalizer, Progress Risk, việc cá nhân mới và quên mật khẩu vẫn chưa nối nghiệp vụ; đây là phần SV2/SV3 hoặc ngoài hợp đồng SV1. Rà soát khởi tạo/giao diện của chúng không phải xác nhận nghiệp vụ hoàn tất. Owner review và minh chứng OBS của nhóm vẫn cần thực hiện trước merge.

Script/ảnh/hồ sơ Chrome kiểm thử đặt ngoài repo trong thư mục tạm. Không có commit, merge hoặc triển khai hosting trong nhiệm vụ này.
