# OnboardAI – Phân công và quy tắc LocalStorage

## Bổ sung triển khai SV1 — 18/10/2026

Người dùng yêu cầu triển khai toàn bộ SV1 và sử dụng trường `password` đã bổ sung cho 97 tài khoản. Bộ JSON đã được chuyển nguyên nội dung từ `data-json/` sang `assets/data/`, không có bản sao seed thứ hai. Quy tắc này thay phần dữ liệu tĩnh/preview cũ trong AGENTS.md.

- `auth.login(userIdOrEmail, password)` thay chữ ký `login(userId)` đề xuất ban đầu; không có lối đăng nhập bỏ qua mật khẩu. Chỉ tài khoản active, role hợp lệ được vào. `getCurrentUser()` và people trả user không chứa password; khóa phiên chỉ chứa userId. Mật khẩu trong JSON/LocalStorage là dữ liệu mô phỏng có thể đọc từ trình duyệt; không dùng mật khẩu thật hoặc coi là bảo mật server.
- Profile tự sửa fullName/email. Các trường mật khẩu/role/departmentId/jobTitle/status được quản trị qua people, không nhận patch tùy ý từ trang cá nhân. Quên mật khẩu hiện hướng dẫn liên hệ quản lý; không giả xác minh số điện thoại hoặc gửi email.
- `people.js`: getMyHire(), getMyProfile(), updateMyProfile(patch), listUsers() (Admin), listHires() (Admin/HR hoặc mentee của Mentor), createUser(input), updateUser(id, patch) (Admin), updateHire(id, patch) (Admin/HR). Chuyển phòng ban cần Admin, kiểm tra trước rồi cập nhật users/newHires; lỗi giữa hai lần ghi yêu cầu thử lại cùng ID và phòng ban.
- Tạo tài khoản kèm hồ sơ: gọi prepareNewHireCreation() một lần, giữ `{ userId, hireId }` trong form; gọi createNewHireAccount(userInput, hireInput, operation). Khi lỗi lưu bước sau, giữ operation để thử lại. Email duy nhất và ID ổn định ngăn tạo trùng. Không tự thêm timestamp vào newHires.
- `ai-history.js`: createHistory(input), listMyHistory(featureType), getHistory(id), updateHistory(id, patch), decideHistory(id, decision), deleteHistory(id), askPolicy(question). Chỉ chủ sở hữu được đọc/sửa/xóa; kết quả chỉ sửa lúc pending. Q&A tự lưu pending sau khi tra cứu thành công; nút Lưu xác nhận bản ghi đã có, không tạo bản sao.
- Bàn giao SV2: completeChecklistHistory(historyId, taskIds) chỉ chấp nhận sau khi kiểm tra đủ tasks đã lưu; ID task ổn định là `task-${historyId}-${index}` (index bắt đầu 0). Không cho decideHistory chấp nhận checklist để bỏ qua applyChecklist. Lịch sử đã có task tham chiếu không được xóa.
- `store.subscribe(collection, callback)` trả hàm hủy đăng ký; hỗ trợ collection, currentUser, schemaVersion hoặc `*`. removeHistory(id) là API lưu trữ nội bộ chỉ dành cho ai-history sau khi kiểm tra quyền/tham chiếu; không có hàm xóa chung cho các collection khác.
- Phụ thuộc tối thiểu đã nối: tasks.getTasksForHire/getProgress/updateTaskStatus, resources.getReadableDocuments/getDocument, organization.getCompanyInfo/getPublishedNews. getProgress trả `{ total, completed, percent }`, bỏ archived. SV2/SV3 tiếp tục CRUD trong chính các module này, không tạo bản song song.
- Quy ước audience của documents hiện tại: targetRole `all` đọc toàn công ty khi active; `newhire` ánh xạ role `newHire`; `engineer` thuộc dept-engineering. Audience cụ thể còn phải khớp departmentId (hoặc departmentId null). HR/Admin đọc metadata mọi trạng thái. Không đổi giá trị seed.
- `task-004` tham chiếu journeys-001 nhưng hire-002 đang ở journeys-002: giữ nguyên seed và chặn cập nhật khi liên kết lệch. 100 fileUrl của documents chưa có tệp trong repo, trang detail báo thiếu tệp thay vì tạo nội dung chính sách giả.

