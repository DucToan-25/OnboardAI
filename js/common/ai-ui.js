/**
 * ai-ui.js — Các thành phần giao diện dùng chung cho tính năng AI (Gemini / Mock).
 * 
 * CHỨC NĂNG:
 * 1. Thanh trạng thái AI (Status Bar) hiển thị rõ đang ở chế độ Gemini thật hay Mock.
 * 2. Modal cấu hình AI Key & Model:
 *    - Nhập API Key tạm thời vào RAM.
 *    - Kiểm tra kết nối trước khi lưu.
 *    - Chuyển đổi linh hoạt giữa Gemini Mode và Mock Mode.
 * 3. Huy hiệu nguồn kết quả (Source Badge): hiển thị rõ kết quả từ Gemini hay Mock.
 * 4. Khối xử lý lỗi AI thông minh: hiển thị nút "Thử lại" và "Chuyển sang Mock Mode" (Fallback).
 */

import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getMaskedApiKey,
  hasApiKey,
  getAiMode,
  setAiMode,
  getModel,
  setModel,
  SUPPORTED_MODELS,
  AI_MODES,
  subscribeAiConfig,
  FRONTEND_SECURITY_DISCLAIMER,
} from '../config/ai-config.js';
import { testApiKeyConnection } from '../services/gemini-api.js';
import { element, actionButton } from './renderers.js';
import { openModal, showToast } from './ui.js';

/**
 * Tạo huy hiệu hiển thị nguồn tạo ra kết quả AI.
 * @param {'gemini'|'mock'|'rule-based'} [source]
 * @param {string} [modelName]
 * @returns {HTMLElement}
 */
export function createAiSourceBadge(source = 'mock', modelName = '') {
  const badge = document.createElement('span');
  badge.className = 'badge';

  if (source === 'gemini') {
    badge.classList.add('badge--success');
    badge.textContent = `✓ Gemini AI (${modelName || 'Flash'})`;
    badge.title = 'Nội dung được tạo bởi Google Gemini API thật';
  } else if (source === 'rule-based') {
    badge.classList.add('badge--neutral');
    badge.textContent = 'Quy tắc hệ thống';
    badge.title = 'Đánh giá dựa trên công thức và quy tắc logic';
  } else {
    badge.classList.add('badge--neutral');
    badge.textContent = 'Dữ liệu mẫu (Mock)';
    badge.title = 'Nội dung tra cứu từ dữ liệu mẫu giả lập';
  }

  return badge;
}

/**
 * Mở modal cấu hình API Key và chế độ AI.
 * @param {Object} options
 * @param {Object} [options.ui] Đối tượng UI nếu có (để gọi openModal / showToast)
 * @param {Function} [options.onApplied] Callback khi cấu hình được áp dụng
 */
