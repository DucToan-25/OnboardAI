import { createAvatar, createStatusBadge } from '../common/renderers.js';
import { formatDate } from '../common/format.js';
import { calculateProgress } from '../data/selectors.js';
import { openModal } from '../common/ui.js';

export async function initPage({ currentUser, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const filters = region('mentee-filters');
  let mentees = [];

  function buildStats(items) {
    const active = items.filter((m) => m.status === 'active').length;
    const completed = items.filter((m) => m.status === 'completed').length;
    const atRisk = items.filter((m) => m.progress.percent < 40 && m.status === 'active').length;
    const cards = [
      { label: 'Tổng mentee', value: items.length },
      { label: 'Đang hội nhập', value: active },
      { label: 'Cần hỗ trợ', value: atRisk },
    ];
    region('mentee-stats').replaceChildren(...cards.map((card) => {
      const el = document.createElement('article');
      el.className = 'stat-card';
      el.innerHTML = '';
      const label = document.createElement('p'); label.className = 'stat-card__label'; label.textContent = card.label;
      const value = document.createElement('p'); value.className = 'stat-card__value'; value.textContent = String(card.value);
      el.append(label, value);
      return el;
    }));
  }

  function openDetail(mentee) {
    const content = document.createElement('div');
    content.className = 'mentor-mentees__detail';
    const header = document.createElement('div');
    header.className = 'mentor-mentees__detail-header';
    header.append(createAvatar(mentee.user, { size: 'lg' }));
    const info = document.createElement('div');
    const name = document.createElement('h3'); name.textContent = mentee.user.fullName;
    const meta = document.createElement('p'); meta.className = 'form-field__hint';
    meta.textContent = `${mentee.user.email} · ${mentee.department?.name || '—'}`;
    info.append(name, meta); header.append(info);

    const progress = document.createElement('div');
    progress.className = 'progress';
    const plabel = document.createElement('div'); plabel.className = 'progress__label';
    const ptext = document.createElement('span'); ptext.textContent = 'Tiến độ nhiệm vụ';
    const pval = document.createElement('span'); pval.className = 'progress__value'; pval.textContent = `${mentee.progress.percent}%`;
    plabel.append(ptext, pval);
    const bar = document.createElement('progress'); bar.className = 'progress__bar'; bar.max = 100; bar.value = mentee.progress.percent;
    progress.append(plabel, bar);

    const actions = document.createElement('div');
    actions.className = 'modal__footer';
    const assign = document.createElement('a');
    assign.className = 'btn btn--primary';
    assign.href = `mentor-task-assignment.html?${new URLSearchParams({ newHireId: mentee.id })}`;
    assign.textContent = 'Giao nhiệm vụ';
    const checkin = document.createElement('a');
    checkin.className = 'btn btn--secondary';
    checkin.href = `mentor-checkin-note.html?${new URLSearchParams({ newHireId: mentee.id })}`;
    checkin.textContent = 'Ghi chú check-in';
    actions.append(assign, checkin);

    content.append(header, progress, actions);
    openModal({ title: 'Chi tiết mentee', content });
  }

  function render() {
    const search = filters.elements.search.value.trim().toLocaleLowerCase('vi');
    const status = filters.elements.status.value;
    const matches = mentees.filter((m) => {
      if (status && m.status !== status) return false;
      if (!search) return true;
      const hay = `${m.user.fullName} ${m.user.email}`.toLocaleLowerCase('vi');
      return hay.includes(search);
    });
    const tbody = region('mentee-rows');
    tbody.replaceChildren();
    for (const mentee of matches) {
      const tr = document.createElement('tr');
      tr.dataset.id = mentee.id;
      const nameTd = document.createElement('td');
      const nameWrap = document.createElement('div');
      nameWrap.className = 'mentor-mentees__name';
      nameWrap.append(createAvatar(mentee.user, { size: 'sm' }));
      const nameText = document.createElement('div');
      const strong = document.createElement('strong'); strong.textContent = mentee.user.fullName;
      const email = document.createElement('p'); email.className = 'form-field__hint'; email.textContent = mentee.user.email;
      nameText.append(strong, email); nameWrap.append(nameText); nameTd.append(nameWrap);

      const dept = document.createElement('td'); dept.textContent = mentee.department?.name || '—';
      const start = document.createElement('td'); start.className = 'table__cell--nowrap'; start.textContent = formatDate(mentee.startDate);
      const prog = document.createElement('td');
      const progress = document.createElement('div'); progress.className = 'progress';
      const bar = document.createElement('progress'); bar.className = 'progress__bar'; bar.max = 100; bar.value = mentee.progress.percent;
      const pct = document.createElement('span'); pct.className = 'progress__value'; pct.textContent = `${mentee.progress.percent}%`;
      progress.append(bar, pct); prog.append(progress);
      const st = document.createElement('td'); st.append(createStatusBadge('newHires', mentee.status));
      const acts = document.createElement('td'); acts.className = 'table__actions';
      const detailBtn = document.createElement('button');
      detailBtn.type = 'button'; detailBtn.className = 'btn btn--ghost btn--sm';
      detailBtn.dataset.action = 'open-mentee'; detailBtn.dataset.id = mentee.id;
      detailBtn.textContent = 'Chi tiết';
      detailBtn.addEventListener('click', () => openDetail(mentee));
      const taskLink = document.createElement('a');
      taskLink.className = 'btn btn--secondary btn--sm';
      taskLink.href = `mentor-task-assignment.html?${new URLSearchParams({ newHireId: mentee.id })}`;
      taskLink.textContent = 'Giao việc';
      acts.append(detailBtn, taskLink);
      tr.append(nameTd, dept, start, prog, st, acts);
      tbody.append(tr);
    }
    region('mentee-table-wrap').hidden = matches.length === 0;
    ui.setViewState(region('list-state'), {
      status: matches.length ? 'ready' : 'empty',
      message: mentees.length
        ? 'Không có mentee phù hợp bộ lọc.'
        : 'Bạn chưa được gán mentee nào.',
    });
  }

  async function loadData() {
    ui.setViewState(region('list-state'), { status: 'loading', message: 'Đang tải danh sách mentee…' });
    try {
      const [{ items: newHires }, { items: users }, { items: departments }, { items: tasks }] = await Promise.all([
        repository.list('newHires'),
        repository.list('users'),
        repository.list('departments'),
        repository.list('tasks'),
      ]);
      const mine = newHires.filter((nh) => nh.mentorId === currentUser.id);
      mentees = mine.map((nh) => {
        const user = users.find((u) => u.id === nh.userId) || { fullName: '—', email: '', avatarUrl: '' };
        const department = departments.find((d) => d.id === user.departmentId) || null;
        const related = tasks.filter((t) => t.newHireId === nh.id);
        return { ...nh, user, department, progress: calculateProgress(related), tasks: related };
      });
      buildStats(mentees);
      render();
    } catch (error) {
      ui.setViewState(region('list-state'), { status: 'error', message: error.message || 'Không tải được danh sách.' });
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadData, { once: true });
      region('list-state').append(retry);
    }
  }

  filters.addEventListener('submit', (e) => { e.preventDefault(); render(); });
  filters.elements.search.addEventListener('input', render);
  filters.elements.status.addEventListener('change', render);
  await loadData();
}