Các màn hình CRUD mentor/HR/Admin, Checklist Personalizer và Progress Risk chưa được triển khai trong nhiệm vụ SV1 này. Hợp đồng các phần còn lại bên dưới vẫn là việc bàn giao cho owner tương ứng.

Áp dụng cho giai đoạn đưa dữ liệu JSON vào website Frontend CSE122. Vai trò hiện tại: SV1 phụ trách nhân sự mới, SV2 phụ trách mentor, SV3 phụ trách HR/Admin. Đây là hợp đồng triển khai đề xuất cho nhóm, không phải mô tả các hàm đã có sẵn trong mã nguồn.

Mục tiêu: ba thành viên dùng chung dữ liệu, tên trường, hàm thao tác và trạng thái khi ghép code. LocalStorage chỉ chia sẻ giữa các trang cùng origin trong cùng hồ sơ trình duyệt; không tự đồng bộ dữ liệu giữa ba máy. Git đồng bộ mã nguồn và JSON khởi tạo, không đồng bộ LocalStorage.

## 1. Phân công tổng thể

| Người | Phần chịu trách nhiệm | Sản phẩm bàn giao |
|---|---|---|
| SV1 | Bộ lưu trữ chung, đăng nhập mô phỏng, hồ sơ, luồng nhân sự mới, Policy Q&A | `store.js`, `auth.js`, `people.js`, `ai-history.js` và JS màn hình của SV1 |
| SV2 | Nghiệp vụ giao việc, check-in, dịch vụ phòng ban/tài liệu, Checklist Personalizer | `tasks.js`, `resources.js` và JS màn hình mentor |
| SV3 | Hành trình, thông tin công ty, tin tức, HR/Admin, Progress Risk, tích hợp | `organization.js`, JS màn hình HR/Admin và kiểm thử luồng chung |

Tên file dưới đây là quy ước đề xuất. Nếu dự án đã có module cùng nhiệm vụ, dùng lại module đó và thống nhất tên import, tránh tạo hai bản làm cùng một việc.

**Người viết module không đồng nghĩa với vai trò được sử dụng chức năng.** Ví dụ SV2 viết dịch vụ phòng ban, SV3 gọi dịch vụ đó ở trang Admin; SV1 viết dịch vụ tài khoản, SV3 gọi ở trang quản lý tài khoản.

## 2. Quy tắc chung bắt buộc

### 2.1. Một nơi đọc/ghi LocalStorage

- Chỉ `js/data/store.js` gọi trực tiếp `localStorage.getItem/setItem/removeItem` và chuyển đổi `JSON.parse/stringify`.
- Module nghiệp vụ kiểm tra quyền, quan hệ ID và dữ liệu trước khi gọi `store.js`.
- JS màn hình gọi module nghiệp vụ; không sửa trực tiếp mảng rồi ghi lại bằng một phiên bản hàm lưu riêng.
- Tách theo nhiệm vụ: màn hình xử lý DOM; module nghiệp vụ xử lý điều kiện; `store.js` xử lý lưu trữ. Không thêm framework hoặc lớp trừu tượng khi chưa cần.
- Dùng ES module: `import/export` và `<script type="module">`.

Luồng thống nhất: **Thao tác người dùng → kiểm tra nghiệp vụ → ghi LocalStorage → đọc kết quả → cập nhật giao diện.** Chỉ báo thành công khi thao tác ghi đã thành công.

### 2.2. Tên collection, file và khóa

Các JSON đặt tại `assets/data/`. Mười collection đều là mảng object, kể cả `companyInfo`.

