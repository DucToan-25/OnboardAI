import { parseStoredDate } from '../common/format.js';

const ENUMS = Object.freeze({
  users: {
    role: ['newHire', 'mentor', 'hr', 'admin'],
    status: ['active', 'inactive', 'invited'],
  },
  newHires: {
    status: ['notStarted', 'inProgress', 'completed', 'archived'],
  },
  tasks: {
    status: ['todo', 'inProgress', 'blocked', 'completed', 'archived'],
    priority: ['low', 'medium', 'high'],
  },
  departments: {
    status: ['active', 'inactive'],
  },
  documents: {
    status: ['draft', 'active', 'archived'],
    targetRole: ['all', 'newhire', 'mentor', 'hr', 'admin'],
  },
  checkins: {
    status: ['scheduled', 'completed', 'cancelled'],
  },
  journeys: {
    status: ['active', 'inactive'],
  },
  news: {
    status: ['draft', 'published', 'archived'],
  },
  aiMockData: {
    featureType: ['checklistPersonalizer', 'fallback'],
    status: ['active', 'inactive'],
  },
  aiHistory: {
    featureType: ['policyQA', 'checklistPersonalizer', 'progressRisk'],
    decision: ['pending', 'accepted', 'rejected'],
  },
});

const REQUIRED_STRINGS = Object.freeze({
  users: ['id', 'fullName', 'email', 'role', 'status', 'createdAt', 'password'],
  newHires: ['id', 'userId', 'departmentId', 'jobTitle', 'journeyId', 'startDate', 'status'],
  tasks: ['id', 'newHireId', 'journeyId', 'title', 'assignedTo', 'status', 'priority', 'createdBy', 'createdAt', 'updatedAt'],
  departments: ['id', 'name', 'status', 'createdAt', 'updatedAt'],
  documents: ['id', 'title', 'category', 'fileUrl', 'targetRole', 'status', 'createdBy', 'createdAt', 'updatedAt'],
  checkins: ['id', 'newHireId', 'mentorId', 'scheduledAt', 'status', 'createdAt', 'updatedAt'],
  journeys: ['id', 'title', 'targetRole', 'status', 'createdBy', 'createdAt', 'updatedAt'],
  companyInfo: ['id', 'companyName', 'mission', 'vision', 'logoUrl', 'updatedAt', 'updatedBy'],
  news: ['id', 'title', 'summary', 'content', 'category', 'status', 'authorId', 'createdAt', 'updatedAt'],
  aiMockData: ['id', 'featureType', 'inputKeywords', 'resultContent', 'reason', 'status'],
  aiHistory: ['id', 'featureType', 'userId', 'input', 'reason', 'decision', 'createdAt', 'updatedAt'],
  settings: ['id', 'organizationName', 'supportEmail'],
});

const DATE_FIELDS = Object.freeze({
  users: ['createdAt'],
  newHires: ['startDate'],
  tasks: ['dueDate', 'createdAt', 'updatedAt', 'completedAt'],
  departments: ['createdAt', 'updatedAt'],
  documents: ['createdAt', 'updatedAt'],
  checkins: ['scheduledAt', 'createdAt', 'updatedAt'],
  journeys: ['createdAt', 'updatedAt'],
  companyInfo: ['updatedAt'],
  news: ['publishedAt', 'createdAt', 'updatedAt', 'archivedAt'],
  aiHistory: ['createdAt', 'updatedAt', 'archivedAt'],
});

function isWebOrAssetUrl(value, directory) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (/^https?:\/\//i.test(value)) {
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  }
  return new RegExp(`^assets/${directory}/[A-Za-z0-9._/-]+$`).test(value)
    && !value.split('/').includes('..');
}

