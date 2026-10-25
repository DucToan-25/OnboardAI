/**
 * gemini-api.js — Tầng giao tiếp HTTP cấp thấp với Google Gemini REST API.
 * 
 * SỬ DỤNG:
 * - REST API chính thức của Google:
 *   https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * - API key chỉ gửi qua header x-goog-api-key, không đặt trong URL.
 * - fetch(), async/await, AbortController.
 * - KHÔNG phụ thuộc vào npm package hay Node.js backend.
 * - Xử lý đầy đủ timeout, race-condition, mã lỗi HTTP (400, 401, 403, 404, 429, 5xx),
 *   kiểm tra an toàn (safety blocks) và trích xuất JSON an toàn.
 */

import {
  getApiKey,
  getModel,
  getTimeoutMs,
  GEMINI_API_BASE_URL,
  isSupportedModel,
} from '../config/ai-config.js';

// Map quản lý controller theo từng luồng chức năng để hủy yêu cầu cũ khi người dùng gửi liên tiếp
const pendingControllers = new Map();

/**
 * Trích xuất chuỗi JSON từ phản hồi văn bản của Gemini.
 * Gemini thường trả về JSON bọc trong markdown codeblock ```json ... ``` hoặc có văn bản giải thích.
 * @param {string} rawText
 * @returns {any}
 */
export function extractJsonFromText(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('Phản hồi từ Gemini API rỗng, không chứa dữ liệu JSON.');
  }

  const trimmed = rawText.trim();

  // 1. Thử parse trực tiếp
  try {
    return JSON.parse(trimmed);
  } catch {
    // Tiếp tục bóc tách nếu có markdown hoặc văn bản bao quanh
  }

  // 2. Thử bóc tách từ markdown code block ```json ... ``` hoặc ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Tiếp tục tìm cặp ngoặc
    }
  }

  // 3. Tìm cặp ngoặc nhọn { ... } hoặc ngoặc vuông [ ... ] ngoài cùng
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');

  let startIndex = -1;
  let isObject = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
    isObject = false;
  }

  if (startIndex !== -1) {
    const endChar = isObject ? '}' : ']';
    const lastIndex = trimmed.lastIndexOf(endChar);
    if (lastIndex > startIndex) {
      const candidateJson = trimmed.slice(startIndex, lastIndex + 1);
      try {
        return JSON.parse(candidateJson);
      } catch (err) {
        throw new Error(`Gemini trả về JSON có lỗi cú pháp: ${err.message}.`);
      }
    }
  }

  throw new Error('Gemini không trả về cấu trúc JSON hợp lệ. Hãy thử lại yêu cầu.');
}

/**
 * Gửi yêu cầu generateContent tới Google Gemini API.
 * 
 * @param {Object} options
 * @param {string} options.prompt Nội dung prompt gửi cho Gemini
 * @param {string} [options.systemInstruction] Chỉ dẫn hệ thống (persona, format, rules)
 * @param {string} [options.model] Model ghi đè (nếu không truyền sẽ lấy từ cấu hình)
 * @param {string} [options.apiKey] API Key ghi đè (nếu không truyền sẽ lấy từ cấu hình)
 * @param {number} [options.timeoutMs] Thời gian timeout ghi đè (ms)
 * @param {string} [options.featureKey] Khóa luồng (vd: 'policyQA', 'checklist', 'risk') để hủy request cũ
 * @param {boolean} [options.expectJson=true] Yêu cầu Gemini trả về JSON
 * @returns {Promise<any>} Dữ liệu trả về (object nếu expectJson=true, string nếu expectJson=false)
 */