| Collection / file JSON | Khóa LocalStorage | Người quản lý module ghi |
|---|---|---|
| `users` / `users.json` | `onboardai_users` | SV1 |
| `newHires` / `newHires.json` | `onboardai_newHires` | SV1 |
| `tasks` / `tasks.json` | `onboardai_tasks` | SV2; SV1 gọi hàm cập nhật tiến độ |
| `departments` / `departments.json` | `onboardai_departments` | SV2; SV3 gọi từ trang Admin |
| `documents` / `documents.json` | `onboardai_documents` | SV2; SV3 gọi từ thư viện HR |
| `checkins` / `checkins.json` | `onboardai_checkins` | SV2 |
| `journeys` / `journeys.json` | `onboardai_journeys` | SV3 |
| `companyInfo` / `companyInfo.json` | `onboardai_companyInfo` | SV3; SV1 đọc để hiển thị |
| `news` / `news.json` | `onboardai_news` | SV3; SV1 đọc tin đã xuất bản |
| `aiMockData` / `aiMockData.json` | `onboardai_aiMockData` | SV1 quản lý khởi tạo; cả nhóm chỉ đọc lúc chạy |

Không tạo `company-info.json`, `sv1_tasks`, `mentorTasks` hoặc bản sao tương tự. Không dùng một collection tasks riêng cho mỗi vai trò.

Khóa bổ sung được thống nhất ngay từ đầu:

| Khóa | Dạng dữ liệu | Mục đích |
|---|---|---|
| `onboardai_currentUser` | `{ "userId": "user-001" }` hoặc không có khóa | Tài khoản đang đăng nhập mô phỏng |
| `onboardai_aiHistory` | Mảng, ban đầu `[]` | Lưu kết quả và quyết định của người dùng với AI |
| `onboardai_schemaVersion` | Số, ban đầu `1` | Phiên bản cấu trúc dữ liệu |

Các khóa trên cũng đi qua `store.js`. Nếu triển khai trang cài đặt hệ thống, SV3 đề xuất trước cấu trúc `onboardai_settings`, mặc định và trường được phép sửa; không tự thêm khóa trong JS màn hình.

### 2.3. Khởi tạo và nạp lại trang

1. Mọi trang cần dữ liệu phải `await initStore()` trước khi đọc dữ liệu hoặc kiểm tra đăng nhập.
2. Chỉ lấy JSON để khởi tạo khi khóa tương ứng **chưa tồn tại** (`getItem(key) === null`). Mảng `[]` là dữ liệu hợp lệ, không phải lý do nạp lại seed.
3. Kiểm tra phản hồi fetch, JSON là mảng, có ID và không trùng ID trước khi lưu. Lỗi tải phải được hiển thị và cho thử lại.
4. Khi đã khởi tạo, trang đọc dữ liệu từ LocalStorage. F5 không được nạp JSON đè lên các thay đổi của người dùng.
5. JSON lỗi hoặc LocalStorage lỗi không được âm thầm thay bằng `[]`; báo lỗi rõ và giữ dữ liệu cũ.
6. Một trang có nhiều module gọi `initStore()` phải dùng chung một Promise khởi tạo để tránh chạy lặp.
7. Đường dẫn JSON được xác định từ vị trí module, ví dụ `new URL('../../assets/data/users.json', import.meta.url)` khi module nằm ở `js/data/store.js`.
8. Chạy bằng Live Server hoặc máy chủ tĩnh. Khi kiểm tra luồng chung phải dùng cùng giao thức, hostname và port; `localhost` khác `127.0.0.1`.

Khi seed thay đổi, dữ liệu đã lưu sẽ không tự đổi. Nhóm dùng nút “Đặt lại dữ liệu demo” có xác nhận, hoặc viết chuyển đổi phiên bản nếu cần giữ dữ liệu. Không tự reset lúc mở trang. Nếu gặp schemaVersion chưa hỗ trợ, dừng ghi và báo cần nâng cấp/đặt lại.

### 2.4. Hợp đồng hàm lưu trữ

SV1 viết các hàm sau trong `store.js`; các thành viên thống nhất chữ ký trước khi viết màn hình:

| Hàm | Kết quả / trách nhiệm |
|---|---|
| `initStore()` | Promise; khởi tạo collection còn thiếu |
| `getAll(collection)` | Trả mảng dữ liệu vừa đọc |
| `getById(collection, id)` | Trả object hoặc `null` |
| `create(collection, item)` | Kiểm tra ID, lưu và trả object mới |
| `update(collection, id, patch)` | Đọc bản mới nhất, ghép trường được cập nhật, giữ ID và các bản ghi khác; trả object đã lưu |
| `getCurrentUserId()` / `setCurrentUserId(id)` / `clearCurrentUser()` | Đọc/ghi/xóa khóa tài khoản hiện tại |
| `resetDemoData()` | Xóa đúng danh sách khóa dự án rồi khởi tạo lại sau xác nhận ở giao diện |

