/**
 * OnboardAI - Danh sách mentee
 * Dữ liệu từ data/mentees.json (xuất từ Excel OnboardAI - newHires + users + departments + tasks)
 * Mentor: user-003 (Lê Thu Hà)
 */

let mentees = [];

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const menteeTableBody = document.getElementById("menteeTableBody");
const menteeCards = document.getElementById("menteeCards");
const statsGrid = document.getElementById("statsGrid");
const tableFooter = document.getElementById("tableFooter");
const cardsFooter = document.getElementById("cardsFooter");
const cardsCount = document.getElementById("cardsCount");
const modalOverlay = document.getElementById("modalOverlay");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const currentDateEl = document.getElementById("currentDate");

function getProgressColor(status) {
  if (status === "on-track") return "green";
  if (status === "need-support") return "orange";
  return "blue";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizeText(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFC")
    .trim();
}

function renderStats(list) {
  const total = list.length;
  const onTrack = list.filter(function (m) { return m.status === "on-track"; }).length;
  const needSupport = list.filter(function (m) { return m.status === "need-support"; }).length;

  statsGrid.innerHTML =
    '<article class="stat-card">' +
      '<div class="stat-icon blue">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
          '<circle cx="9" cy="7" r="4"/>' +
          '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
          '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
        '</svg>' +
      '</div>' +
      '<div><p class="stat-label">Đang hướng dẫn</p><p class="stat-value">' + total + '</p></div>' +
    '</article>' +
    '<article class="stat-card on-track">' +
      '<div class="stat-icon green">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>' +
          '<polyline points="22 4 12 14.01 9 11.01"/>' +
        '</svg>' +
      '</div>' +
      '<div><p class="stat-label">Đúng tiến độ</p><p class="stat-value">' + onTrack + '</p></div>' +
    '</article>' +
    '<article class="stat-card need-support">' +
      '<div class="stat-icon orange">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<circle cx="12" cy="12" r="10"/>' +
          '<line x1="12" y1="8" x2="12" y2="12"/>' +
          '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
        '</svg>' +
      '</div>' +
      '<div><p class="stat-label">Cần hỗ trợ</p><p class="stat-value">' + needSupport + '</p></div>' +
    '</article>';
}

function renderTable(list) {
  if (list.length === 0) {
    menteeTableBody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;padding:32px;color:#64748b;">Không tìm thấy nhân sự nào phù hợp.</td></tr>';
  } else {
    menteeTableBody.innerHTML = list.map(function (m) {
      return (
        '<tr data-id="' + m.id + '">' +
          '<td><span class="mentee-name">' + m.name + '</span></td>' +
          '<td>' + m.department + '</td>' +
          '<td><div class="progress-cell">' +
            '<div class="progress-bar"><div class="progress-fill ' + getProgressColor(m.status) + '" style="width:' + m.progress + '%"></div></div>' +
            '<span class="progress-text">' + m.progress + '%</span>' +
          '</div></td>' +
          '<td><span class="badge ' + m.status + '">' + m.statusLabel + '</span></td>' +
          '<td><a href="#" class="action-link" data-action="detail" data-id="' + m.id + '">Xem chi tiết</a></td>' +
        '</tr>'
      );
    }).join("");
  }
  tableFooter.textContent = "Hiển thị " + list.length + " nhân sự đang được hướng dẫn";
}

function renderCards(list) {
  if (list.length === 0) {
    menteeCards.innerHTML = '<p style="text-align:center;padding:32px;color:#64748b;">Không tìm thấy nhân sự nào phù hợp.</p>';
  } else {
    menteeCards.innerHTML = list.map(function (m) {
      return (
        '<article class="mentee-card" data-id="' + m.id + '">' +
          '<div class="card-top">' +
            '<div class="card-avatar ' + m.avatarColor + '">' + m.initials + '</div>' +
            '<div class="card-info"><h3>' + m.name + '</h3><p class="card-email">' + m.email + '</p></div>' +
          '</div>' +
          '<div class="card-dept">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
              '<polyline points="9 22 9 12 15 12 15 22"/>' +
            '</svg> ' + m.department +
          '</div>' +
          '<div class="card-progress">' +
            '<div class="card-progress-label"><span>Tiến độ onboarding</span><span>' + m.progress + '%</span></div>' +
            '<div class="progress-bar"><div class="progress-fill ' + getProgressColor(m.status) + '" style="width:' + m.progress + '%"></div></div>' +
          '</div>' +
          '<div class="card-status"><span class="dot ' + m.status + '"></span><span>' + m.statusLabel + '</span></div>' +
          '<div class="card-actions">' +
            '<button class="btn btn-primary" data-action="detail" data-id="' + m.id + '">Chi tiết</button>' +
            '<button class="btn btn-outline" data-action="task" data-id="' + m.id + '">Giao việc</button>' +
            '<button class="btn btn-outline" data-action="checkin" data-id="' + m.id + '">Check-in</button>' +
          '</div>' +
        '</article>'
      );
    }).join("");
  }
  cardsCount.textContent = list.length + " nhân sự";
  cardsFooter.textContent = "Hiển thị " + list.length + " nhân sự đang được hướng dẫn";
}

function getFilteredList() {
  const keyword = normalizeText(searchInput.value);
  const status = statusFilter.value;

  return mentees.filter(function (m) {
    const name = normalizeText(m.name);
    const email = normalizeText(m.email);
    const dept = normalizeText(m.department);
    const job = normalizeText(m.jobTitle);
    const matchKeyword =
      !keyword ||
      name.indexOf(keyword) !== -1 ||
      email.indexOf(keyword) !== -1 ||
      dept.indexOf(keyword) !== -1 ||
      job.indexOf(keyword) !== -1;
    const matchStatus = status === "all" || m.status === status;
    return matchKeyword && matchStatus;
  });
}

function updateUI() {
  const filtered = getFilteredList();
  renderStats(filtered);
  renderTable(filtered);
  renderCards(filtered);
}

function openModal(menteeId) {
  const m = mentees.find(function (item) { return item.id === menteeId; });
  if (!m) return;

  modalBody.innerHTML =
    '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">' +
      '<div class="card-avatar ' + m.avatarColor + '" style="width:56px;height:56px;font-size:1.1rem;">' + m.initials + '</div>' +
      '<div>' +
        '<h3 style="font-size:1.15rem;font-weight:600;">' + m.name + '</h3>' +
        '<p style="font-size:0.85rem;color:#64748b;">' + m.email + '</p>' +
      '</div>' +
    '</div>' +
    '<div class="modal-row"><span class="label">Phòng ban</span><span class="value">' + m.department + '</span></div>' +
    '<div class="modal-row"><span class="label">Vị trí</span><span class="value">' + (m.jobTitle || "—") + '</span></div>' +
    '<div class="modal-row"><span class="label">Trạng thái</span><span class="value"><span class="badge ' + m.status + '">' + m.statusLabel + '</span></span></div>' +
    '<div class="modal-row"><span class="label">Ngày bắt đầu</span><span class="value">' + formatDate(m.startDate) + '</span></div>' +
    '<div class="modal-row"><span class="label">Nhiệm vụ</span><span class="value">' + (m.taskDone || 0) + '/' + (m.taskCount || 0) + ' hoàn thành</span></div>' +
    (m.notes ? '<div class="modal-row"><span class="label">Ghi chú</span><span class="value">' + m.notes + '</span></div>' : '') +
    '<div class="modal-progress">' +
      '<div style="display:flex;justify-content:space-between;font-size:0.9rem;">' +
        '<span style="color:#64748b;">Tiến độ onboarding</span><strong>' + m.progress + '%</strong>' +
      '</div>' +
      '<div class="progress-bar"><div class="progress-fill ' + getProgressColor(m.status) + '" style="width:' + m.progress + '%"></div></div>' +
    '</div>';

  modalOverlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = "";
}

searchInput.addEventListener("input", updateUI);
statusFilter.addEventListener("change", updateUI);

document.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  e.preventDefault();
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action === "detail") openModal(id);
  else if (action === "task") alert("Chức năng Giao việc sẽ mở trang Giao nhiệm vụ.\nMentee: " + id);
  else if (action === "checkin") alert("Chức năng Check-in sẽ mở lịch check-in.\nMentee: " + id);
});

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", function (e) {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
});
menuToggle.addEventListener("click", function () {
  sidebar.classList.toggle("open");
  sidebarOverlay.classList.toggle("open");
});
sidebarOverlay.addEventListener("click", function () {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("open");
});

function setCurrentDate() {
  currentDateEl.textContent = "Hôm nay, 06/10/2026";
}

async function loadMentees() {
  try {
    const res = await fetch("data/mentees.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("JSON rỗng");
    mentees = data;
    updateUI();
  } catch (err) {
    console.error("Không load được mentees.json:", err);
    mentees = [];
    updateUI();
    if (statsGrid) {
      statsGrid.insertAdjacentHTML(
        "beforebegin",
        '<p style="color:#dc2626;margin-bottom:12px;font-size:0.9rem;">Không tải được dữ liệu. Hãy chạy qua Live Server (không mở file://).</p>'
      );
    }
  }
}

setCurrentDate();
loadMentees();