export function openAiConfigModal({ ui, onApplied } = {}) {
  const openModalFn = ui?.openModal || openModal;
  const showToastFn = ui?.showToast || showToast;

  const content = element('div', 'form ai-config');

  // Khối thông báo bảo mật
  const alertBox = element('div', 'alert alert--info ai-config__notice');
  const alertTitle = element('p', 'alert__title', 'Bảo mật API Key trong Frontend');
  const alertMsg = element('p', 'alert__message', FRONTEND_SECURITY_DISCLAIMER);
  alertBox.append(alertTitle, alertMsg);
  content.append(alertBox);

  // Chọn chế độ hoạt động
  const modeField = element('div', 'form-field');
  const modeLabel = element('label', 'form-field__label', 'Chế độ hoạt động AI');
  const modeSelect = element('select', 'form-field__control');
  modeSelect.id = 'ai-mode-select';
  modeLabel.htmlFor = modeSelect.id;

  const geminiOption = element('option', '', 'Google Gemini API thật (Gọi trực tiếp từ trình duyệt)');
  geminiOption.value = AI_MODES.GEMINI;
  const mockOption = element('option', '', 'Dữ liệu mẫu (Mock Mode - Thử nghiệm không cần key)');
  mockOption.value = AI_MODES.MOCK;

  modeSelect.append(geminiOption, mockOption);
  modeSelect.value = getAiMode();
  modeField.append(modeLabel, modeSelect);
  content.append(modeField);

  // Chọn Model Gemini
  const modelField = element('div', 'form-field');
  const modelLabel = element('label', 'form-field__label', 'Model Google Gemini');
  const modelSelect = element('select', 'form-field__control');
  modelSelect.id = 'ai-model-select';
  modelLabel.htmlFor = modelSelect.id;

  for (const m of SUPPORTED_MODELS) {
    const opt = element('option', '', m.name);
    opt.value = m.id;
    modelSelect.append(opt);
  }
  modelSelect.value = getModel();
  modelField.append(modelLabel, modelSelect);
  content.append(modelField);

  // Ô nhập API Key
  const keyField = element('div', 'form-field');
  const keyLabel = element('label', 'form-field__label', 'Google Gemini API Key');
  const keyInputWrap = element('div', 'ai-config__key-row');

  const keyInput = element('input', 'form-field__control');
  keyInput.type = 'password';
  keyInput.id = 'gemini-key-input';
  keyLabel.htmlFor = keyInput.id;
  keyInput.placeholder = hasApiKey() ? `Đang có key: ${getMaskedApiKey()} (nhập mới để đổi)` : 'Nhập API key bắt đầu bằng AIzaSy...';
  keyInput.value = '';
  keyInput.autocomplete = 'off';

  const toggleBtn = element('button', 'btn btn--ghost btn--sm', 'Hiện');
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('aria-controls', keyInput.id);
  toggleBtn.setAttribute('aria-pressed', 'false');
  toggleBtn.addEventListener('click', () => {
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      toggleBtn.textContent = 'Ẩn';
      toggleBtn.setAttribute('aria-pressed', 'true');
    } else {
      keyInput.type = 'password';
      toggleBtn.textContent = 'Hiện';
      toggleBtn.setAttribute('aria-pressed', 'false');
    }
  });

  keyInputWrap.append(keyInput, toggleBtn);
  const keyHint = element(
    'p',
    'form-field__hint',
    'Lấy key miễn phí tại aistudio.google.com. Key KHÔNG lưu vào LocalStorage/SessionStorage; sẽ mất khi tải lại trang (F5).',
  );

  keyField.append(keyLabel, keyInputWrap, keyHint);
  content.append(keyField);

  // Vùng thông báo kiểm tra kết nối
  const testStatus = element('div', 'ai-config__test-status');
  testStatus.setAttribute('role', 'status');
  testStatus.setAttribute('aria-live', 'polite');
  content.append(testStatus);

  // Nút hành động
  const actions = element('div', 'form__actions ai-config__actions');

  const leftActions = element('div', 'form__actions');

  const rightActions = element('div', 'form__actions');

  const testBtn = element('button', 'btn btn--secondary btn--sm', 'Kiểm tra kết nối');
  testBtn.type = 'button';

  const clearBtn = element('button', 'btn btn--ghost btn--sm', 'Xóa Key & Dùng Mock');
  clearBtn.type = 'button';

  const cancelBtn = element('button', 'btn btn--ghost btn--sm', 'Đóng');
  cancelBtn.type = 'button';

  const saveBtn = element('button', 'btn btn--primary btn--sm', 'Lưu & Áp dụng');
  saveBtn.type = 'button';

  leftActions.append(testBtn, clearBtn);
  rightActions.append(cancelBtn, saveBtn);
  actions.append(leftActions, rightActions);
  content.append(actions);

  const modal = openModalFn({
    title: 'Cấu hình Google Gemini AI',
    content,
  });

  cancelBtn.addEventListener('click', () => modal.close());

  // Xử lý nút Kiểm tra kết nối
  testBtn.addEventListener('click', async () => {
    const rawKey = keyInput.value.trim() || getApiKey();
    if (!rawKey) {
      testStatus.replaceChildren(
        element('p', 'form-field__hint', '⚠️ Vui lòng nhập API Key để kiểm tra.'),
      );
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Đang kiểm tra…';
    testStatus.replaceChildren(
      element('p', 'form-field__hint', 'Đang gửi yêu cầu thử nghiệm tới Google Gemini…'),
    );

    const result = await testApiKeyConnection(rawKey, modelSelect.value);

    testBtn.disabled = false;
    testBtn.textContent = 'Kiểm tra kết nối';

    if (result.ok) {
      testStatus.replaceChildren(
        element('p', 'badge badge--success', `✓ ${result.message} (${result.model})`),
      );
    } else {
      testStatus.replaceChildren(
        element('p', 'alert alert--danger', `✕ ${result.message}`),
      );
    }
  });

  // Xử lý nút Xóa Key & Dùng Mock
  clearBtn.addEventListener('click', async () => {
    clearApiKey();
    await modal.close();
    showToastFn({ message: 'Đã xóa API Key khỏi bộ nhớ và chuyển về Mock Mode.', type: 'info' });
    if (typeof onApplied === 'function') onApplied();
  });

  // Xử lý nút Lưu & Áp dụng
  saveBtn.addEventListener('click', async () => {
    const selectedMode = modeSelect.value;
    const selectedModel = modelSelect.value;
    const newKey = keyInput.value.trim();

    if (selectedMode === AI_MODES.GEMINI && !newKey && !hasApiKey()) {
      testStatus.replaceChildren(
        element('p', 'alert alert--warning', 'Chế độ Gemini yêu cầu phải có API Key. Hãy nhập key hoặc chọn Mock Mode.'),
      );
      return;
    }

    try {
      setModel(selectedModel);
      if (newKey) setApiKey(newKey);
      setAiMode(selectedMode);
    } catch (error) {
      testStatus.replaceChildren(
        element('p', 'alert alert--warning', error.message || 'Cấu hình AI không hợp lệ.'),
      );
      return;
    }
    await modal.close();

    const modeMsg = selectedMode === AI_MODES.GEMINI
      ? `Đã cấu hình Gemini Mode (${selectedModel}). Hãy kiểm tra kết nối nếu chưa thử key.`
      : 'Đã kích hoạt chế độ Dữ liệu mẫu (Mock Mode).';

    showToastFn({ message: modeMsg, type: 'success' });
    if (typeof onApplied === 'function') onApplied();
  });
}