`create/update` là hàm nội bộ dành cho module nghiệp vụ. Màn hình không được gọi chúng để bỏ qua điều kiện nghiệp vụ. Collection không nằm trong danh sách đăng ký phải bị từ chối. Không tìm thấy ID khi cập nhật phải báo lỗi; không tự biến thành thao tác thêm.

Chưa cần hàm xóa chung. Dùng cập nhật trạng thái theo từng thực thể. Nếu cần xóa vật lý, chủ module phải kiểm tra bản ghi có đang được nơi khác tham chiếu hay không.

### 2.5. ID, kiểu dữ liệu và thời gian

- Giữ nguyên tên trường camelCase và ID đang có trong JSON. Không tự sửa ID có hai dấu gạch nối chỉ để làm đẹp.
- Bản ghi mới dùng `prefix + '-' + crypto.randomUUID()`, ví dụ `task-<uuid>`, và kiểm tra trùng trước khi ghi. Không dùng `array.length + 1`.
- Prefix dùng chung: `user`, `hire`, `task`, `dept`, `doc`, `checkin`, `journeys`, `company`, `news`, `ai-history`.
- Liên kết bằng ID, không bằng tên: `newHires.userId → users.id`, `tasks.newHireId → newHires.id`, `tasks.journeyId → journeys.id`.
- Khi giao việc, `assignedTo` phải bằng `userId` của hồ sơ newHire được chọn. Mentor phải có role `mentor` và đang hoạt động.
- Trường trống giữ `null`; không lưu chuỗi `"null"`/`"undefined"`. `durationDays`, `confidence` là số; `isFeatured` là boolean.
- Ngày lịch như `dueDate`, `startDate` dùng `YYYY-MM-DD`. Dấu thời gian mới như `createdAt`, `updatedAt`, `completedAt` dùng `new Date().toISOString()`; không lưu chuỗi định dạng tiếng Việt.
- Seed hiện có cả `YYYY-MM-DD` và `YYYY-MM-DD HH:mm`. Dùng một hàm đọc ngày chung: nhận diện từng dạng, hiểu dạng không có múi giờ theo giờ Việt Nam, dạng ISO có múi giờ theo offset của nó. Không so sánh chuỗi có định dạng khác nhau và không dựa vào `Date.parse()` với chuỗi có dấu cách.
- Chỉ cập nhật trường thời gian có trong schema của collection. Không tự thêm `createdAt/updatedAt` vào `newHires` hoặc `aiMockData` khi nhóm chưa thống nhất schema mới.
- Giữ `createdAt` khi sửa; cập nhật `updatedAt` nếu có. Khi task hoàn thành, đặt `completedAt`; nếu mở lại thì đặt `completedAt = null`. Dữ liệu mới phải có thứ tự thời gian hợp lệ.

### 2.6. Trạng thái và quyền

Bảng dưới là tập giá trị đề xuất cho nghiệp vụ. Những giá trị mở rộng chưa có trong seed phải được chủ module bổ sung vào validation, filter và giao diện cùng lúc.

| Collection | Giá trị thống nhất |
|---|---|
| `users` | `active`, `invited`, `inactive` |
| `newHires` | `notStarted`, `inProgress`, `completed`, `archived` |
| `tasks` | `todo`, `inProgress`, `completed`, `blocked`, `archived` |
| `departments`, `journeys` | `active`, `inactive` |
| `documents` | `draft`, `active`, `archived` |
| `checkins` | `scheduled`, `completed`, `cancelled` |
| `news` | `draft`, `published`, `archived` |
| `aiMockData` | `active`, `inactive` |

Role dùng đúng `newHire`, `mentor`, `hr`, `admin`. Priority của task dùng `low`, `medium`, `high`. `companyInfo` hiện không có trường status; không thêm thao tác archive chung cho collection này.