export function validateRecord(collection, item) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return [{ field: '$', message: 'bản ghi phải là object' }];
  }
  for (const field of REQUIRED_STRINGS[collection] || ['id']) {
    if (typeof item[field] !== 'string' || !item[field].trim()) add(field, 'phải là chuỗi không rỗng');
  }
  for (const [field, values] of Object.entries(ENUMS[collection] || {})) {
    if (!values.includes(item[field])) add(field, `phải thuộc ${values.join(', ')}`);
  }
  for (const field of DATE_FIELDS[collection] || []) {
    if (item[field] != null && item[field] !== '' && !parseStoredDate(item[field])) add(field, 'ngày/giờ không hợp lệ');
  }
  if (collection === 'users' || collection === 'settings') {
    const field = collection === 'users' ? 'email' : 'supportEmail';
    if (typeof item[field] === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item[field].trim())) add(field, 'email không hợp lệ');
  }
  if (collection === 'tasks' && item.dueDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) add('dueDate', 'phải có dạng YYYY-MM-DD hoặc null');
  if (collection === 'newHires' && !/^\d{4}-\d{2}-\d{2}$/.test(item.startDate || '')) add('startDate', 'phải có dạng YYYY-MM-DD');
  if (collection === 'documents') {
    if (!isWebOrAssetUrl(item.fileUrl, 'docs')) add('fileUrl', 'phải là HTTP(S) hoặc đường dẫn assets/docs an toàn');
    if (item.knowledge != null && !Array.isArray(item.knowledge)) add('knowledge', 'phải là mảng');
    const knowledgeIds = new Set();
    for (const [index, entry] of (Array.isArray(item.knowledge) ? item.knowledge : []).entries()) {
      const field = `knowledge[${index}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { add(field, 'phải là object'); continue; }
      for (const name of ['id', 'topic', 'title', 'content', 'sourceDocumentId', 'targetRole', 'status', 'updatedAt']) {
        if (typeof entry[name] !== 'string' || !entry[name].trim()) add(`${field}.${name}`, 'phải là chuỗi không rỗng');
      }
      if (knowledgeIds.has(entry.id)) add(`${field}.id`, 'bị trùng trong tài liệu');
      knowledgeIds.add(entry.id);
      if (entry.sourceDocumentId !== item.id) add(`${field}.sourceDocumentId`, 'phải trỏ về tài liệu chứa kiến thức');
      if (!['all', 'newhire', 'mentor', 'hr', 'admin'].includes(entry.targetRole)) add(`${field}.targetRole`, 'không hợp lệ');
      if (!['demo', 'needsConfirmation'].includes(entry.status)) add(`${field}.status`, 'không hợp lệ');
      if (entry.departmentId !== null && (typeof entry.departmentId !== 'string' || !entry.departmentId)) add(`${field}.departmentId`, 'phải là ID hoặc null');
      if (!parseStoredDate(entry.updatedAt)) add(`${field}.updatedAt`, 'ngày không hợp lệ');
      if (!Array.isArray(entry.keywords) || !entry.keywords.length || entry.keywords.some(value => typeof value !== 'string' || !value.trim())) add(`${field}.keywords`, 'phải là mảng từ khóa không rỗng');
      if (!Array.isArray(entry.faqs) || entry.faqs.some(faq => !faq || typeof faq.question !== 'string' || !faq.question.trim() || typeof faq.answer !== 'string' || !faq.answer.trim())) add(`${field}.faqs`, 'phải là mảng hỏi đáp hợp lệ');
    }
  }
  if (collection === 'companyInfo' && !isWebOrAssetUrl(item.logoUrl, 'images')) add('logoUrl', 'phải là HTTP(S) hoặc đường dẫn assets/images an toàn');
  if (collection === 'journeys' && (!Number.isSafeInteger(item.durationDays) || item.durationDays < 1 || item.durationDays > 365)) add('durationDays', 'phải là số nguyên từ 1 đến 365');
  if (collection === 'aiMockData' && (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1)) add('confidence', 'phải là số từ 0 đến 1');
  if (collection === 'aiHistory') {
    if (!item.result || typeof item.result !== 'object' || Array.isArray(item.result)) add('result', 'phải là object');
    if (!Array.isArray(item.appliedTaskIds)) add('appliedTaskIds', 'phải là mảng');
    if (item.aiSource != null && !['mock', 'gemini', 'rule-based'].includes(item.aiSource)) add('aiSource', 'không hợp lệ');
    if (item.model != null && (typeof item.model !== 'string' || !item.model.trim() || item.model.length > 120)) add('model', 'không hợp lệ');
  }
  if (collection === 'settings') {
    if (item.id !== 'system') add('id', 'singleton phải có ID system');
    if (!Number.isSafeInteger(item.onboardingDays) || item.onboardingDays < 1 || item.onboardingDays > 365) add('onboardingDays', 'phải là số nguyên từ 1 đến 365');
    if (!Number.isSafeInteger(item.reminderDays) || item.reminderDays < 0 || item.reminderDays > 30) add('reminderDays', 'phải là số nguyên từ 0 đến 30');
  }
  return errors;
}

export function assertSeedCollection(collection, items) {
  for (const item of items) {
    const errors = validateRecord(collection, item);
    if (errors.length) {
      const first = errors[0];
      throw new Error(`${collection}/${item?.id || '?'}: ${first.field} ${first.message}.`);
    }
  }
  return items;
}
