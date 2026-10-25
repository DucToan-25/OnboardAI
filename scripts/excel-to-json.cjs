#!/usr/bin/env node
// Công cụ chuyển file Excel OnboardAI (.xlsx) sang JSON cho ba loại dữ liệu SV3:
// journeys, companyInfo, news. Không dùng thư viện ngoài (chỉ node:fs, node:zlib).
//
// Cách dùng:
//   node scripts/excel-to-json.cjs <duong-dan.xlsx>              # chỉ kiểm tra và in báo cáo
//   node scripts/excel-to-json.cjs <duong-dan.xlsx> --write      # ghi JSON vào assets/data/
//   Tùy chọn: --skip-ids=id1,id2   bỏ các dòng mẫu (theo ID) khỏi dữ liệu xuất ra
//
// Quy tắc an toàn:
// - Không bao giờ xóa hoặc ghi đè bản ghi đã có trong JSON chuẩn; chỉ thêm ID mới.
// - Tự tăng version của collection đã đổi để trình duyệt nạp snapshot JSON mới.
// - In rõ số dòng hợp lệ / không hợp lệ / bị bỏ qua và lý do từng dòng.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const DATA_DIR = path.join(root, 'assets', 'data');

const SHEETS = ['journeys', 'companyInfo', 'news'];
const OUTPUT_NAMES = { journeys: 'journeys.json', companyInfo: 'companyInfo.json', news: 'news.json' };
// Preserve IDs from the source; references are validated against the canonical JSON files.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/;

// Đọc bảng phân vùng trung tâm của file ZIP rồi trả về danh sách phần tử.
function readZip(buffer) {
  if (buffer.length < 22) throw new Error('File không phải .xlsx/ZIP hợp lệ.');
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65558); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error('Không đọc được cấu trúc .xlsx (thiếu bản ghi kết thúc ZIP).');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  if (count === 0xffff || offset === 0xffffffff) throw new Error('Chưa hỗ trợ file ZIP64.');
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > eocd || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Bảng mục lục ZIP bị lỗi.');
    if (buffer.readUInt16LE(offset + 8) & 1) throw new Error('Không hỗ trợ file Excel được mã hóa.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    if (offset + 46 + nameLength + extraLength + commentLength > eocd) throw new Error('Phần tử ZIP bị cắt ngắn.');
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (entries.has(name)) throw new Error(`Phần tử ZIP bị trùng: ${name}.`);
    if (![0, 8].includes(method)) throw new Error(`Không hỗ trợ kiểu nén ZIP ${method}.`);
    entries.set(name, { method, compressedSize, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntry(buffer, entry) {
  const local = entry.localOffset;
  if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('Header phần tử ZIP bị lỗi.');
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const start = local + 30 + nameLength + extraLength;
  if (start + entry.compressedSize > buffer.length) throw new Error('Dữ liệu phần tử ZIP bị cắt ngắn.');
  const data = buffer.subarray(start, start + entry.compressedSize);
  const output = entry.method === 8 ? zlib.inflateRawSync(data, { maxOutputLength: 64 * 1024 * 1024 }) : Buffer.from(data);
  if (output.length !== entry.uncompressedSize) throw new Error('Kích thước phần tử ZIP không khớp.');
  return output;
}

function decodeXml(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key) => {
    if (Object.hasOwn(entities, key)) return entities[key];
    if (key.startsWith('#')) {
      const codePoint = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      if (codePoint > 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)) return String.fromCodePoint(codePoint);
    }
    throw new Error(`XML chứa entity không hợp lệ: ${entity}.`);
  });
}