- Nhân sự mới chỉ xem dữ liệu cá nhân được phép và đổi tiến độ task thuộc mình; không đổi `assignedTo`, `journeyId`, hạn hoàn thành, role hoặc mentor.
- Mentor chỉ quản lý task/check-in của mentee có `newHires.mentorId` bằng ID của mình.
- HR quản lý onboarding, hành trình, tài liệu, tin tức, nội dung công ty và xem báo cáo theo nghiệp vụ.
- Admin quản lý tài khoản, phòng ban, cài đặt và có quyền quản trị; dùng cùng dịch vụ nghiệp vụ.
- Thông tin công ty và tin `published` được đọc ở trang công khai. Hồ sơ, task, lịch hẹn và bản tin nháp cần kiểm tra quyền.
- Kiểm tra quyền và trường được sửa trong hàm nghiệp vụ mỗi lần lưu, không chỉ ẩn nút. Lấy role hiện tại từ `users`, không tin role truyền từ form hay bản sao cũ.
- Đây là mô phỏng quyền trên Frontend, không phải cơ chế bảo mật của máy chủ.

### 2.7. Đồng bộ trang và tránh ghi đè

- Mỗi lần cập nhật phải đọc lại collection, tìm theo ID và sửa đúng bản ghi. Không ghi lại bản sao toàn bộ mảng đã giữ từ lúc mở trang.
- Sau khi lưu thành công, trang hiện tại đọc và render lại phần bị ảnh hưởng.
- `store.js` cung cấp một cách đăng ký thay đổi chung, ví dụ `subscribe(collection, callback)`. Sau khi ghi, gọi listener của trang hiện tại; với tab khác, xử lý sự kiện `storage` rồi đọc lại dữ liệu.
- `storage` không tự phát ở tab vừa ghi. Sự kiện này cũng không khóa dữ liệu hoặc ngăn hai tab ghi đè đồng thời.
- Phạm vi demo: một tab thực hiện thao tác ghi tại một thời điểm; các tab khác có thể theo dõi. Không cam kết đồng bộ ghi đồng thời như cơ sở dữ liệu.
- Vì dùng `onboardai_currentUser` trong LocalStorage, đổi tài khoản ở một tab sẽ ảnh hưởng các tab cùng origin. Các tab phải kiểm tra lại quyền và điều hướng lại khi khóa này thay đổi. Demo nhiều role nên đăng xuất/đăng nhập lần lượt.
- Dashboard tính từ dữ liệu gốc hiện tại, không lưu bản sao như `mentorTasks`, `hrProgress` hoặc phần trăm tiến độ cố định.
- Tiến độ chung: số task `completed` chia tổng task không `archived`. Không có task thì trả 0% và hiển thị “Chưa có nhiệm vụ”. Dùng một hàm chung do SV2 viết.
- Không dùng `localStorage.clear()`. Đăng xuất chỉ xóa `onboardai_currentUser`, giữ dữ liệu nghiệp vụ.

### 2.8. AI dùng chung dữ liệu, tách kết quả người dùng

`aiMockData` là dữ liệu mẫu để tra cứu, không phải lịch sử hội thoại. Cả nhóm đọc theo `featureType`: `policyQA`, `checklistPersonalizer`, `progressRisk`; `fallback` dùng khi chưa tìm được kết quả phù hợp.

`aiHistory` là collection mới do SV1 định nghĩa và cả nhóm sử dụng:

| Trường | Quy ước |
|---|---|
| `id` | ID duy nhất với prefix `ai-history` |
| `featureType` | Một trong ba tính năng chính |
| `userId` | Người yêu cầu và sở hữu kết quả |
| `newHireId` | Nhân sự liên quan hoặc `null` |
| `input` | Chuỗi đầu vào; không chứa mật khẩu |
| `result` | Object chứa kết quả theo featureType |
| `reason` | Chuỗi giải thích |
| `decision` | `pending`, `accepted`, `rejected` |
| `appliedTaskIds` | Mảng ID task đã tạo; mặc định `[]` |
| `createdAt`, `updatedAt` | Dấu thời gian ISO |

Hợp đồng `result`: Policy Q&A dùng `{ answer, sourceDocumentId }`; Checklist Personalizer dùng `{ items: [{ title, description, category, priority, dueDate }] }`; Progress Risk dùng `{ level, summary, recommendations }`, với level là `low`, `medium`, `high` hoặc `unknown`.

