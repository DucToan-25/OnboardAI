#!/usr/bin/env node
// Công cụ chuyển file Excel OnboardAI (.xlsx) sang JSON cho ba loại dữ liệu SV3:
// journeys, companyInfo, news. Không dùng thư viện ngoài (chỉ node:fs, node:zlib).
//
// Cách dùng:
//   node scripts/excel-to-json.cjs <duong-dan.xlsx>              # chỉ kiểm tra và in báo cáo
//   node scripts/excel-to-json.cjs <duong-dan.xlsx> --write      # ghi JSON vào assets/data/import/
//   node scripts/excel-to-json.cjs <duong-dan.xlsx> --apply      # ghi JSON và nhập thêm bản ghi mới vào seed.json
//   Tùy chọn: --skip-ids=id1,id2   bỏ các dòng mẫu (theo ID) khỏi dữ liệu xuất ra
//
// Quy tắc an toàn:
// - Không bao giờ xóa hoặc ghi đè bản ghi đã có trong seed.json (--apply chỉ thêm ID mới).
// - In rõ số dòng hợp lệ / không hợp lệ / bị bỏ qua và lý do từng dòng.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const SEED_PATH = path.join(root, 'assets', 'data', 'seed.json');
const OUT_DIR = path.join(root, 'assets', 'data', 'import');
const SHEETS = ['journeys', 'companyInfo', 'news'];
const OUTPUT_NAMES = { journeys: 'journeys.json', companyInfo: 'company-info.json', news: 'news.json' };
// Ánh xạ ID trong Excel sang ID thật của dự án (seed.json). Excel dùng hệ ID mẫu riêng.
const DEPARTMENT_ID_MAP = { 'dept-people': 'dep-hr', 'dept-engineering': 'dep-dev', 'dept-product': 'dep-sales' };
const USER_ID_MAP = { 'user-004': 'usr-hr-001', 'user-005': 'usr-admin-001' };
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/;

// Đọc bảng phân vùng trung tâm của file ZIP rồi trả về danh sách phần tử.
function readZip(buffer) {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65558); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error('Không đọc được cấu trúc .xlsx (thiếu bản ghi kết thúc ZIP).');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, { method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntry(buffer, entry) {
  const local = entry.localOffset;
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const start = local + 30 + nameLength + extraLength;
  const data = buffer.subarray(start, start + entry.compressedSize);
  return entry.method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
}

function parseSharedStrings(xml) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((match) => [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => text[1]).join(''));
}


function cellValue(cell, type, shared) {
  const raw = cell.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
  if (type === 's') return shared[Number(raw)] ?? '';
  if (type === 'inlineStr') return cell.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
  if (type === 'b') return raw === '1';
  return raw;
}

// Đọc một sheet thành mảng object theo hàng đầu tiên (tên trường camelCase).
function parseSheet(xml, shared) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cellMatch of rowMatch[1].matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>([\s\S]*?)<\/c>/g)) {
      cells[cellMatch[1]] = { type: cellMatch[2] || '', body: cellMatch[3] };
    }
    rows.push(cells);
  }
  if (rows.length < 2) return [];
  const header = rows[0];
  const columns = Object.keys(header).sort((a, b) => a.length - b.length || a.localeCompare(b));
  return rows.slice(1)
    .map((row) => {
      const record = {};
      for (const column of columns) {
        const field = String(cellValue(header[column].body, header[column].type, shared)).trim();
        if (!field) continue;
        record[field] = cellValue(row[column]?.body || '', row[column]?.type || '', shared);
      }
      return record;
    })
    .filter((record) => Object.values(record).some((value) => value !== '' && value !== false));
}

function normalizeDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return { value: null };
  if (DATE_ONLY.test(text)) return { value: text };
  const dateTime = text.match(DATE_TIME);
  if (dateTime) return { value: `${dateTime[1]}T${dateTime[2]}:00` };
  if (/^\d{5}$/.test(text)) {
    // Ô ngày của Excel lưu dạng số đếm; đổi về YYYY-MM-DD (mốc 1899-12-30).
    const date = new Date(Date.UTC(1899, 11, 30) + Number(text) * 86400000);
    return { value: date.toISOString().slice(0, 10) };
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
  return { value: USER_ID_MAP[id] || id, unmapped: Boolean(!USER_ID_MAP[id] && !String(id).startsWith('usr-')) };
}

function mapDepartmentId(value) {
  const id = String(value ?? '').trim();
  if (!id) return { value: null };
  return { value: DEPARTMENT_ID_MAP[id] || id, unmapped: Boolean(!DEPARTMENT_ID_MAP[id] && !String(id).startsWith('dep-')) };
}

