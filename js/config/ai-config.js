/**
 * ai-config.js — Cấu hình tập trung cho hệ thống AI OnboardAI (Gemini API & Mock Mode).
 * 
 * NGUYÊN TẮC BẢO MẬT FRONTEND THUẦN (CSE122):
 * - Tuyệt đối KHÔNG lưu API key vào LocalStorage hoặc SessionStorage.
 * - API key CHỈ được lưu trong bộ nhớ tạm (in-memory closure variable) của phiên duyệt web.
 * - Khi người dùng tải lại trang (F5) hoặc đóng tab, API key sẽ tự động bị xóa khỏi bộ nhớ.
 * - API key KHÔNG được in ra console, lịch sử aiHistory hoặc báo cáo lỗi.
 * - Chế độ gọi trực tiếp từ trình duyệt chỉ phù hợp cho môi trường thử nghiệm/demo có kiểm soát.
 *   Khi triển khai công khai thực tế, bắt buộc phải có backend/proxy bảo mật.
 */

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

export const SUPPORTED_MODELS = Object.freeze([
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite (Khuyên dùng)'
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (Phân tích nâng cao)'
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash'
  }
]);

const SUPPORTED_MODEL_IDS = new Set(SUPPORTED_MODELS.map(({ id }) => id));


export const DEFAULT_TIMEOUT_MS = 20000; // 20 giây

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const AI_MODES = Object.freeze({
  GEMINI: 'gemini',
  MOCK: 'mock',
});

export const SENSITIVE_DATA_WARNING = 'Không nhập mật khẩu, token hoặc dữ liệu nhạy cảm.';

export const FRONTEND_SECURITY_DISCLAIMER =
  'Lưu ý bảo mật (CSE122): API Key chỉ được lưu trong bộ nhớ tạm (RAM) của phiên trình duyệt hiện tại để phục vụ kiểm thử bài tập và sẽ mất khi tải lại trang (F5). Ứng dụng Frontend thuần không lưu API Key vào LocalStorage/SessionStorage. Gọi API trực tiếp từ trình duyệt chỉ dùng trong môi trường thử nghiệm có kiểm soát; triển khai công khai cần proxy backend bảo mật.';

// --- IN-MEMORY STATE (KHÔNG LƯU BROWSER STORAGE) ---
let currentApiKey = '';
let currentMode = AI_MODES.MOCK; // Mặc định là Mock mode nếu chưa nhập API Key
let currentModel = DEFAULT_MODEL;
let currentTimeoutMs = DEFAULT_TIMEOUT_MS;

const listeners = new Set();

function notifyListeners() {
  const snapshot = {
    mode: currentMode,
    model: currentModel,
    hasKey: Boolean(currentApiKey && currentApiKey.trim()),
    maskedKey: getMaskedApiKey(),
  };
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // Listener lỗi không làm ảnh hưởng các luồng khác
    }
  }
}

/**
 * Lấy API key hiện tại từ bộ nhớ tạm (CHỈ dùng cho tầng HTTP gemini-api.js).
 */
export function getApiKey() {
  return currentApiKey;
}

/**
 * Đặt API key vào bộ nhớ tạm.
 * Tự động chuyển sang chế độ GEMINI nếu key hợp lệ.
 */
export function setApiKey(key) {
  const sanitized = typeof key === 'string' ? key.trim() : '';
  if (sanitized && (sanitized.length > 4096 || /\s/.test(sanitized))) {
    throw new Error('API key không đúng định dạng.');
  }
  currentApiKey = sanitized;
  if (sanitized) {
    currentMode = AI_MODES.GEMINI;
  } else {
    currentMode = AI_MODES.MOCK;
  }
  notifyListeners();
}

/**
 * Kiểm tra xem đã có API key trong bộ nhớ chưa.
 */
export function hasApiKey() {
  return Boolean(currentApiKey && currentApiKey.trim());
}

/**
 * Xóa API key khỏi bộ nhớ tạm và chuyển về chế độ Mock.
 */
export function clearApiKey() {
  currentApiKey = '';
  currentMode = AI_MODES.MOCK;
  notifyListeners();
}

/**
 * Trả về chuỗi API key đã được che (masking) an toàn để hiển thị trên UI.
 * Tuyệt đối không để lộ toàn bộ key trên giao diện.
 */
export function getMaskedApiKey() {
  if (!currentApiKey || !currentApiKey.trim()) return '';
  const trimmed = currentApiKey.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

/**
 * Lấy chế độ AI hiện tại ('gemini' | 'mock').
 */
export function getAiMode() {
  return currentMode;
}

/**
 * Chuyển đổi chế độ AI ('gemini' | 'mock').
 */
export function setAiMode(mode) {
  if (mode !== AI_MODES.GEMINI && mode !== AI_MODES.MOCK) {
    throw new Error(`Chế độ AI không hợp lệ: "${mode}". Chỉ chấp nhận "gemini" hoặc "mock".`);
  }
  currentMode = mode;
  notifyListeners();
}

/**
 * Lấy model Gemini đang được cấu hình.
 */
export function getModel() {
  return currentModel;
}

/**
 * Cập nhật model Gemini muốn sử dụng.
 */
export function setModel(model) {
  const normalized = typeof model === 'string' ? model.trim() : '';
  if (!SUPPORTED_MODEL_IDS.has(normalized)) {
    throw new Error('Model Gemini không nằm trong danh sách được hỗ trợ.');
  }
  currentModel = normalized;
  notifyListeners();
}

export function isSupportedModel(model) {
  return typeof model === 'string' && SUPPORTED_MODEL_IDS.has(model.trim());
}

/**
 * Lấy thời gian chờ tối đa (ms).
 */
export function getTimeoutMs() {
  return currentTimeoutMs;
}

/**
 * Đặt thời gian chờ tối đa (ms).
 */
export function setTimeoutMs(ms) {
  const parsed = Number(ms);
  if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 60000) {
    throw new Error('Thời gian timeout phải từ 1 đến 60 giây.');
  }
  currentTimeoutMs = Math.round(parsed);
}

/**
 * Đăng ký theo dõi thay đổi cấu hình AI (dùng cho cập nhật UI phản ứng).
 * @param {Function} callback
 * @returns {Function} Hàm hủy đăng ký
 */
export function subscribeAiConfig(callback) {
  if (typeof callback === 'function') {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }
  return () => {};
}