Cho sửa kết quả khi còn `pending`; sau khi đã áp dụng, thao tác sửa task đi qua dịch vụ tasks. “Tạo lại” tạo một kết quả pending mới. Người dùng có thể lưu kết quả để xem lại, từ chối, hoặc chấp nhận. Kết quả AI không được tự ghi thay đổi nghiệp vụ khi mới hiển thị.

Checklist chỉ tạo task khi người dùng chấp nhận. SV2 thiết kế `applyChecklist(historyId)` có khả năng gọi lại an toàn: mỗi item gắn một ID task ổn định theo historyId và thứ tự item; lần gọi lại bỏ qua các ID đã tồn tại, không nhân đôi task. Khóa nút khi đang xử lý và chỉ báo hoàn tất sau khi cả tasks và trạng thái aiHistory đã được lưu. LocalStorage không có giao dịch nhiều khóa; khi lỗi phải báo rõ và cho thử lại theo cùng historyId.

Policy Q&A lưu câu trả lời và nguồn để nhân sự xem lại. Progress Risk lưu kết quả đánh giá để HR theo dõi và quyết định can thiệp; không tự sửa tiến độ task.

## 3. Quy tắc riêng cho SV1

**Phụ trách:** bộ lưu trữ chung, `auth.js`, `people.js`, `ai-history.js`, luồng nhân sự mới và Policy Q&A.

1. Làm `store.js` trước để SV2/SV3 có API dùng chung. Tạo danh sách khóa, init, đọc/ghi, lỗi lưu trữ, đăng ký thay đổi và reset demo theo mục 2.
2. `auth.js` cung cấp `login(userIdOrEmail, password)`, `logout()`, `getCurrentUser()`, `requireRoles(roles)`. Đăng nhập mô phỏng đối chiếu password đã có trong JSON và chỉ nhận tài khoản active. Không dùng mật khẩu thật trong bộ dữ liệu học tập.
3. `people.js` quản lý users/newHires; cung cấp `getMyHire()`, `updateMyProfile(patch)` và các hàm quản trị tài khoản/hồ sơ cho SV3 gọi. Hồ sơ tự sửa chỉ cho phép trường đã thống nhất, mặc định `fullName`, `email`; email phải duy nhất. Role, departmentId, mentorId, journeyId do nghiệp vụ quản trị xử lý.
4. Khi tạo tài khoản newHire kèm hồ sơ, kiểm tra liên kết và có cách hoàn tất lại nếu một bước lưu lỗi. Không để nút “Tạo lại” sinh nhiều tài khoản cùng email.
5. Dashboard/checklist xác định hire qua `newHires.userId === currentUser.id`; không hardcode `hire-001` hoặc lấy bản ghi đầu tiên.
6. Khi đổi tiến độ, gọi `tasks.updateTaskStatus(taskId, status)` do SV2 viết. Không viết một hàm lưu task thứ hai trong JS của SV1.
7. Policy Q&A đọc mock + documents, hiển thị nguồn và trạng thái không tìm thấy/không chắc chắn. Lưu lịch sử vào aiHistory; chỉ cho người dùng xem/sửa/xóa lịch sử của mình.
8. Trang tin tức gọi hàm đọc tin đã xuất bản của SV3; sứ mệnh lấy từ bản ghi `company-001`, báo thiếu cấu hình nếu không có. Không tự chọn một công ty khác trong 104 bản ghi.
9. Bàn giao luồng: đăng nhập nhân sự → xem đúng checklist → cập nhật task → F5 vẫn giữ → đăng xuất không mất dữ liệu.

## 4. Quy tắc riêng cho SV2

**Phụ trách:** `tasks.js`, `resources.js`, màn hình mentor và Checklist Personalizer.

