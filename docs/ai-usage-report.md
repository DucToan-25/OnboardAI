# Báo cáo AI hỗ trợ sửa giao diện

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