// Chuyển một dòng Excel thành bản ghi theo schema web; trả về { record, warnings } hoặc { error }.
function convertRow(sheet, row, index) {
  const rowName = `dòng ${index + 2}`;
  if (sheet === 'journeys') {
    const department = mapDepartmentId(row.departmentId);
    const creator = mapUserId(row.createdBy);
    const duration = Number(String(row.durationDays ?? '').trim());
    const status = String(row.status ?? '').trim();
    if (!String(row.title ?? '').trim()) return { error: `${rowName}: thiếu tên hành trình (title).` };
    if (!['draft', 'active', 'archived'].includes(status)) {
      return { error: `${rowName}: trạng thái “${status}” không có trong dự án (chỉ draft/active/archived).` };
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 365) {
      return { error: `${rowName}: durationDays phải là số nguyên 1–365 (đang là “${row.durationDays}”).` };
    }
    const created = normalizeDate(row.createdAt);
    const updated = normalizeDate(row.updatedAt);
    return {
      record: {
        id: String(row.id ?? '').trim(),
        name: String(row.title ?? '').trim(),
        description: String(row.description ?? '').trim(),
        targetRole: String(row.targetRole ?? '').trim(),
        departmentId: department.value,
        durationDays: duration,
        status,
        steps: [],
        createdBy: creator.value,
        createdAt: created.value,
        updatedAt: updated.value,
      },
      warnings: [
        department.unmapped ? `${rowName}: phòng ban “${row.departmentId}” không có trong seed, giữ nguyên ID.` : null,
        creator.unmapped ? `${rowName}: người tạo “${row.createdBy}” không có trong danh sách user đã map.` : null,
      ].filter(Boolean),
    };
  }
  if (sheet === 'companyInfo') {
    const updater = mapUserId(row.updatedBy);
    const updated = normalizeDate(row.updatedAt);
    return {
      record: {
        id: String(row.id ?? '').trim() || 'company-main',
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
  const created = normalizeDate(row.createdAt);
  const updated = normalizeDate(row.updatedAt);
  const published = normalizeDate(row.publishedAt);
  if (published.invalid && status === 'published') return { error: `${rowName}: bản tin đã xuất bản phải có publishedAt hợp lệ (đang là “${row.publishedAt}”).` };
  const archived = normalizeDate(row.archivedAt);
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
    warnings: [
      author.unmapped ? `${rowName}: tác giả “${row.authorId}” không có trong danh sách user đã map.` : null,
      published.invalid ? `${rowName}: bỏ publishedAt “${row.publishedAt}” vì giá trị không phải ngày hợp lệ.` : null,
    ].filter(Boolean),
  };
}


function main() {
  const args = process.argv.slice(2);
  const input = args.find((arg) => !arg.startsWith('--'));
  const write = args.includes('--write') || args.includes('--apply');
  const apply = args.includes('--apply');
  const skipList = args.find((arg) => arg.startsWith('--skip-ids='))?.slice('--skip-ids='.length) || '';
  const skipIds = new Set(skipList.split(',').map((id) => id.trim()).filter(Boolean));
  if (!input) {
    console.error('Cách dùng: node scripts/excel-to-json.cjs <file.xlsx> [--write] [--apply] [--skip-ids=id1,id2]');
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
  const shared = parseSharedStrings(read('xl/sharedStrings.xml'));
  const sheetFileByIndex = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const workbook = read('xl/workbook.xml');
  const sheetNames = [...workbook.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((match) => match[1]);
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const exported = {};
  let hasError = false;

  for (const sheet of SHEETS) {
    const position = sheetNames.indexOf(sheet);
    if (position < 0) { console.error(`✗ Không tìm thấy sheet “${sheet}”.`); hasError = true; continue; }
    const rows = parseSheet(read(sheetFileByIndex[position]), shared);
    const valid = [];
    const seenIds = new Set();
    const existingIds = new Set((seed[sheet] || []).map((record) => record.id));
    let skipped = 0;
    console.log(`\n=== Sheet ${sheet}: ${rows.length} dòng dữ liệu ===`);
    rows.forEach((row, index) => {
      const id = String(row.id ?? '').trim();
      if (skipIds.has(id)) { skipped += 1; console.log(`- BỎ (chọn không dùng): ${id || `dòng ${index + 2}`}`); return; }
      if (!id) { hasError = true; console.error(`- LỖI: dòng ${index + 2} thiếu ID.`); return; }
      if (seenIds.has(id)) { hasError = true; console.error(`- LỖI: ID “${id}” trùng trong sheet.`); return; }
      const result = convertRow(sheet, row, index);
      if (result.error) { hasError = true; console.error(`- LỖI: ${result.error}`); return; }
      if (existingIds.has(id)) { skipped += 1; console.log(`- BỎ (đã tồn tại trong seed): ${id}`); seenIds.add(id); return; }
      seenIds.add(id);
      valid.push(result.record);
      result.warnings.forEach((warning) => console.log(`  ⚠ ${warning}`));
    });
    console.log(`→ Hợp lệ: ${valid.length} · Bỏ qua: ${skipped}`);
    exported[sheet] = valid;
  }

  if (!write) {
    console.log('\nChưa ghi file. Chạy lại với --write để xuất JSON hoặc --apply để xuất và nhập vào seed.json.');
    if (hasError) { console.error('Có dòng không hợp lệ ở trên; sửa Excel rồi chạy lại.'); process.exitCode = 1; }
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const sheet of SHEETS) {
    if (!exported[sheet]) continue;
    const file = path.join(OUT_DIR, OUTPUT_NAMES[sheet]);
    fs.writeFileSync(file, `${JSON.stringify(exported[sheet], null, 2)}\n`, 'utf8');
    console.log(`✓ Đã ghi ${path.relative(root, file)} (${exported[sheet].length} bản ghi).`);
  }
  if (apply) {
    for (const sheet of SHEETS) {
      for (const record of exported[sheet] || []) {
        if ((seed[sheet] || []).some((item) => item.id === record.id)) continue;
        seed[sheet] = seed[sheet] || [];
        seed[sheet].push(record);
        console.log(`✓ Nhập vào seed.${sheet}: ${record.id}`);
      }
    }
    fs.writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
    console.log(`✓ Đã ghi ${path.relative(root, SEED_PATH)} (chỉ thêm bản ghi mới, không xóa bản ghi cũ).`);
  }
  if (hasError) {
    console.error('\nCó dòng không hợp lệ ở trên. Sửa Excel rồi chạy lại; các dòng lỗi chưa được nhập.');
    process.exitCode = 1;
  }
}

main();