1. `tasks.js` là nơi duy nhất định nghĩa thao tác tạo/sửa/lưu trữ task và tính tiến độ; xuất `getTasksForHire(hireId)`, `createTask(input)`, `updateTask(taskId, patch)`, `updateTaskStatus(taskId, status)`, `archiveTask(taskId)`, `getProgress(hireId)`.
2. Mỗi hàm tự kiểm tra tài khoản hiện tại. NewHire chỉ đổi trạng thái task của mình; mentor chỉ giao/sửa việc cho mentee của mình; HR/Admin thao tác theo quyền quản trị.
3. Nhân sự mới được chuyển task giữa `todo`, `inProgress`, `blocked`, `completed`; không tự `archived`. `completedAt` được xử lý trong cùng hàm thay đổi trạng thái.
4. Khi tạo task, chọn một hire hợp lệ, lấy assignedTo từ hồ sơ, dùng journeyId đã gán; nếu chưa gán journey thì yêu cầu hoàn thiện hồ sơ trước. Không tự sửa hành trình của nhân sự.
5. `resources.js` quản lý checkins, documents, departments. Giới hạn người được ghi theo vai trò, không theo người viết file. Xuất hàm cho màn hình Admin/HR của SV3 gọi.
6. Khi tạo check-in, chặn trùng bộ `newHireId + mentorId + scheduledAt` với lịch chưa cancelled. Hiển thị lịch cũ thay vì tự gộp hai ghi chú. Khi cập nhật, loại chính ID đang sửa khỏi phép kiểm tra trùng.
7. Thư viện tài liệu đọc theo trạng thái và đối tượng được xem; newHire chỉ thấy tài liệu active phù hợp. Sửa metadata tài liệu do HR/Admin; quyền mentor bổ sung chỉ khi nhóm thống nhất.
8. Phòng ban chỉ Admin được tạo/sửa/vô hiệu hóa. Không xóa phòng ban đang được users/newHires/journeys/documents tham chiếu; giữ liên kết và hiển thị nhãn ngừng hoạt động khi cần.
9. Checklist Personalizer: đọc mock → tạo đề xuất → cho sửa → chấp nhận → gọi applyChecklist để tạo task. Không chỉ lưu danh sách đề xuất rồi báo đã giao việc.
10. Bàn giao luồng: mentor chọn mentee → giao task/check-in → nhân sự thấy task → nhân sự hoàn thành → mentor thấy tiến độ cập nhật.

## 5. Quy tắc riêng cho SV3

**Phụ trách:** `organization.js`, HR/Admin, Progress Risk và kiểm thử tích hợp.

1. `organization.js` quản lý journeys, companyInfo, news; xuất các hàm đọc/ghi dùng chung. Chỉ HR/Admin được sửa nội dung công ty, tin và hành trình.
2. Xuất `getCompanyInfo()` để lấy `company-001` và `getPublishedNews()` để lọc published, sắp xếp ngày đã chuẩn hóa. SV1 dùng lại các hàm này trên trang công khai.
3. Tin nháp không hiện ở trang nhân viên. Khi xuất bản đặt publishedAt; khi lưu trữ đặt archivedAt; khi khôi phục về draft thì xóa archivedAt. Chỉ công khai sau thao tác publish rõ ràng.
4. Tạo/sửa journey kiểm tra durationDays là số nguyên dương. Hành trình đang có nhân sự/task tham chiếu thì vô hiệu hóa, không xóa làm mất liên kết. Không gán mới vào journey inactive.
5. Trang quản lý tài khoản/hồ sơ gọi people của SV1; trang phòng ban/tài liệu gọi resources của SV2. Không tự sao chép hàm CRUD vào mã Admin.
6. HR dashboard và Progress Risk dùng newHires, tasks, checkins hiện tại. Dùng getProgress của SV2; không tạo công thức phần trăm khác.
7. Progress Risk có giải thích và trạng thái thiếu dữ liệu. Lưu kết quả/đề xuất vào aiHistory qua module của SV1. Không tự coi thiếu dữ liệu là rủi ro thấp.
8. Kiểm thử ảnh hưởng chéo: đổi role/vô hiệu hóa tài khoản phải tác động đến lần kiểm tra quyền tiếp theo; thay mentor phải đổi danh sách mentee; lưu trữ task phải đổi mẫu số tiến độ.
9. Quản lý việc tích hợp dev, đối chiếu tên import, khóa, schemaVersion và trạng thái. Không thêm store riêng để giải quyết nhanh lỗi ghép.
10. Bàn giao luồng: HR/Admin tạo hoặc gán hồ sơ → mentor giao việc → nhân sự cập nhật → HR xem tiến độ và lưu đánh giá AI.

