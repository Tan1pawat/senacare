import { google } from "googleapis";

const HEADERS = [
  "id", "category", "description", "department", "boxLocation", "complaintChannel", "kind", "anonymous",
  "contactName", "contactChannel", "contactInfo", "severity", "severityScale", "severityLevel",
  "fiscalYear", "month", "resolved", "note", "createdAt", "updatedAt",
  "status", "statusLog", "satisfaction", "rca", "source",
];
const JSON_FIELDS = ["statusLog", "rca"];
const BOOL_FIELDS = ["anonymous"];
const NUMBER_FIELDS = ["fiscalYear", "satisfaction"];

const SHEET_TAB = process.env.GOOGLE_SHEET_TAB_NAME || "Complaints";
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

function assertEnv() {
  const missing = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!process.env.GOOGLE_PRIVATE_KEY) missing.push("GOOGLE_PRIVATE_KEY");
  if (!SPREADSHEET_ID) missing.push("GOOGLE_SHEET_ID");
  if (missing.length) {
    throw new Error(`ยังไม่ได้ตั้งค่า environment variable: ${missing.join(", ")}`);
  }
}

let cachedClient = null;

export async function getSheetsClient() {
  assertEnv();
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const auth = new google.auth.JWT(email, null, key, ["https://www.googleapis.com/auth/spreadsheets"]);
  await auth.authorize();
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

async function ensureHeaders(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A1:Y1`,
  }).catch(async (err) => {
    if (String(err.message || "").includes("Unable to parse range")) {
      // tab doesn't exist yet — create it
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] },
      });
      return { data: { values: [] } };
    }
    throw err;
  });
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }
}

function rowToObject(row) {
  const obj = {};
  HEADERS.forEach((h, i) => {
    let v = row[i] ?? "";
    if (JSON_FIELDS.includes(h)) {
      try {
        v = v ? JSON.parse(v) : (h === "statusLog" ? [] : null);
      } catch {
        v = h === "statusLog" ? [] : null;
      }
    } else if (BOOL_FIELDS.includes(h)) {
      v = v === true || v === "TRUE" || v === "true";
    } else if (NUMBER_FIELDS.includes(h)) {
      v = v === "" ? null : Number(v);
    }
    obj[h] = v;
  });
  return obj;
}

function objectToRow(obj) {
  return HEADERS.map((h) => {
    let v = obj[h];
    if (JSON_FIELDS.includes(h)) return v ? JSON.stringify(v) : (h === "statusLog" ? "[]" : "");
    if (v === undefined || v === null) return "";
    return v;
  });
}

export async function listComplaints() {
  const sheets = await getSheetsClient();
  await ensureHeaders(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A2:Y`,
  });
  const rows = res.data.values || [];
  return rows.filter((r) => r[0]).map(rowToObject);
}

export async function createComplaint(record) {
  const sheets = await getSheetsClient();
  await ensureHeaders(sheets);
  record.updatedAt = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [objectToRow(record)] },
  });
  return record;
}

export async function bulkCreateComplaints(records) {
  if (!records || !records.length) return 0;
  const sheets = await getSheetsClient();
  await ensureHeaders(sheets);
  const now = new Date().toISOString();
  const rows = records.map((r) => {
    r.updatedAt = now;
    return objectToRow(r);
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
  return rows.length;
}

export async function updateComplaint(id, patch) {
  const sheets = await getSheetsClient();
  await ensureHeaders(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A2:Y`,
  });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => String(r[0]) === String(id));
  if (idx === -1) throw new Error(`ไม่พบเรื่องร้องเรียนที่มี id: ${id}`);
  const existing = rowToObject(rows[idx]);
  const merged = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  const rowNumber = idx + 2; // +1 for header row, +1 to convert to 1-indexed
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A${rowNumber}:Y${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [objectToRow(merged)] },
  });
  return merged;
}
