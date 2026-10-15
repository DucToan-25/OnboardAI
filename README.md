# OnboardAI – Danh sách mentee

## Thông tin bài làm

| Mục | Nội dung |
|-----|----------|
| **Tên đề tài** | OnboardAI – Hệ thống hỗ trợ hội nhập nhân sự mới |
| **Tên trang** | Danh sách mentee |
| **Đối tượng** | Người hướng dẫn (Mentor) |
| **Mục đích** | Cho phép mentor theo dõi danh sách nhân sự đang hướng dẫn, xem tiến độ onboarding, trạng thái và thực hiện các thao tác nhanh (xem chi tiết, giao việc, check-in). |

## Các chức năng chính

- **Thống kê nhanh**: Số mentee đang hướng dẫn, đúng tiến độ, cần hỗ trợ.
- **Tìm kiếm**: Lọc theo tên / email nhân sự (real-time).
- **Lọc trạng thái**: Tất cả / Đang hội nhập / Đúng tiến độ / Cần hỗ trợ.
- **Bảng danh sách (Desktop)**: Tên, phòng ban, thanh tiến độ, badge trạng thái, nút xem chi tiết.
- **Card danh sách (Mobile)**: Layout card với avatar, email, tiến độ, 3 nút thao tác.
- **Modal chi tiết**: Hiển thị thông tin đầy đủ của mentee khi bấm "Xem chi tiết" / "Chi tiết".
- **Responsive**: Desktop (≥769px) dùng bảng, Mobile dùng card + sidebar ẩn/hiện.

## Công nghệ sử dụng

- HTML5 (semantic: `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`)
- CSS3 (Flexbox, Grid, Media Query, CSS Variables)
- JavaScript thuần (DOM, Event, Array filter, render từ mảng object)
- Font: Inter (Google Fonts)

## Cấu trúc thư mục

```
project/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── main.js
├── data/
│   └── mentees.json
├── assets/
└── README.md
```

## Link

- **Figma**: *(https://www.figma.com/design/GPkcqM1oUPlitfbPCiOlx8/Untitled?node-id=5-7720&t=MzDEMYIJRj0bN2mQ-1)*
- **Video**: *(https://youtu.be/NK94jCIRlyw)*
- **GitHub**: *(https://github.com/tangphan/project_KTGK)*

## Cách chạy

1. Clone repository hoặc tải về.
2. Mở file `index.html` bằng trình duyệt (Chrome / Edge / Firefox).
3. Không cần server, không cần build.

## Dữ liệu

Nguồn: file Excel nhóm `OnboardAI.xlsx`

- Sheet `newHires` lọc `mentorId = user-003` (Lê Thu Hà – Mentor kỹ thuật)
- Join `users` (tên, email), `departments` (tên phòng ban)
- Tiến độ tính từ sheet `tasks` (số task completed / tổng task)
- Map trạng thái UI:
  - ≥ 70% → Đúng tiến độ
  - < 30% → Cần hỗ trợ
  - còn lại → Đang hội nhập

File: `data/mentees.json` (12 mentee). JS load bằng `fetch`.

## Ghi chú

- JavaScript tạo tương tác có ý nghĩa: tìm kiếm + lọc + mở modal chi tiết.
- Giao diện bám sát Figma Desktop & Mobile.
- Code dễ đọc, dùng semantic HTML, không chỉ toàn `div`.
