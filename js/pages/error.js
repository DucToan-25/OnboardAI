export async function initPage() {
  const actions = document.querySelector('[data-region="error-actions"]');
  for (const link of actions.querySelectorAll('a')) { link.href = 'login.html'; link.textContent = 'Về đăng nhập'; }
  if (actions.querySelectorAll('a').length > 1) actions.querySelectorAll('a')[1].remove();
  actions.querySelector('button')?.addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.assign('../index.html');
  });
}
