// Một dialog dùng lại cho chi tiết, lịch, danh sách đã lưu và thông tin công ty.
const dialog = document.querySelector('#modal-root');
let opener;
let messageTimer;

export function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

export function openModal(title, content, view = '') {
  document.querySelector('#modal-title').textContent = title;
  document.querySelector('#modal-body').replaceChildren(content);
  dialog.dataset.view = view;
  if (!dialog.open) {
    opener = document.activeElement;
    dialog.showModal(); // Trình duyệt hỗ trợ chặn nền, giữ focus và đóng bằng Escape.
  }
  document.body.classList.add('is-modal-open');
  document.querySelector('#close-modal').focus();
}

document.querySelector('#close-modal').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => {
  document.body.classList.remove('is-modal-open');
  if (opener && opener !== document.body && opener.isConnected) opener.focus();
  else document.querySelector('#news-search').focus();
});

export function showMessage(message) {
  const box = document.querySelector('#toast-root');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { box.hidden = true; }, 4000);
}