export async function callGeminiApi({
  prompt,
  systemInstruction,
  model,
  apiKey,
  timeoutMs,
  featureKey = 'default',
  expectJson = true,
}) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Nội dung gửi tới Gemini không được để trống.');
  }
  const activeKey = (apiKey || getApiKey() || '').trim();
  if (!activeKey) {
    throw new Error(
      'Chưa cấu hình Google Gemini API Key. Vui lòng mở cài đặt AI trên trang để nhập API Key hoặc chọn Mock Mode.',
    );
  }
  if (activeKey.length > 4096 || /\s/.test(activeKey)) {
    throw new Error('Google Gemini API Key không đúng định dạng.');
  }

  const activeModel = (model || getModel() || '').trim();
  if (!isSupportedModel(activeModel)) {
    throw new Error('Model Gemini không nằm trong danh sách được hỗ trợ.');
  }
  const activeTimeout = timeoutMs == null ? getTimeoutMs() : Number(timeoutMs);
  if (!Number.isFinite(activeTimeout) || activeTimeout < 1 || activeTimeout > 60000) {
    throw new Error('Thời gian chờ Gemini phải từ 1 ms đến 60 giây.');
  }

  // Kiểm tra kết nối Internet của trình duyệt
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Trình duyệt đang ngoại tuyến (mất kết nối Internet). Vui lòng kiểm tra lại mạng.');
  }

  // Quản lý Race Condition: Hủy yêu cầu đang chạy trước đó của cùng featureKey
  if (pendingControllers.has(featureKey)) {
    const oldController = pendingControllers.get(featureKey);
    oldController.abort('superseded');
    pendingControllers.delete(featureKey);
  }

  const controller = new AbortController();
  pendingControllers.set(featureKey, controller);

  // Thiết lập timer timeout
  let isTimedOut = false;
  const timeoutId = setTimeout(() => {
    isTimedOut = true;
    controller.abort('timeout');
  }, activeTimeout);

  const url = `${GEMINI_API_BASE_URL}/${encodeURIComponent(activeModel)}:generateContent`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt.trim() }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2048,
    },
  };

  if (expectJson) {
    requestBody.generationConfig.responseMimeType = 'application/json';
  }

  if (systemInstruction && typeof systemInstruction === 'string' && systemInstruction.trim()) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction.trim() }],
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': activeKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Xử lý các mã lỗi HTTP chi tiết
    if (!response.ok) {
      const status = response.status;

      if (status === 400) {
        throw new Error(
          'Yêu cầu gửi tới Gemini không hợp lệ (HTTP 400). Hãy kiểm tra API key, model và dữ liệu đầu vào.',
        );
      }
      if (status === 401 || status === 403) {
        throw new Error(
          'API key không hợp lệ hoặc không có quyền truy cập Google Gemini API (HTTP 401/403). Vui lòng kiểm tra lại key tại Google AI Studio.',
        );
      }
      if (status === 404) {
        throw new Error(
          `Model "${activeModel}" không tồn tại hoặc không được hỗ trợ bởi API key này (HTTP 404). Hãy kiểm tra lại model trong cấu hình AI.`,
        );
      }
      if (status === 429) {
        throw new Error(
          'Đã vượt quá hạn mức gọi API (HTTP 429 Quota Exceeded / Rate Limit). Vui lòng đợi ít phút rồi thử lại, hoặc chuyển sang chế độ Mock.',
        );
      }
      if (status >= 500) {
        throw new Error(
          `Máy chủ Google Gemini đang gặp sự cố tạm thời (HTTP ${status}). Vui lòng thử lại sau giây lát.`,
        );
      }

      throw new Error(
        `Google Gemini API từ chối yêu cầu (HTTP ${status}). Vui lòng thử lại hoặc chuyển sang Mock Mode.`,
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Gemini API trả về phản hồi không phải JSON hợp lệ.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Gemini API trả về cấu trúc phản hồi không hợp lệ.');
    }

    // Kiểm tra phản hồi an toàn (Content Safety filter)
    if (data.promptFeedback?.blockReason) {
      throw new Error(
        `Nội dung câu hỏi/yêu cầu bị bộ lọc an toàn của Google Gemini từ chối (Lý do: ${data.promptFeedback.blockReason}).`,
      );
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('Gemini API không trả về phương án câu trả lời nào.');
    }

    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Nội dung phản hồi bị bộ lọc an toàn của Google Gemini chặn lại.');
    }

    const parts = candidate.content?.parts;
    const rawText = Array.isArray(parts)
      ? parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('')
      : '';
    if (!rawText.trim()) {
      throw new Error('Gemini API trả về nội dung rỗng.');
    }

    if (expectJson) {
      return extractJsonFromText(rawText);
    }

    return rawText;
  } catch (error) {
    clearTimeout(timeoutId);

    // Xử lý khi request bị hủy (AbortError)
    if (error.name === 'AbortError' || controller.signal.aborted) {
      if (controller.signal.reason === 'superseded') {
        const supersededErr = new Error('Yêu cầu đã được thay thế bởi thao tác mới hơn.');
        supersededErr.code = 'SUPERSEDED';
        throw supersededErr;
      }
      if (isTimedOut || controller.signal.reason === 'timeout') {
        throw new Error(
          `Quá thời gian chờ phản hồi từ Gemini API (${activeTimeout / 1000}s). Vui lòng kiểm tra đường truyền và thử lại.`,
        );
      }
    }

    // Nếu lỗi do mạng mất kết nối (TypeError fetch failed)
    if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
      throw new Error(
        'Không thể kết nối đến máy chủ Google Gemini. Vui lòng kiểm tra lại kết nối Internet hoặc tường lửa.',
      );
    }

    throw error;
  } finally {
    if (pendingControllers.get(featureKey) === controller) {
      pendingControllers.delete(featureKey);
    }
  }
}

/**
 * Kiểm tra kết nối nhanh với Google Gemini API bằng một API key cụ thể.
 * @param {string} apiKey
 * @param {string} [model]
 * @returns {Promise<{ ok: boolean, model: string, message: string }>}
 */
export async function testApiKeyConnection(apiKey, model = getModel()) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, model, message: 'Chưa nhập API Key.' };
  }

  try {
    const result = await callGeminiApi({
      prompt: 'Trả về JSON đơn giản: {"status": "ok", "message": "connected"}',
      model,
      apiKey: apiKey.trim(),
      timeoutMs: 10000, // Timeout ngắn 10s cho bài test
      featureKey: 'testConnection',
      expectJson: true,
    });

    if (result && typeof result === 'object' && !Array.isArray(result) && result.status === 'ok') {
      return {
        ok: true,
        model,
        message: 'Kết nối Google Gemini API thành công!',
      };
    }
    return {
      ok: false,
      model,
      message: 'Gemini phản hồi nhưng định dạng không đúng.',
    };
  } catch (error) {
    return {
      ok: false,
      model,
      message: error.message || 'Kiểm tra kết nối thất bại.',
    };
  }
}

