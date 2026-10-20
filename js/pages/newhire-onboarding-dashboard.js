import { getMyProfile } from '../data/people.js';
import { getTasksForHire, getProgress } from '../data/tasks.js';
import { getReadableDocuments } from '../data/resources.js';
import { createTaskItem, createDocumentCard, createAvatar, element, actionButton } from '../common/renderers.js';
import { watchData, showError } from '../common/data-ui.js';
import { parseStoredDate } from '../common/format.js';

export async function initPage({ ui }) {
  const region = name => document.querySelector(`[data-region="${name}"]`);
  function render() {
    const { user, hire, mentor, journey } = getMyProfile();
    const tasks = hire ? getTasksForHire(hire.id).filter(item => item.status !== 'archived') : [];
    const progress = hire ? getProgress(hire.id) : { completed: 0, total: 0, percent: 0 };
    document.querySelector('.page-header__description').textContent = `Chào ${user.fullName}, đây là những việc cần theo dõi.`;
    ui.setViewState(region('dashboard-state'), { status: hire ? 'ready' : 'empty', message: 'Chưa có hồ sơ hội nhập. Vui lòng liên hệ HR.' });
    const values = region('stats').querySelectorAll('.stat-card__value');
    values[0].textContent = `${progress.completed}/${progress.total}`;
    values[1].textContent = tasks.filter(item => item.status === 'inProgress').length;
    values[2].textContent = tasks.filter(item => item.status === 'blocked').length;
    region('stats').querySelectorAll('.stat-card__label')[2].textContent = 'Đang vướng mắc';
    region('journey-name').textContent = hire?.journeyId ? journey?.title || 'Không tìm thấy hành trình' : 'Chưa gán hành trình';
    region('progress-value').textContent = `${progress.percent}%`;
    region('progress-bar').value = progress.percent;
    const upcoming = tasks.filter(item => item.status !== 'completed')
      .sort((a, b) => (parseStoredDate(a.dueDate)?.getTime() || Infinity) - (parseStoredDate(b.dueDate)?.getTime() || Infinity)).slice(0, 5);
    region('upcoming-tasks').replaceChildren(...upcoming.map(task => createTaskItem(task)));
    if (!upcoming.length) region('upcoming-tasks').append(element('p', 'form-field__hint', tasks.length ? 'Bạn đã hoàn thành các nhiệm vụ.' : 'Chưa có nhiệm vụ.'));
    region('mentor').replaceChildren();
    if (mentor) {
      region('mentor').append(createAvatar(mentor), element('strong', '', mentor.fullName), element('p', 'form-field__hint', mentor.jobTitle || 'Người hướng dẫn'), actionButton('Thông tin liên hệ', 'contact-mentor', mentor.id, 'primary'));
    } else region('mentor').append(element('p', 'form-field__hint', 'Chưa được phân công mentor.'));
    const documents = getReadableDocuments().slice(0, 4);
    region('recommended-documents').replaceChildren(...documents.map(createDocumentCard));
    if (!documents.length) region('recommended-documents').append(element('p', 'form-field__hint', 'Chưa có tài liệu phù hợp.'));
  }
  watchData(['tasks', 'newHires', 'users', 'documents', 'journeys'], render, region('dashboard-state'));
  region('mentor').addEventListener('click', event => {
    if (!event.target.closest('[data-action="contact-mentor"]')) return;
    try {
      const { mentor } = getMyProfile();
      if (!mentor) throw new Error('Chưa có mentor.');
      const content = element('div', 'form__grid');
      content.append(element('strong', '', mentor.fullName), element('p', '', mentor.email));
      ui.openModal({ title: 'Liên hệ mentor', content });
    } catch (error) { showError(error); }
  });
}
