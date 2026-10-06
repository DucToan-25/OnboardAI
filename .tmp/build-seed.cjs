const fs = require('node:fs');
const stamp = '2026-09-28T08:00:00Z';
const users = [
  ['usr-newhire-001', 'Nguyễn Minh Anh', 'minhanh@example.com', '0901234567', 'newhire', 'dep-dev', 'Nhân viên phát triển web'],
  ['usr-newhire-002', 'Trần Thu Lan', 'thulan@example.com', '0902345678', 'newhire', 'dep-sales', 'Nhân viên kinh doanh'],
  ['usr-mentor-001', 'Trần Quang Huy', 'mentor@example.com', '0903456789', 'mentor', 'dep-dev', 'Trưởng nhóm phát triển sản phẩm'],
  ['usr-hr-001', 'Nguyễn Thu Hà', 'hr@example.com', '0904567890', 'hr', 'dep-hr', 'Chuyên viên nhân sự'],
  ['usr-admin-001', 'Quản trị viên', 'admin@example.com', '', 'admin', null, 'Quản trị hệ thống'],
].map(([id, fullName, email, phone, role, departmentId, jobTitle]) => ({id, fullName, email, phone, avatarUrl: '', role, departmentId, jobTitle, status: 'active'}));
const departments = [
  ['dep-dev', 'Phát triển sản phẩm', 'Phát triển sản phẩm và ứng dụng web.'],
  ['dep-sales', 'Kinh doanh', 'Kết nối và chăm sóc khách hàng.'],
  ['dep-hr', 'Nhân sự', 'Đồng hành cùng nhân viên.'],
].map(([id, name, description]) => ({id, name, description, status:'active'}));
const newHires = [
  {id:'nh-001', userId:'usr-newhire-001', mentorId:'usr-mentor-001', startDate:'2026-09-28', status:'active'},
  {id:'nh-002', userId:'usr-newhire-002', mentorId:'usr-mentor-001', startDate:'2026-10-01', status:'active'},
];
const journeys = [
  {id:'journey-001',name:'Hội nhập phát triển web',departmentId:'dep-dev',status:'active',steps:['Làm quen','Học quy trình','Thực hành']},
  {id:'journey-002',name:'Hội nhập kinh doanh',departmentId:'dep-sales',status:'active',steps:['Làm quen','Tìm hiểu sản phẩm']},
];
const journeyAssignments = newHires.map((hire,index) => ({id:`assignment-00${index+1}`,journeyId:journeys[index].id,newHireId:hire.id,startDate:hire.startDate,status:'active'}));
const tasks = [
  ['task-001','Hoàn thiện hồ sơ','Kiểm tra thông tin cá nhân và cập nhật số điện thoại liên hệ.','2026-09-28','completed',[]],
  ['task-002','Đọc sổ tay nhân viên','Tìm hiểu giờ làm việc, quy trình nghỉ phép và các đầu mối hỗ trợ.','2026-09-30','completed',['doc-001']],
  ['task-003','Đọc quy định bảo mật','Tìm hiểu cách bảo vệ tài khoản, sử dụng thiết bị và chia sẻ tài liệu. Gửi ghi chú những điểm bạn đã nắm được cho mentor.','2026-10-05','in_progress',['doc-002']],
  ['task-004','Gửi mục tiêu tuần đầu','Nêu mục tiêu trong 7 ngày đầu và những hỗ trợ bạn cần từ mentor.','2026-10-05','submitted',['doc-005']],
  ['task-005','Check-in với mentor','Chuẩn bị câu hỏi và trao đổi những khó khăn trong tuần đầu.','2026-10-06','pending',['doc-006']],
  ['task-006','Hoàn thành khóa học nội bộ','Tìm hiểu các bước làm việc và ghi chú nội dung cần trao đổi với mentor.','2026-10-07','changes_requested',['doc-004']],
  ['task-007','Kích hoạt tài khoản công ty','Kiểm tra tài khoản và bật xác thực hai bước theo hướng dẫn.','2026-10-01','completed',['doc-002']],
  ['task-008','Xác nhận bàn giao thiết bị','Kiểm tra thiết bị được cấp và gửi ghi chú nếu cần hỗ trợ.','2026-10-08','pending',[]],
].map(([id,title,description,dueDate,status,relatedDocumentIds]) => ({id,newHireId:'nh-001',journeyAssignmentId:'assignment-001',assignedById:'usr-mentor-001',title,description,dueDate,status,updatedAt:stamp,relatedDocumentIds,result:null}));
tasks[3].result = {url:'',fileName:'muc-tieu-tuan-dau.pdf',note:'Em đã ghi mục tiêu học quy trình và làm quen dự án.'};
tasks[5].result = {url:'',fileName:'',note:'Cần bổ sung phần quy trình review.'};
tasks.push({id:'task-009',newHireId:'nh-002',journeyAssignmentId:'assignment-002',assignedById:'usr-mentor-001',title:'Tìm hiểu sản phẩm',description:'Đọc tài liệu giới thiệu công ty và ghi lại câu hỏi của bạn.',dueDate:'2026-10-08',status:'pending',updatedAt:stamp,relatedDocumentIds:['doc-003'],result:null});
const checkins = [
  {id:'checkin-001',newHireId:'nh-001',mentorId:'usr-mentor-001',scheduledAt:'2026-10-06T03:00:00Z',note:'Ghi chú riêng của mentor, không cung cấp cho nhân sự mới.',status:'scheduled',sharedWithNewHire:true},
  {id:'checkin-002',newHireId:'nh-002',mentorId:'usr-mentor-001',scheduledAt:'2026-10-08T03:00:00Z',note:'Trao đổi về mục tiêu kinh doanh.',status:'scheduled',sharedWithNewHire:false},
];
const documents = [
  ['doc-001','Sổ tay nhân viên','Chính sách','Tổng quan về văn hóa, quy định và quyền lợi dành cho nhân viên mới.\n\n1. Thời gian làm việc\nGiờ làm việc: 08:30–17:30, từ thứ Hai đến thứ Sáu. Nghỉ trưa 12:00–13:00.\n\n2. Quy trình nghỉ phép\nGửi đơn nghỉ phép trước ít nhất 3 ngày làm việc và trao đổi với quản lý trực tiếp để thống nhất kế hoạch.\n\n3. Đầu mối hỗ trợ\nLiên hệ HR khi cần hỗ trợ tài khoản và chính sách. Trao đổi với mentor về lộ trình hội nhập.'],
  ['doc-002','Quy định bảo mật','Chính sách','Các bước bảo vệ thông tin trong công ty.\n\n1. Tài khoản\nKhông chia sẻ mật khẩu và bật xác thực hai bước cho tài khoản công việc.\n\n2. Chia sẻ tài liệu\nChỉ chia sẻ tài liệu với người được cấp quyền. Kiểm tra phạm vi trước khi gửi.\n\n3. Hỗ trợ\nBáo ngay cho bộ phận phụ trách nếu phát hiện truy cập bất thường.'],
  ['doc-003','Hướng dẫn công cụ','Hướng dẫn','Hướng dẫn sử dụng các công cụ và kênh liên lạc nội bộ.\n\n1. Bắt đầu\nKiểm tra tài khoản công việc, cập nhật thông tin liên hệ và làm quen với kênh trao đổi của nhóm.\n\n2. Khi cần hỗ trợ\nMô tả vấn đề và gửi cho mentor để được hướng dẫn.'],
  ['doc-004','Quy trình làm việc','Quy trình','Các bước tiếp nhận và hoàn thành công việc.\n\n1. Tiếp nhận\nĐọc yêu cầu, thống nhất mục tiêu và hạn hoàn thành với mentor.\n\n2. Review\nGửi kết quả, tiếp nhận phản hồi và điều chỉnh trước khi hoàn thành.\n\n3. Làm việc từ xa\nBản chính sách minh họa cho phép tối đa 2 ngày mỗi tuần theo thỏa thuận với quản lý.'],
  ['doc-005','Mẫu mục tiêu tuần đầu','Biểu mẫu','Mẫu tham khảo để xác định mục tiêu hội nhập.\n\n1. Mục tiêu\nLiệt kê ba điều bạn muốn hiểu hoặc thực hiện được trong tuần đầu.\n\n2. Kế hoạch\nGhi hoạt động, thời gian dự kiến và hỗ trợ cần thiết cho từng mục tiêu.'],
  ['doc-006','Hướng dẫn check-in','Hướng dẫn','Những điểm cần chuẩn bị cho buổi trao đổi với mentor.\n\n1. Trước buổi trao đổi\nGhi lại việc đã làm, khó khăn và câu hỏi cần giải đáp.\n\n2. Sau buổi trao đổi\nThống nhất việc tiếp theo và thời gian check-in kế tiếp.'],
].map(([id,title,category,content]) => ({id,title,category,content,status:'published',audienceRoles:['newhire','mentor','hr','admin'],departmentIds:[],updatedById:'usr-hr-001',updatedAt:stamp}));
documents.push({...documents[0],id:'doc-dev-only',title:'Quy ước phát triển sản phẩm',category:'Quy trình',content:'Tài liệu trong phạm vi phòng Phát triển sản phẩm.\n\n1. Review mã nguồn\nTrao đổi với người hướng dẫn trước khi ghép thay đổi.',audienceRoles:['newhire','mentor'],departmentIds:['dep-dev']});
documents.push({...documents[0],id:'doc-draft',title:'Chính sách đang soạn',content:'Nội dung nháp chưa được phát hành.',status:'draft'});
const settings = [{id:'system',aiPreview:{
  question:'Giờ làm việc của công ty như thế nào?',
  answer:'Giờ làm việc: 08:30–17:30, từ thứ Hai đến thứ Sáu. Nghỉ trưa 12:00–13:00.',
  explanation:'Dựa trên mục Thời gian làm việc trong Sổ tay nhân viên.',documentIds:['doc-001'],
  notes:[
    {id:'preview-note-001',title:'Quy trình xin nghỉ phép',body:'Cần gửi đơn trước ít nhất 3 ngày làm việc và trao đổi với quản lý trực tiếp.',documentIds:['doc-001'],updatedAt:'2026-10-02T08:00:00Z'},
    {id:'preview-note-002',title:'Chính sách làm việc từ xa',body:'Được áp dụng tối đa 2 ngày/tuần theo thỏa thuận với quản lý.',documentIds:['doc-004'],updatedAt:'2026-10-01T08:00:00Z'},
  ],
}}];
fs.writeFileSync('assets/data/seed.json',JSON.stringify({schemaVersion:1,users,departments,newHires,journeys,journeyAssignments,tasks,checkins,documents,settings},null,2)+'\n');