/**
 * Tạo thanh điều khiển trạng thái AI gắn gọn (AI Status Bar) để đặt trong trang.
 * @param {Object} options
 * @param {Object} [options.ui]
 * @param {Function} [options.onModeChange]
 * @returns {HTMLElement}
 */
export function createAiStatusBar({ ui, onModeChange } = {}) {
  const bar = element('div', 'ai-status');

  const left = element('div', 'ai-status__summary');

  const title = element('span', 'form-field__label ai-status__label', 'Chế độ AI:');

  const badgeContainer = element('span', '');
  const keyInfo = element('span', 'form-field__hint ai-status__key', '');

  left.append(title, badgeContainer, keyInfo);

  const configBtn = actionButton('⚙️ Cấu hình AI', 'configure-ai', undefined, 'ghost');
  configBtn.type = 'button';

  bar.append(left, configBtn);

  function update() {
    const mode = getAiMode();
    const model = getModel();
    const hasKey = hasApiKey();
    const masked = getMaskedApiKey();

    badgeContainer.replaceChildren(createAiSourceBadge(mode, model));

    if (mode === AI_MODES.GEMINI) {
      keyInfo.textContent = hasKey ? `· Key: ${masked}` : '· (Chưa có API key)';
    } else {
      keyInfo.textContent = '· (Mô phỏng nội bộ)';
    }
  }

  update();
  subscribeAiConfig(() => {
    update();
  });

  configBtn.addEventListener('click', () => {
    openAiConfigModal({ ui, onApplied: onModeChange });
  });

  return bar;
}

/**
 * Tạo khối thông báo lỗi AI kèm nút "Thử lại" và "Chuyển sang Mock Mode".
 * @param {Object} options
 * @param {Error|Object} options.error
 * @param {Function} options.onRetry
 * @param {Function} options.onFallbackMock
 * @param {Object} [options.ui]
 * @returns {HTMLElement}
 */
export function createAiErrorNotice({ error, onRetry, onFallbackMock, ui }) {
  const container = element('div', 'alert alert--danger ai-error');

  const title = element('p', 'alert__title', 'Không thể kết nối Google Gemini API');
  const message = element('p', 'alert__message', error?.message || 'Đã xảy ra lỗi khi gọi Gemini API.');
  container.append(title, message);

  const actions = element('div', 'form__actions ai-error__actions');

  if (typeof onRetry === 'function') {
    const retryBtn = actionButton('Thử lại (Gemini)', 'retry-ai', undefined, 'primary');
    retryBtn.type = 'button';
    retryBtn.addEventListener('click', () => onRetry());
    actions.append(retryBtn);
  }

  if (typeof onFallbackMock === 'function') {
    const mockBtn = actionButton('Chuyển sang Mock Mode', 'fallback-mock', undefined, 'secondary');
    mockBtn.type = 'button';
    mockBtn.addEventListener('click', () => {
      setAiMode(AI_MODES.MOCK);
      onFallbackMock();
    });
    actions.append(mockBtn);
  }

  const configBtn = actionButton('Kiểm tra API Key', 'config-ai-err', undefined, 'ghost');
  configBtn.type = 'button';
  configBtn.addEventListener('click', () => {
    openAiConfigModal({ ui, onApplied: onRetry });
  });
  actions.append(configBtn);

  container.append(actions);
  return container;
}