## 6. Trình tự triển khai và nghiệm thu

1. Cả nhóm chốt bảng khóa, trạng thái, quyền, chữ ký hàm và thư mục module trong một PR quy tắc.
2. SV1 đưa store/auth và hợp đồng people/aiHistory lên dev sớm. SV2 đưa hợp đồng tasks/resources; SV3 đưa organization. Nếu chưa xong, bàn giao hàm khung có chữ ký và lỗi rõ ràng, không dữ liệu giả mạo thành công.
3. Mỗi người triển khai màn hình của mình gọi API đã chốt. Sửa hợp đồng dùng chung phải thông báo người đang gọi hàm và sửa các nơi gọi trong cùng PR.
4. Người quản lý module xử lý thay đổi của module đó; thành viên khác đề xuất qua PR và review. Mỗi PR nghiệp vụ phải có người khác kiểm tra.
5. Kiểm tra luồng tích hợp trên cùng origin và một bộ seed. Không giải quyết lỗi bằng cách đổi key riêng cho từng trang.

| Tình huống kiểm tra | Kết quả phải đạt | Người xác nhận |
|---|---|---|
| Lần mở đầu, sau đó F5 | Khởi tạo đúng; F5 giữ thay đổi | SV1 + SV3 |
| Collection đã lưu là `[]` | Không tự nạp lại seed | SV1 |
| Fetch/JSON/ghi storage lỗi | Hiện lỗi, không báo lưu thành công hoặc xóa dữ liệu cũ | SV1 |
| Mentor giao việc, nhân sự mở checklist | Đúng task, đúng người và hành trình | SV1 + SV2 |
| Nhân sự cập nhật task | Mentor và HR tính lại cùng tiến độ | Cả nhóm |
| Nhân sự sửa task người khác | Hàm nghiệp vụ từ chối | SV1 + SV2 |
| Chấp nhận lại cùng checklist AI | Không tạo thêm task trùng | SV2 |
| Tin draft/published/archived | Chỉ published xuất hiện công khai | SV1 + SV3 |
| Đăng xuất rồi đăng nhập role khác | Giữ dữ liệu; kiểm tra lại quyền | Cả nhóm |
| Tab khác nhận thay đổi | Đọc lại dữ liệu; đổi tài khoản thì kiểm tra lại quyền | SV1 + SV3 |
| Reset demo | Chỉ xóa đúng khóa OnboardAI sau xác nhận | SV1 + SV3 |

## 7. Điểm còn tồn tại trong bộ dữ liệu hiện tại

Bản JSON đã kiểm tra trước đó vẫn giữ các trường hợp cần nhóm quyết định: 42 cặp check-in cùng nhân sự/mentor/giờ nhưng khác nội dung; 5 check-in có updatedAt trước createdAt; 23 task có completedAt sau updatedAt và 2 task có completedAt trước createdAt. Một số task/journey cùng tên nhưng khác thông tin.

SV2 rà soát và thống nhất dữ liệu check-in/task với nhóm trước khi demo. Không để initStore tự gộp, xóa hoặc đoán ngày cho những bản ghi này. Quy tắc chặn trùng chỉ áp dụng cho lần tạo/cập nhật mới; dữ liệu cũ cần xử lý có chủ đích. Khi seed đã sửa, reset demo có xác nhận để nạp bản mới.

## Tài liệu đối chiếu

- Đề bài `BTL-20_onboardai-hanh-trinh-hoi-nhap-nhan-su-moi.md`: mục 6, 9–14, 19 và 21; phân vai, CRUD, AI, dữ liệu giả lập và trách nhiệm chéo.
- Bộ `data-json.zip` đã đối chiếu trong cuộc trao đổi: 10 collection và tên trường thực tế.
- MDN, Using the Web Storage API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
- MDN, Window: storage event: https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event

Phần SV1 và các phụ thuộc đọc/cập nhật trạng thái tối thiểu đã triển khai theo bổ sung ngày 18/10/2026. Các phần SV2/SV3 chưa nối được phân biệt rõ trong README và bảng màn hình; không coi kiểm tra SV1 là nghiệm thu toàn bộ dự án.