function elements(xml, tag) {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${tag}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}\\s*>)`, 'g');
  return [...xml.matchAll(pattern)].map(match => ({ attributes: match[1], body: match[2] || '' }));
}
function attributes(text) {
  return Object.fromEntries([...text.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(match => [match[1], decodeXml(match[2] ?? match[3])]));
}
function textContent(xml) {
  return elements(xml.replace(/<(?:[\w.-]+:)?rPh\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?rPh\s*>/g, ''), 't').map(item => decodeXml(item.body)).join('');
}
function parseSharedStrings(xml) { return elements(xml, 'si').map(item => textContent(item.body)); }

function cellValue(cell, type, shared) {
  const raw = decodeXml(elements(cell, 'v')[0]?.body ?? '');
  if (type === 's') {
    if (!/^\d+$/.test(raw) || !Object.hasOwn(shared, Number(raw))) throw new Error('Ô chuỗi tham chiếu sharedStrings không tồn tại.');
    return shared[Number(raw)];
  }
  if (type === 'inlineStr') return textContent(cell);
  if (type === 'b') {
    if (!['0', '1'].includes(raw)) throw new Error('Ô Boolean của Excel không hợp lệ.');
    return raw === '1';
  }
  if (type === 'e') throw new Error('Excel chứa ô lỗi; sửa công thức trước khi nhập.');
  return raw;
}

// Đọc một sheet thành mảng object theo hàng đầu tiên (tên trường camelCase).
function parseSheet(xml, shared) {
  const rows = [];
  for (const row of elements(xml, 'row')) {
    const cells = {};
    for (const cell of elements(row.body, 'c')) {
      const properties = attributes(cell.attributes);
      const reference = properties.r?.match(/^([A-Z]+)\d+$/);
      if (!reference) throw new Error('Ô Excel thiếu địa chỉ cột/hàng hợp lệ.');
      cells[reference[1]] = { type: properties.t || '', body: cell.body };
    }
    rows.push({ cells, rowNumber: Number(attributes(row.attributes).r) || rows.length + 1 });
  }
  if (rows.length < 2) return [];
  const header = rows[0].cells;
  const columns = Object.keys(header).sort((a, b) => a.length - b.length || a.localeCompare(b));
  const fields = columns.map(column => String(cellValue(header[column].body, header[column].type, shared)).trim());
  const namedFields = fields.filter(Boolean);
  if (new Set(namedFields).size !== namedFields.length) throw new Error('Tiêu đề Excel chứa tên trường trùng nhau.');
  return rows.slice(1)
    .map(({ cells: row, rowNumber }) => {
      const record = {};
      for (let index = 0; index < columns.length; index++) {
        const column = columns[index];
        const field = fields[index];
        if (!field) continue;
        record[field] = cellValue(row[column]?.body || '', row[column]?.type || '', shared);
      }
      Object.defineProperty(record, '__rowNumber', { value: rowNumber });
      return record;
    })
    .filter((record) => Object.values(record).some((value) => value !== '' && value !== false));
}

function validDateOnly(text) {
  const match = text.match(DATE_ONLY);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(+date) && date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
function normalizeDate(value, date1904 = false) {
  const text = String(value ?? '').trim();
  if (!text) return { value: null };
  if (DATE_ONLY.test(text)) return validDateOnly(text) ? { value: text } : { value: null, invalid: true };
  const dateTime = text.match(DATE_TIME);
  if (dateTime) {
    const [, date, hour, minute, second = '00', fraction = '', zone = '+07:00'] = dateTime;
    if (!validDateOnly(date) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return { value: null, invalid: true };
    const normalized = `${date}T${hour}:${minute}:${second}${fraction}${zone}`;
    return Number.isFinite(Date.parse(normalized)) ? { value: normalized } : { value: null, invalid: true };
  }
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    // Excel's 1900 system includes the fictitious 1900-02-29 (serial 60).
    if (!Number.isFinite(serial) || serial > 2958465 || (!date1904 && Math.floor(serial) === 60)) return { value: null, invalid: true };
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
    const date = new Date(epoch + Math.round((serial - (!date1904 && serial >= 60 ? 1 : 0)) * 86400000));
    if (date.getUTCFullYear() > 9999) return { value: null, invalid: true };
    const formatted = date.toISOString();
    return { value: Number.isInteger(serial) ? formatted.slice(0, 10) : `${formatted.slice(0, -1)}+07:00` };
  }
  return { value: null, invalid: true };
}

function toBoolean(value) {
  if (value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'FALSE' || value === 'false' || value === 0 || value === '0' || value === '') return false;
  return null;
}

function mapUserId(value) {
  const id = String(value ?? '').trim();
  if (!id) return { value: null };
  return { value: id };
}

function mapDepartmentId(value) {
  const id = String(value ?? '').trim();
  if (!id) return { value: null };
  return { value: id };
}

// Chuyển một dòng Excel thành bản ghi theo schema web; trả về { record, warnings } hoặc { error }.
function convertRow(sheet, row, index, date1904 = false) {
  const rowName = `dòng ${row.__rowNumber ?? index + 2}`;
  const dates = {};
  for (const field of ({ journeys: ['createdAt', 'updatedAt'], companyInfo: ['updatedAt'], news: ['createdAt', 'updatedAt', 'publishedAt', 'archivedAt'] })[sheet]) {
    dates[field] = normalizeDate(row[field], date1904);
    if (dates[field].invalid) return { error: `${rowName}: ${field} không phải ngày hợp lệ.` };
  }
  if (sheet === 'journeys') {
    const department = mapDepartmentId(row.departmentId);
    const creator = mapUserId(row.createdBy);
    const duration = Number(String(row.durationDays ?? '').trim());
    const status = String(row.status ?? '').trim();
    if (!String(row.title ?? '').trim()) return { error: `${rowName}: thiếu tên hành trình (title).` };
    if (!['active', 'inactive'].includes(status)) {
      return { error: `${rowName}: trạng thái “${status}” không có trong dự án (chỉ active/inactive).` };
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 365) {
      return { error: `${rowName}: durationDays phải là số nguyên 1–365 (đang là “${row.durationDays}”).` };
    }
    const created = dates.createdAt;
    const updated = dates.updatedAt;
    return {
      record: {
        id: String(row.id ?? '').trim(),
        title: String(row.title ?? '').trim(),
        description: String(row.description ?? '').trim(),
        targetRole: String(row.targetRole ?? '').trim(),
        departmentId: department.value,
        durationDays: duration,
        status,
        createdBy: creator.value,
        createdAt: created.value,
        updatedAt: updated.value,
      },
      warnings: [],
    };
  }
  if (sheet === 'companyInfo') {
    if (!String(row.companyName ?? '').trim()) return { error: `${rowName}: thiếu tên công ty (companyName).` };
    const updater = mapUserId(row.updatedBy);
    const updated = dates.updatedAt;
    return {
      record: {
        id: String(row.id ?? '').trim() || 'company-001',
        companyName: String(row.companyName ?? '').trim(),
        tagline: String(row.tagline ?? '').trim(),
        mission: String(row.mission ?? '').trim(),
        vision: String(row.vision ?? '').trim(),
        coreValues: String(row.coreValues ?? '').trim(),
        about: String(row.about ?? '').trim(),
        logoUrl: String(row.logoUrl ?? '').trim(),
        updatedAt: updated.value,
        updatedBy: updater.value,
      },
      warnings: [],
    };
  }
  // news
  const status = String(row.status ?? '').trim();
  if (!String(row.title ?? '').trim()) return { error: `${rowName}: thiếu tiêu đề bản tin (title).` };
  if (!String(row.content ?? '').trim()) return { error: `${rowName}: thiếu nội dung bản tin (content).` };
  if (!['draft', 'published', 'archived'].includes(status)) {
    return { error: `${rowName}: trạng thái “${status}” không hợp lệ (chỉ draft/published/archived).` };
  }
  const featured = toBoolean(row.isFeatured);
  if (featured === null) return { error: `${rowName}: isFeatured phải là TRUE/FALSE (đang là “${row.isFeatured}”).` };
  const author = mapUserId(row.authorId);
  const created = dates.createdAt;
  const updated = dates.updatedAt;
  const published = dates.publishedAt;
  if (!published.value && status === 'published') return { error: `${rowName}: bản tin đã xuất bản phải có publishedAt hợp lệ.` };
  const archived = dates.archivedAt;
  return {
    record: {
      id: String(row.id ?? '').trim(),
      title: String(row.title ?? '').trim(),
      summary: String(row.summary ?? '').trim(),
      content: String(row.content ?? '').trim(),
      category: String(row.category ?? '').trim(),
      status,
      isFeatured: featured,
      publishedAt: status === 'published' ? (published.value || null) : null,
      authorId: author.value,
      createdAt: created.value,
      updatedAt: updated.value,
      archivedAt: status === 'archived' ? (archived.value || updated.value || null) : null,
    },
    warnings: [],
  };
}


function workbookSheets(workbook, relationships) {
  const targets = new Map();
  for (const item of elements(relationships, 'Relationship')) {
    const properties = attributes(item.attributes);
    if (!properties.Type?.endsWith('/worksheet')) continue;
    if (!properties.Id || !properties.Target || targets.has(properties.Id)) throw new Error('Quan hệ worksheet thiếu hoặc trùng ID.');
    if (properties.TargetMode === 'External') throw new Error('Không nhập worksheet từ liên kết ngoài.');
    let target;
    try { target = decodeURIComponent(properties.Target); } catch { throw new Error('Đường dẫn worksheet bị lỗi mã hóa.'); }
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.includes('\\')) throw new Error('Đường dẫn worksheet không hợp lệ.');
    target = path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join('xl', target));
    if (target === '..' || target.startsWith('../')) throw new Error('Đường dẫn worksheet nằm ngoài gói Excel.');
    targets.set(properties.Id, target);
  }
  const sheets = new Map();
  for (const item of elements(workbook, 'sheet')) {
    const properties = attributes(item.attributes);
    const relationId = Object.entries(properties).find(([name]) => name.endsWith(':id'))?.[1];
    if (!properties.name || sheets.has(properties.name)) throw new Error('Tên worksheet thiếu hoặc bị trùng.');
    sheets.set(properties.name, targets.get(relationId));
  }
  return sheets;
}

function appendCollections(seed, rawSeed, exported, versions, rawVersions) {
  // Check again before staging so an open editor cannot be silently overwritten.
  for (const [name, content] of Object.entries(rawSeed)) {
    if (fs.readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf8') !== content) throw new Error(`${name}.json vừa thay đổi; chạy lại lệnh nhập.`);
  }
  if (fs.readFileSync(path.join(DATA_DIR, 'version.json'), 'utf8') !== rawVersions) {
    throw new Error('version.json vừa thay đổi; chạy lại lệnh nhập.');
  }
  const collectionPlans = SHEETS.filter(sheet => exported[sheet]?.length).map(sheet => {
    const file = path.join(DATA_DIR, OUTPUT_NAMES[sheet]);
    return {
      sheet,
      file,
      stage: `${file}.import-${randomUUID()}.tmp`,
      content: `${JSON.stringify([...seed[sheet], ...exported[sheet]], null, 2)}\n`,
      original: rawSeed[sheet],
    };
  });
  if (!collectionPlans.length) {
    console.log('Không có ID mới để ghi; version.json được giữ nguyên.');
    return;
  }
  const nextVersions = { ...versions };
  for (const { sheet } of collectionPlans) nextVersions[sheet] += 1;
  const versionFile = path.join(DATA_DIR, 'version.json');
  const plans = [
    ...collectionPlans,
    {
      sheet: 'version',
      file: versionFile,
      stage: `${versionFile}.import-${randomUUID()}.tmp`,
      content: `${JSON.stringify(nextVersions, null, 2)}\n`,
      original: rawVersions,
    },
  ];
  const committed = [];
  try {
    for (const plan of plans) fs.writeFileSync(plan.stage, plan.content, { encoding: 'utf8', flag: 'wx' });
    for (const plan of plans) {
      fs.renameSync(plan.stage, plan.file);
      committed.push(plan);
    }
  } catch (error) {
    let rollbackFailed = false;
    for (const plan of committed.reverse()) {
      try { fs.writeFileSync(plan.file, plan.original, 'utf8'); } catch { rollbackFailed = true; }
    }
    if (rollbackFailed) throw new Error('Lỗi ghi và khôi phục JSON. Kiểm tra các collection trước khi nhập lại.');
    throw new Error(`Không ghi được JSON; đã khôi phục các collection đã ghi. ${error.code || ''}`);
  } finally {
    for (const plan of plans) if (fs.existsSync(plan.stage)) fs.unlinkSync(plan.stage);
  }
  for (const plan of collectionPlans) {
    console.log(`Added ${exported[plan.sheet].length} records to ${path.relative(root, plan.file)}; version ${versions[plan.sheet]} → ${nextVersions[plan.sheet]}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const input = args.find((arg) => !arg.startsWith('--'));
  const write = args.includes('--write');
  const skipList = args.find((arg) => arg.startsWith('--skip-ids='))?.slice('--skip-ids='.length) || '';
  const skipIds = new Set(skipList.split(',').map((id) => id.trim()).filter(Boolean));
  if (!input) {
    console.error('Cách dùng: node scripts/excel-to-json.cjs <file.xlsx> [--write] [--skip-ids=id1,id2]');
    process.exitCode = 1;
    return;
  }
  const buffer = fs.readFileSync(input);
  const entries = readZip(buffer);
  const read = (name) => {
    const entry = entries.get(name);
    if (!entry) throw new Error(`Thiếu phần tử ${name} trong file .xlsx.`);
    return readEntry(buffer, entry).toString('utf8');
  };
  const shared = entries.has('xl/sharedStrings.xml') ? parseSharedStrings(read('xl/sharedStrings.xml')) : [];
  const workbook = read('xl/workbook.xml');
  const sheets = workbookSheets(workbook, read('xl/_rels/workbook.xml.rels'));
  const date1904 = ['1', 'true'].includes(attributes(elements(workbook, 'workbookPr')[0]?.attributes || '').date1904);
  const seed = {};
  const rawSeed = {};
  for (const name of [...SHEETS, 'users', 'departments']) {
    rawSeed[name] = fs.readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf8');
    try { seed[name] = JSON.parse(rawSeed[name].replace(/^\uFEFF/, '')); } catch { throw new Error(`${name}.json không phải JSON hợp lệ; chưa nhập dữ liệu.`); }
    if (!Array.isArray(seed[name])) throw new Error(`${name}.json phải là mảng.`);
    const ids = new Set();
    for (const item of seed[name]) {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) throw new Error(`${name}.json có ID thiếu hoặc trùng; sửa JSON trước khi nhập.`);
      ids.add(item.id);
    }
  }
  const versionFile = path.join(DATA_DIR, 'version.json');
  const rawVersions = fs.readFileSync(versionFile, 'utf8');
  let versions;
  try { versions = JSON.parse(rawVersions.replace(/^\uFEFF/, '')); } catch { throw new Error('version.json không phải JSON hợp lệ; chưa nhập dữ liệu.'); }
  for (const name of SHEETS) {
    if (!Number.isSafeInteger(versions[name]) || versions[name] < 1) {
      throw new Error(`version.json thiếu version nguyên dương cho ${name}.`);
    }
  }
  const exported = {};
  let hasError = false;

  for (const sheet of SHEETS) {
    const sheetFile = sheets.get(sheet);
    if (!sheetFile) { console.error(`✗ Không tìm thấy worksheet hợp lệ “${sheet}”.`); hasError = true; continue; }
    const rows = parseSheet(read(sheetFile), shared);
    const valid = [];
    const seenIds = new Set();
    const existingIds = new Set((seed[sheet] || []).map((record) => record.id));
    let skipped = 0;
    console.log(`\n=== Sheet ${sheet}: ${rows.length} dòng dữ liệu ===`);
    rows.forEach((row, index) => {
      const id = String(row.id ?? '').trim();
      if (skipIds.has(id)) { skipped += 1; console.log(`- BỎ (chọn không dùng): ${id || `dòng ${index + 2}`}`); return; }
      if (!id) { hasError = true; console.error(`- LỖI: dòng ${row.__rowNumber ?? index + 2} thiếu ID.`); return; }
      if (sheet === 'companyInfo' && id !== 'company-001') {
        hasError = true;
        console.error(`- LỖI: companyInfo là singleton; ID phải là company-001, không nhận “${id}”.`);
        return;
      }
      if (seenIds.has(id)) { hasError = true; console.error(`- LỖI: ID “${id}” trùng trong sheet.`); return; }
      const result = convertRow(sheet, row, index, date1904);
      if (result.error) { hasError = true; console.error(`- LỖI: ${result.error}`); return; }
      for (const [field, collection] of [['departmentId', 'departments'], ['createdBy', 'users'], ['updatedBy', 'users'], ['authorId', 'users']]) {
        const id = result.record[field];
        if (id && !seed[collection].some(item => item.id === id)) { hasError = true; console.error(`- LỖI: ${field} không tồn tại: ${id}`); return; }
      }
      if (existingIds.has(id)) { skipped += 1; console.log(`- BỎ (đã tồn tại trong seed): ${id}`); seenIds.add(id); return; }
      seenIds.add(id);
      valid.push(result.record);
      result.warnings.forEach((warning) => console.log(`  ⚠ ${warning}`));
    });
    console.log(`→ Hợp lệ: ${valid.length} · Bỏ qua: ${skipped}`);
    exported[sheet] = valid;
  }

  if (!write) {
    console.log('\nChưa ghi file. Chạy lại với --write để thêm ID mới và tăng version tương ứng.');
    if (hasError) { console.error('Có dòng không hợp lệ ở trên; sửa Excel rồi chạy lại.'); process.exitCode = 1; }
    return;
  }
  if (hasError) {
    console.error('Có dữ liệu không hợp lệ. Không ghi bất kỳ collection nào.');
    process.exitCode = 1;
    return;
  }
  appendCollections(seed, rawSeed, exported, versions, rawVersions);
}

try { main(); } catch (error) { console.error(`Không thể nhập Excel: ${error.message}`); process.exitCode = 1; }
