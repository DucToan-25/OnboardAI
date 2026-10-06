import { calculateProgress } from '../data/selectors.js';
import { createTaskItem, createDocumentCard, createAvatar, createIcon, createField } from '../common/renderers.js';
import { formatDateTime } from '../common/format.js';

export async function initPage({ repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  let profile;
  let nextCheckin;

  function openMentor() {
    if (!profile?.mentor) return;
    const mentor = profile.mentor;
    const content = document.createElement('div'); content.className = 'nh-dashboard__contact';
    const name = document.createElement('div'); name.className = 'nh-dashboard__mentor';
    const details = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = mentor.fullName;
    const job = document.createElement('p'); job.className = 'form-field__hint'; job.textContent = mentor.jobTitle;
    details.append(title, job); name.append(createAvatar(mentor), details);
    content.append(name,
      createField({ name: 'email', label: 'Email', value: mentor.email, readOnly: true }),
      createField({ name: 'phone', label: 'Điện thoại liên hệ', value: mentor.phone || 'Chưa cập nhật', readOnly: true }),
    );
    const schedule = document.createElement('p'); schedule.className = 'alert alert--info';
    schedule.textContent = nextCheckin ? `Lịch check-in tiếp theo: ${formatDateTime(nextCheckin.scheduledAt)}` : 'Chưa có lịch check-in được chia sẻ.';
    const actions = document.createElement('div'); actions.className = 'modal__footer';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn--secondary'; close.textContent = 'Đóng';
    const mail = document.createElement('a'); mail.className = 'btn btn--primary';
    mail.href = `mailto:${encodeURIComponent(mentor.email)}?${new URLSearchParams({ subject: `Trao đổi hội nhập – ${profile.fullName}` })}`;
    mail.textContent = 'Mở email liên hệ';
    actions.append(close, mail); content.append(schedule, actions);
    const modal = ui.openModal({ title: 'Liên hệ Mentor', content });
    close.addEventListener('click', () => modal.close());
  }

  async function loadData() {
    region('dashboard').hidden = true;
    ui.setViewState(region('dashboard-state'), { status: 'loading', message: 'Đang tải tổng quan hội nhập…' });
    try {
      profile = await repository.getMyProfile();
      const [taskResult, documents, checkins, assignments] = await Promise.all([
        repository.list('tasks', { newHireId: profile.newHireId }),
        repository.list('documents', { status: 'published' }),
        repository.list('checkins', { newHireId: profile.newHireId, status: 'scheduled' }),
        repository.list('journeyAssignments', { newHireId: profile.newHireId }),
      ]);
      const tasks = taskResult.items;
      const progress = calculateProgress(tasks);
      const stats = [
        ['Hoàn thành', `${progress.completed}/${progress.total}`, 'check'],
        ['Đang thực hiện', tasks.filter((task) => ['in_progress', 'changes_requested'].includes(task.status)).length, 'clock'],
        ['Chờ duyệt', tasks.filter((task) => task.status === 'submitted').length, 'file'],
      ];
      region('stats').replaceChildren();
      for (const [label, value, iconName] of stats) {
        const card = document.createElement('div'); card.className = 'card card--compact stat-card';
        const icon = document.createElement('span'); icon.className = 'stat-card__icon'; icon.append(createIcon(iconName));
        const caption = document.createElement('span'); caption.className = 'stat-card__label'; caption.textContent = label;
        const count = document.createElement('strong'); count.className = 'stat-card__value'; count.textContent = value;
        card.append(icon, caption, count); region('stats').append(card);
      }
      region('progress-value').textContent = `${progress.percent}%`;
      region('progress-bar').value = progress.percent;
      const assignment = assignments.items.find((item) => item.status === 'active');
      const journey = assignment ? await repository.get('journeys', assignment.journeyId) : null;
      region('journey-name').textContent = journey?.name || 'Chưa có hành trình được gán';
      const upcoming = tasks.filter((task) => !['completed', 'canceled', 'submitted'].includes(task.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
      const upcomingRoot = region('upcoming-tasks'); upcomingRoot.replaceChildren();
      if (upcoming.length) for (const task of upcoming) upcomingRoot.append(createTaskItem(task));
      else ui.setViewState(upcomingRoot, { status: 'empty', message: 'Không có nhiệm vụ cần thực hiện tiếp theo.' });
      nextCheckin = checkins.items.filter((item) => Date.parse(item.scheduledAt) >= Date.now()).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
      const mentorRoot = region('mentor'); mentorRoot.replaceChildren();
      if (profile.mentor) {
        const identity = document.createElement('div'); identity.className = 'nh-dashboard__mentor';
        const details = document.createElement('div'); details.className = 'nh-dashboard__mentor-details';
        const name = document.createElement('strong'); name.className = 'nh-dashboard__label'; name.textContent = profile.mentor.fullName;
        const job = document.createElement('span'); job.className = 'form-field__hint'; job.textContent = profile.mentor.jobTitle;
        details.append(name, job); identity.append(createAvatar(profile.mentor), details);
        const checkin = document.createElement('div'); checkin.className = 'alert alert--info';
        const checkinLabel = document.createElement('p'); checkinLabel.className = 'form-field__hint'; checkinLabel.textContent = 'Lịch check-in tiếp theo';
        const date = document.createElement('p'); date.className = 'nh-dashboard__label'; date.textContent = nextCheckin ? formatDateTime(nextCheckin.scheduledAt) : 'Chưa có lịch';
        checkin.append(checkinLabel, date);
        const contact = document.createElement('button'); contact.type = 'button'; contact.className = 'btn btn--primary';
        contact.dataset.action = 'contact-mentor'; contact.textContent = 'Thông tin liên hệ';
        mentorRoot.append(identity, checkin, contact);
      } else ui.setViewState(mentorRoot, { status: 'empty', message: 'Mentor chưa được phân công.' });
      const documentRoot = region('recommended-documents'); documentRoot.replaceChildren();
      const recommendedIds = new Set(upcoming.flatMap((task) => task.relatedDocumentIds || []));
      const recommended = [...documents.items].sort((a, b) => Number(recommendedIds.has(b.id)) - Number(recommendedIds.has(a.id))).slice(0, 2);
      if (recommended.length) for (const item of recommended) documentRoot.append(createDocumentCard(item, { compact: true }));
      else ui.setViewState(documentRoot, { status: 'empty', message: 'Chưa có tài liệu được phát hành cho bạn.' });
      region('dashboard').hidden = false;
      ui.setViewState(region('dashboard-state'), { status: 'ready' });
    } catch (error) {
      ui.setViewState(region('dashboard-state'), { status: 'error', message: error.message || 'Không tải được tổng quan.' });
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.dataset.action = 'retry-dashboard'; retry.textContent = 'Thử lại';
      region('dashboard-state').append(retry);
    }
  }
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'contact-mentor') openMentor();
    if (action === 'retry-dashboard') void loadData();
  });
  await loadData();
}
