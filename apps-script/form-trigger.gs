/**
 * SENA CARE — Google Form → Complaints (real-time trigger)
 *
 * ทำงานทันทีทุกครั้งที่มีคนตอบ Google Form ไม่ต้องกด sync ในเว็บ ไม่ต้องมี scheduler ภายนอก
 *
 * วิธีติดตั้ง:
 * 1. ผูก Google Form เข้ากับ Spreadsheet เดียวกับที่ใช้เป็นฐานข้อมูลหลัก (Complaints)
 *    - เปิด Form > Responses > ไอคอน Sheets สีเขียว > "Select existing spreadsheet" > เลือกไฟล์ฐานข้อมูลหลัก
 *    - จะได้แท็บคำตอบใหม่ (ปกติชื่อ "Form Responses 1") เพิ่มเข้ามาในไฟล์เดียวกับแท็บ "Complaints"
 * 2. เปิด Spreadsheet ไฟล์นั้น (ไม่ใช่เปิดจาก Form) > เมนู Extensions > Apps Script
 * 3. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้แทน
 * 4. แก้ค่า COMPLAINTS_SPREADSHEET_ID ด้านล่าง — ถ้า Form กับฐานข้อมูลอยู่ไฟล์เดียวกัน (แนะนำ) ปล่อยว่างไว้ได้เลย
 * 5. เลือกฟังก์ชัน setupTrigger จาก dropdown ด้านบน (ข้าง Run/Debug) แล้วกด Run หนึ่งครั้ง
 *    - จะมี popup ขอสิทธิ์เข้าถึง Spreadsheet — กด Allow
 * 6. เสร็จแล้ว ลองตอบฟอร์มทดสอบ 1 ครั้ง แล้วเปิดแท็บ "Complaints" ดูว่ามีแถวใหม่ขึ้นมาไหม
 *
 * หมายเหตุ: ไม่ต้องตั้งค่าอะไรในเว็บแอปเพิ่ม เพราะสคริปต์นี้เขียนลงชีตเดียวกับที่เว็บแอปอ่านอยู่แล้ว
 * โครงสร้างคอลัมน์ (HEADERS) ต้องตรงกับ lib/googleSheets.js ในโปรเจกต์เว็บแอปเป๊ะ ๆ ห้ามแก้ลำดับ
 */

const COMPLAINTS_SPREADSHEET_ID = ''; // ปล่อยว่าง = ใช้ spreadsheet ไฟล์เดียวกับที่สคริปต์นี้ผูกอยู่
const COMPLAINTS_SHEET_NAME = 'Complaints';

const HEADERS = [
  'id', 'category', 'description', 'department', 'boxLocation', 'complaintChannel', 'kind', 'anonymous',
  'contactName', 'contactChannel', 'contactInfo', 'severity', 'severityScale', 'severityLevel',
  'fiscalYear', 'month', 'resolved', 'note', 'createdAt', 'updatedAt',
  'status', 'statusLog', 'satisfaction', 'rca', 'source',
];

const CATEGORIES = [
  'ระบบบริการ-การรักษา',
  'สถานที่สิ่งแวดล้อมความปลอดภัย&สิ่งอำนวยความสะดวก',
  'พฤติกรรมบริการ',
  'สิทธิผู้ป่วย',
  'การสื่อสาร-การให้ข้อมูล',
];
const DEPARTMENT_FALLBACK = 'อื่นๆ';
const RED_KEYWORDS = [
  'เสียชีวิต', 'เสี่ยงชีวิต', 'ละเมิดสิทธิ', 'ทำร้ายร่างกาย', 'ล่วงละเมิด',
  'ฟ้องร้อง', 'อันตรายถึงชีวิต', 'วินิจฉัยผิด', 'ผ่าตัดผิด', 'ให้ยาผิด', 'รุนแรง',
];

// จับคู่หัวคอลัมน์ของฟอร์มกับฟิลด์ของระบบแบบอัตโนมัติ — แก้ pattern ตรงนี้ได้ถ้าตั้งคำถามด้วยคำอื่น
const HEADER_PATTERNS = {
  category: [/หมวด/, /ประเภท.*เรื่อง/, /ประเภท.*ปัญหา/],
  department: [/หน่วยงาน/],
  description: [/รายละเอียด/],
  contactName: [/ชื่อผู้แจ้ง/, /^ชื่อ/],
  contactChannel: [/ติดต่อกลับ/, /ช่องทาง.*สะดวก/],
  contactInfo: [/เบอร์/, /LINE/i, /โทร/],
};

function setupTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onFormSubmit_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onFormSubmit_').forSpreadsheet(ss).onFormSubmit().create();
  Logger.log('ตั้ง trigger สำเร็จ — ลองตอบฟอร์มทดสอบได้เลย');
}

function getComplaintsSheet_() {
  var ss = COMPLAINTS_SPREADSHEET_ID
    ? SpreadsheetApp.openById(COMPLAINTS_SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(COMPLAINTS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(COMPLAINTS_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function toFiscal_(date) {
  var gYear = date.getFullYear();
  var bYear = gYear + 543;
  var m = date.getMonth();
  var fiscalYear = m >= 9 ? bYear + 1 : bYear;
  var monthLabels = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return { fiscalYear: fiscalYear, month: monthLabels[m] };
}

function genId_(sheet) {
  var now = new Date();
  var ymd = Utilities.formatDate(now, 'GMT+7', 'yyMMdd');
  var values = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).indexOf(ymd) !== -1) count++;
  }
  var seq = String(count + 1);
  while (seq.length < 3) seq = '0' + seq;
  return 'SENA-' + ymd + '-' + seq;
}

function objectToRow_(obj) {
  return HEADERS.map(function (h) {
    var v = obj[h];
    if (h === 'statusLog' || h === 'rca') return v ? JSON.stringify(v) : (h === 'statusLog' ? '[]' : '');
    if (v === undefined || v === null) return '';
    return v;
  });
}

function mapFormRow_(headers, values) {
  var mapped = {};
  headers.forEach(function (h, i) {
    var title = String(h || '');
    Object.keys(HEADER_PATTERNS).forEach(function (field) {
      if (mapped[field] !== undefined) return;
      var patterns = HEADER_PATTERNS[field];
      for (var p = 0; p < patterns.length; p++) {
        if (patterns[p].test(title)) { mapped[field] = values[i]; break; }
      }
    });
  });
  return mapped;
}

function onFormSubmit_(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var formSheet = e.range.getSheet();
    var headers = formSheet.getRange(1, 1, 1, formSheet.getLastColumn()).getValues()[0];
    var values = e.values;

    var mapped = mapFormRow_(headers, values);
    var description = String(mapped.description || '').trim();
    if (!description) return; // แถวไม่มีรายละเอียด ข้ามไป ไม่บันทึก

    var rawCategory = String(mapped.category || '');
    var category = CATEGORIES.filter(function (c) { return rawCategory.indexOf(c) !== -1; })[0] || rawCategory || CATEGORIES[0];
    var department = String(mapped.department || '').trim() || DEPARTMENT_FALLBACK;
    var contactName = String(mapped.contactName || '').trim();
    var contactChannel = String(mapped.contactChannel || '').trim();
    var contactInfo = String(mapped.contactInfo || '').trim();

    var now = new Date();
    var fiscal = toFiscal_(now);
    var isRed = RED_KEYWORDS.some(function (k) { return description.indexOf(k) !== -1; });
    var level = isRed ? '4' : '2';
    var severity = isRed ? 'red' : 'yellow';
    var nowIso = now.toISOString();

    var sheet = getComplaintsSheet_();
    var id = genId_(sheet);

    var record = {
      id: id, category: category, description: description, department: department,
      boxLocation: '', complaintChannel: 'Google Form', kind: 'complaint',
      anonymous: !contactName,
      contactName: contactName, contactChannel: contactChannel, contactInfo: contactInfo,
      severity: severity, severityScale: 'general', severityLevel: level,
      fiscalYear: fiscal.fiscalYear, month: fiscal.month,
      resolved: null, note: '',
      createdAt: nowIso, updatedAt: nowIso,
      status: 'received',
      statusLog: [{ status: 'received', at: nowIso, note: 'บันทึกอัตโนมัติทันทีที่ส่งฟอร์ม' }],
      satisfaction: null, rca: null, source: 'google-form',
    };

    sheet.appendRow(objectToRow_(record));
  } finally {
    lock.releaseLock();
  }
}
