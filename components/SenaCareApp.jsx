import React, { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from "recharts";
import {
  QrCode, LayoutDashboard, ClipboardList, GitBranch, Search,
  CheckCircle2, Clock, AlertTriangle, Send, Star, Building2, ArrowRight,
  Bell, RefreshCw, ChevronDown, ChevronUp, Heart, Download, Upload, FileSpreadsheet
} from "lucide-react";
import Papa from "papaparse";

const SEV = {
  red: { label: "รุนแรงสูง", color: "#B23A2E", bg: "#FBE7E3", ring: "#E0776A" },
  orange: { label: "รุนแรง", color: "#B25A1E", bg: "#FCEADC", ring: "#E3934C" },
  yellow: { label: "ปานกลาง", color: "#9A6B12", bg: "#FCF1DA", ring: "#E3AE4C" },
  green: { label: "ทั่วไป", color: "#2F7A52", bg: "#E4F3EA", ring: "#6DBF93" },
};

const STATUS_STEPS = [
  { key: "received", label: "รับเรื่อง" },
  { key: "in_progress", label: "กำลังดำเนินการ" },
  { key: "resolved", label: "แก้ไขแล้ว" },
  { key: "closed", label: "ปิดเรื่อง" },
];

const STATUS_MSG = {
  received: "ระบบได้รับเรื่องร้องเรียนของท่านแล้ว เจ้าหน้าที่จะดำเนินการภายใน 24 ชั่วโมง",
  in_progress: "เจ้าหน้าที่กำลังตรวจสอบและดำเนินการเรื่องของท่าน",
  resolved: "เรื่องร้องเรียนของท่านได้รับการแก้ไขแล้ว กรุณาตรวจสอบและให้คะแนนความพึงพอใจ",
  closed: "ปิดเรื่องเรียบร้อยแล้ว ขอบคุณที่แจ้งให้โรงพยาบาลทราบ",
};

const CATEGORIES = [
  "ระบบบริการ-การรักษา",
  "สถานที่สิ่งแวดล้อมความปลอดภัย&สิ่งอำนวยความสะดวก",
  "พฤติกรรมบริการ",
  "สิทธิผู้ป่วย",
  "การสื่อสาร-การให้ข้อมูล",
];

const MONTH_ORDER = ["ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."];

function toFiscal(date) {
  const gYear = date.getFullYear();
  const bYear = gYear + 543;
  const m = date.getMonth();
  const fiscalYear = m >= 9 ? bYear + 1 : bYear;
  const monthLabels = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return { fiscalYear, month: monthLabels[m] };
}

function fiscalMonthToDate(fiscalYear, monthLabel) {
  const idx = MONTH_ORDER.indexOf(monthLabel);
  const gregMonth = (9 + idx) % 12;
  const buddhistYear = fiscalYear + (idx <= 2 ? -1 : 0);
  const gregYear = buddhistYear - 543;
  return new Date(gregYear, gregMonth, 15);
}

// เกณฑ์การบริหารความเสี่ยงโรงพยาบาลเสนา ปี 2566 (Update 8 มี.ค. 66)
// scale "clinical" = ความรุนแรงทางคลินิก 9 ระดับ (A-I)
// scale "general"  = ความรุนแรงความเสี่ยงทั่วไป 5 ระดับ (1-5)
// reportDays / correctDays: 0 หมายถึง "ทันที"
const RISK_LEVELS = {
  clinical: [
    { code: "A", meaning: "เกิดที่นี่ — ยังไม่เกิดเหตุการณ์ เหตุการณ์ซึ่งมีโอกาสที่จะก่อให้เกิดอุบัติการณ์ความเสี่ยง", reportDays: 30, correctDays: 30, requiresRCA: false, band: "green", guidance: "หน่วยงานทบทวนเพื่อป้องกันการเกิดซ้ำ" },
    { code: "B", meaning: "เกิดที่ใกล้ — เกิดอุบัติการณ์ความเสี่ยง แต่ยังไม่ถึงผู้รับบริการ", reportDays: 30, correctDays: 30, requiresRCA: false, band: "green", guidance: "หน่วยงานทบทวนเพื่อป้องกันการเกิดซ้ำ" },
    { code: "C", meaning: "เกิดกับใคร — เกิดอุบัติการณ์ความเสี่ยงถึงผู้รับบริการ แต่ไม่เป็นอันตราย", reportDays: 15, correctDays: 15, requiresRCA: false, band: "yellow", guidance: "ทบทวนและปรับปรุงแนวทางปฏิบัติ" },
    { code: "D", meaning: "ให้ระวัง — เกิดอุบัติการณ์ความเสี่ยงถึงผู้รับบริการ ต้องเฝ้าระวังอาการไม่พึงประสงค์", reportDays: 15, correctDays: 15, requiresRCA: false, band: "yellow", guidance: "ทบทวนและปรับปรุงแนวทางปฏิบัติ" },
    { code: "E", meaning: "สิ่งรักษา — เกิดอุบัติการณ์ความเสี่ยงถึงผู้รับบริการ เป็นอันตรายรายและต้องให้การรักษา", reportDays: 3, correctDays: 3, requiresRCA: false, band: "orange", guidance: "ทบทวนโดยทีมเพื่อป้องกันการเกิดซ้ำ / จัดทำหรือปรับปรุงแนวทางปฏิบัติในหน่วยงาน" },
    { code: "F", meaning: "เยียวยานาน — เกิดอุบัติการณ์ความเสี่ยงถึงผู้รับบริการ ต้องรับไว้รักษาในโรงพยาบาลหรือนอนโรงพยาบาลนานขึ้น", reportDays: 3, correctDays: 3, requiresRCA: false, band: "orange", guidance: "ทบทวนโดยทีมเพื่อป้องกันการเกิดซ้ำ / จัดทำหรือปรับปรุงแนวทางปฏิบัติในหน่วยงาน" },
    { code: "G", meaning: "ตัดพิการ — เกิดอุบัติการณ์ความเสี่ยงถึงผู้รับบริการ ทำให้เป็นอันตรายถาวร", reportDays: 3, correctDays: 0, requiresRCA: true, band: "red", guidance: "Root cause analysis (RCA) กำหนดเป็นมาตรฐานปฏิบัติในทีมที่เกี่ยวข้อง ป้องกันการเกิดซ้ำ เฝ้าระวัง" },
    { code: "H", meaning: "วางช่วยปั๊ม — เกิดอุบัติการณ์ความเสี่ยงถึงผู้รับบริการ ต้องให้การรักษาโดยการช่วยชีวิต", reportDays: 3, correctDays: 0, requiresRCA: true, band: "red", guidance: "Root cause analysis (RCA) กำหนดเป็นมาตรฐานปฏิบัติในทีมที่เกี่ยวข้อง ป้องกันการเกิดซ้ำ เฝ้าระวัง" },
    { code: "I", meaning: "จ่ายจอา — เกิดอุบัติการณ์ความเสี่ยงถึงผู้รับบริการ เป็นสาเหตุให้ผู้รับบริการเสียชีวิต", reportDays: 3, correctDays: 0, requiresRCA: true, band: "red", guidance: "Root cause analysis (RCA) กำหนดเป็นมาตรฐานปฏิบัติในทีมที่เกี่ยวข้อง ป้องกันการเกิดซ้ำ เฝ้าระวัง" },
  ],
  general: [
    { code: "1", meaning: "Near miss — อาจเกิดเหตุการณ์แล้วแต่ไม่ถึงคนหรือสิ่งของ", reportDays: 30, correctDays: 30, requiresRCA: false, band: "green", guidance: "จัดทำคู่มือทบทวนแนวทางปฏิบัติ สร้างความตื่นตัวเฝ้าระวัง" },
    { code: "2", meaning: "ไม่รุนแรง — เกิดเหตุการณ์แล้วมีผลกระทบต่อคน/สิ่งของ/กระบวนการทำงาน แต่ไม่รุนแรง มูลค่าความเสียหายน้อยกว่า 10,000 บาท", reportDays: 15, correctDays: 15, requiresRCA: false, band: "yellow", guidance: "จัดทำคู่มือทบทวนแนวทางปฏิบัติ สร้างความตื่นตัวเฝ้าระวัง" },
    { code: "3", meaning: "ปานกลาง — เกิดแล้วกระทบคน/สิ่งของ/กระบวนการทำงาน ต้องใช้ทีมเฉพาะแก้ไข ไม่มีการฟ้องร้อง มูลค่าความเสียหาย 10,000-100,000 บาท", reportDays: 7, correctDays: 7, requiresRCA: true, band: "orange", guidance: "RCA กำหนดเป็นมาตรฐานปฏิบัติในทีมที่เกี่ยวข้อง ป้องกันการเกิดซ้ำ เฝ้าระวังการเกิดซ้ำ" },
    { code: "4", meaning: "รุนแรง — มีผลกระทบต่อชื่อเสียง ความน่าเชื่อถือ แก้ไขไม่ได้ มูลค่าความเสียหาย มากกว่า 100,000-300,000 บาท", reportDays: 0, correctDays: 3, requiresRCA: true, band: "red", guidance: "RCA กำหนดเป็นมาตรฐานปฏิบัติในทีมที่เกี่ยวข้อง ป้องกันการเกิดซ้ำ เฝ้าระวังการเกิดซ้ำ" },
    { code: "5", meaning: "รุนแรงมาก — มีผลกระทบต่อชื่อเสียง ความน่าเชื่อถือ แก้ไขไม่ได้ เสียหายร้ายแรง เช่น ไฟไหม้ ฟ้องร้องทางกฎหมายหรือองค์กรวิชาชีพ มูลค่าความเสียหาย 300,000 บาทขึ้นไป", reportDays: 0, correctDays: 3, requiresRCA: true, band: "red", guidance: "RCA กำหนดเป็นมาตรฐานปฏิบัติในทีมที่เกี่ยวข้อง ป้องกันการเกิดซ้ำ เฝ้าระวังการเกิดซ้ำ" },
  ],
};

function getLevel(scale, code) {
  const list = RISK_LEVELS[scale] || RISK_LEVELS.general;
  return list.find((l) => l.code === code) || list[0];
}

function levelLabel(scale, code) {
  const scaleLabel = scale === "clinical" ? "คลินิก" : "ทั่วไป";
  return `${code} (${scaleLabel})`;
}

function dueInfo(createdAt, days) {
  const start = new Date(createdAt);
  const due = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  const now = new Date();
  const msLeft = due.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { due, overdue: daysLeft < 0, daysLeft };
}

const DEPARTMENTS = [
  "แผนกผู้ป่วยนอก (OPD)", "แผนกผู้ป่วยใน (IPD)", "ห้องฉุกเฉิน (ER)",
  "ห้องยา", "การเงิน", "ห้องปฏิบัติการ", "งานพยาบาล", "เวชระเบียน",
  "เวรเปล", "OR", "ห้องฟัน", "องค์กรแพทย์", "เวชกรรมฯ", "บริหาร", "อื่นๆ",
];
const DEPARTMENT_FALLBACK = "อื่นๆ";

const COMPLAINT_CHANNELS = [
  "ระบบออนไลน์ (SENA CARE)", "สแกน QR Code", "Facebook", "เพจประชาสัมพันธ์", "ประชาสัมพันธ์",
  "ตู้รับเรื่องร้องเรียน", "โทรศัพท์", "สนง.ประกันสังคม", "อื่นๆ",
];

function suggestCategory(text) {
  const t = text || "";
  if (/สิทธิ|ละเมิด/.test(t)) return "สิทธิผู้ป่วย";
  if (/สถานที่|แออัด|ความสะอาด|น้ำดื่ม|ที่จอดรถ|ห้องน้ำ|ตู้กด/.test(t)) return "สถานที่สิ่งแวดล้อมความปลอดภัย&สิ่งอำนวยความสะดวก";
  if (/พูดจา|ไม่สุภาพ|มารยาท|น้ำเสียง|ตวาด|อารมณ์|กิริยา/.test(t)) return "พฤติกรรมบริการ";
  if (/ไม่ชัดเจน|ให้ข้อมูล|สอบถาม|อธิบาย|แจ้ง/.test(t)) return "การสื่อสาร-การให้ข้อมูล";
  return "ระบบบริการ-การรักษา";
}

const RED_KEYWORDS = [
  "เสียชีวิต", "เสี่ยงชีวิต", "ละเมิดสิทธิ", "ทำร้ายร่างกาย", "ล่วงละเมิด",
  "ฟ้องร้อง", "อันตรายถึงชีวิต", "วินิจฉัยผิด", "ผ่าตัดผิด", "ให้ยาผิด", "รุนแรง",
];

const FISHBONE_CATS = [
  { key: "man", label: "คน (Man)" },
  { key: "process", label: "กระบวนการ (Process)" },
  { key: "machine", label: "เครื่องมือ/อุปกรณ์ (Machine)" },
  { key: "environment", label: "สภาพแวดล้อม (Environment)" },
  { key: "policy", label: "นโยบาย/ระบบ (Policy)" },
  { key: "communication", label: "การสื่อสาร (Communication)" },
];

function classify(category, description) {
  // แนะนำระดับเบื้องต้นตามเกณฑ์ความเสี่ยงทั่วไป (1-5) เจ้าหน้าที่ปรับได้ภายหลัง
  const text = (description || "") + " " + (category || "");
  if (RED_KEYWORDS.some((k) => text.includes(k))) return { scale: "general", level: "4" };
  return { scale: "general", level: "2" };
}

function genId(existing) {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const todayCount = existing.filter((c) => c.id.includes(ymd)).length + 1;
  return `SENA-${ymd}-${String(todayCount).padStart(3, "0")}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const API_BASE = "/api/complaints";

async function apiList() {
  const res = await fetch(API_BASE, { method: "GET" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
  return json.data || [];
}
async function apiCreate(record) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", record }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
  return json.record;
}
async function apiBulkCreate(records) {
  if (!records.length) return 0;
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "bulkCreate", records }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "นำเข้าไม่สำเร็จ");
  return json.count || 0;
}
async function apiUpdate(id, patch) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "อัปเดตไม่สำเร็จ");
  return json.record;
}

export default function App() {
  const [tab, setTab] = useState("submit");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastTicket, setLastTicket] = useState(null);
  const [dbError, setDbError] = useState("");
  const [dbStatus, setDbStatus] = useState("checking"); // checking | connected | error

  async function refresh() {
    try {
      const list = await apiList();
      setComplaints(list);
      setDbStatus("connected");
      setDbError("");
    } catch (e) {
      setDbStatus("error");
      setDbError(e.message || "เชื่อมต่อฐานข้อมูลไม่สำเร็จ");
    }
  }

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, []);

  async function addComplaint(entry) {
    const id = genId(complaints);
    const now = new Date().toISOString();
    const { scale, level } = classify(entry.category, entry.description);
    const band = getLevel(scale, level).band;
    const { fiscalYear, month } = toFiscal(new Date(now));
    const record = {
      id, ...entry, severity: band, severityScale: scale, severityLevel: level, fiscalYear, month,
      boxLocation: entry.boxLocation || "", complaintChannel: entry.complaintChannel || COMPLAINT_CHANNELS[0], kind: "complaint",
      resolved: null, note: "", createdAt: now,
      status: "received",
      statusLog: [{ status: "received", at: now, note: STATUS_MSG.received }],
      satisfaction: null, rca: null, source: "live",
    };
    const saved = await apiCreate(record);
    setComplaints((prev) => [saved || record, ...prev]);
    setLastTicket(id);
    return id;
  }

  async function importLegacy(records) {
    const newOnes = records.filter((r) => !complaints.some((c) => c.id === r.id));
    if (!newOnes.length) return;
    await apiBulkCreate(newOnes);
    await refresh();
  }

  async function setResolved(id, resolved) {
    await apiUpdate(id, { resolved });
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, resolved } : c)));
  }

  async function setDepartment(id, department) {
    await apiUpdate(id, { department });
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, department } : c)));
  }

  async function updateField(id, patch) {
    await apiUpdate(id, patch);
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function setSeverityLevel(id, scale, level) {
    const band = getLevel(scale, level).band;
    await apiUpdate(id, { severityScale: scale, severityLevel: level, severity: band });
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, severityScale: scale, severityLevel: level, severity: band } : c)));
  }

  async function updateStatus(id, status, note) {
    const now = new Date().toISOString();
    const current = complaints.find((c) => c.id === id);
    const statusLog = [...(current?.statusLog || []), { status, at: now, note: note || STATUS_MSG[status] }];
    await apiUpdate(id, { status, statusLog });
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status, statusLog } : c)));
  }

  async function setSatisfaction(id, score) {
    await apiUpdate(id, { satisfaction: score });
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, satisfaction: score } : c)));
  }

  async function saveRCA(id, rca) {
    await apiUpdate(id, { rca });
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, rca } : c)));
  }

  const font = "'Sarabun', 'Noto Sans Thai', 'IBM Plex Sans Thai', system-ui, sans-serif";
  const needsSetup = dbStatus === "error";

  return (
    <div style={{ fontFamily: font, background: "var(--paper)", minHeight: "100vh", color: "var(--ink)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        :root {
          --paper: #F2F6F4;
          --ink: #12283A;
          --ink-soft: #4B6072;
          --teal: #0E7C7B;
          --teal-dark: #085B5A;
          --card: #FFFFFF;
          --line: #DCE6E2;
          --pulse: #17B8A6;
        }
        * { box-sizing: border-box; }
        input, select, textarea {
          font-family: inherit; font-size: 14px; padding: 10px 12px;
          border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--ink);
          width: 100%; outline: none;
        }
        input:focus, select:focus, textarea:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(14,124,123,0.12); }
        label { font-size: 13px; font-weight: 600; color: var(--ink-soft); display:block; margin-bottom: 6px; }
        button.primary {
          background: var(--teal); color: #fff; border: none; border-radius: 8px;
          padding: 12px 20px; font-weight: 600; font-size: 14px; cursor: pointer; font-family: inherit;
        }
        button.primary:hover { background: var(--teal-dark); }
        button.ghost {
          background: transparent; color: var(--teal); border: 1px solid var(--teal); border-radius: 8px;
          padding: 10px 16px; font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit;
        }
        button.ghost:hover { background: rgba(14,124,123,0.08); }
        @keyframes pulseMove { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -240; } }
      `}</style>

      <Header tab={tab} setTab={setTab} count={complaints.length} dbStatus={dbStatus} />

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--ink-soft)" }}>กำลังโหลดข้อมูล...</div>
        ) : needsSetup ? (
          <DatabaseSetupPrompt error={dbError} onRetry={refresh} />
        ) : (
          <>
            {tab === "submit" && <SubmitView onSubmit={addComplaint} lastTicket={lastTicket} />}
            {tab === "track" && <TrackView complaints={complaints} onSatisfaction={setSatisfaction} />}
            {tab === "dashboard" && <DashboardView complaints={complaints} onUpdateStatus={updateStatus} onSetResolved={setResolved} onSetSeverityLevel={setSeverityLevel} onSetDepartment={setDepartment} onUpdateField={updateField} />}
            {tab === "report" && <ReportView complaints={complaints} />}
            {tab === "rca" && <RCAView complaints={complaints} onSaveRCA={saveRCA} />}
            {tab === "import" && <ImportView onImport={importLegacy} existingCount={complaints.length} />}
          </>
        )}
      </div>
    </div>
  );
}

function DatabaseSetupPrompt({ error, onRetry }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 40, textAlign: "center", maxWidth: 560, margin: "40px auto" }}>
      <AlertTriangle size={36} color="#E0A72E" style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>เชื่อมต่อ Google Sheet ไม่สำเร็จ</div>
      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16, lineHeight: 1.6, textAlign: "left" }}>
        ตรวจสอบสิ่งต่อไปนี้บนเซิร์ฟเวอร์ (ไม่ใช่ในหน้านี้ — credentials ถูกตั้งค่าฝั่ง server เท่านั้น):
        <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>ตั้งค่า environment variables <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, <code>GOOGLE_PRIVATE_KEY</code>, <code>GOOGLE_SHEET_ID</code> ครบหรือยัง</li>
          <li>แชร์ Google Sheet ให้อีเมลของ Service Account เป็น Editor แล้วหรือยัง</li>
          <li>เปิดใช้งาน Google Sheets API ใน Google Cloud Project แล้วหรือยัง</li>
        </ul>
      </div>
      {error && <div style={{ background: "#FBE7E3", color: "#B23A2E", padding: 12, borderRadius: 8, fontSize: 12.5, marginBottom: 16, textAlign: "left" }}>{error}</div>}
      <button className="primary" onClick={onRetry}>ลองเชื่อมต่อใหม่</button>
    </div>
  );
}

function Header({ tab, setTab, count, dbStatus }) {
  const tabs = [
    { key: "submit", label: "แจ้งเรื่อง", icon: QrCode },
    { key: "track", label: "ติดตามเรื่อง", icon: Search },
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "report", label: "รายงานประจำปี", icon: ClipboardList },
    { key: "rca", label: "RCA", icon: GitBranch },
    { key: "import", label: "นำเข้าเรื่องเดิม", icon: RefreshCw },
  ];
  return (
    <div style={{ background: "var(--card)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "18px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <img
            src="/images/sena-logo.jpg"
            alt="โรงพยาบาลเสนา"
            style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)", background: "#fff" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>SENA CARE</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>ระบบบริหารจัดการคุ้มครองสิทธิและรับเรื่องร้องเรียนอัจฉริยะ · โรงพยาบาลเสนา</div>
          </div>
          <ConnectionDot status={dbStatus} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
                  background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 14, fontWeight: 600, color: active ? "var(--teal)" : "var(--ink-soft)",
                  borderBottom: active ? "2.5px solid var(--teal)" : "2.5px solid transparent",
                }}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ConnectionDot({ status }) {
  const map = {
    connected: { color: "#2F7A52", bg: "#E4F3EA", label: "เชื่อมต่อ Sheet แล้ว" },
    checking: { color: "#9A6B12", bg: "#FCF1DA", label: "กำลังเชื่อมต่อ..." },
    disconnected: { color: "#9A6B12", bg: "#FCF1DA", label: "ยังไม่ได้เชื่อมต่อ" },
    error: { color: "#B23A2E", bg: "#FBE7E3", label: "เชื่อมต่อไม่สำเร็จ" },
  };
  const s = map[status] || map.checking;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: s.bg, padding: "5px 10px", borderRadius: 20, flexShrink: 0 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
    </div>
  );
}

function SubmitView({ onSubmit, lastTicket }) {
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    description: "",
    department: "",
    complaintChannel: COMPLAINT_CHANNELS[0],
    anonymous: false,
    contactName: "",
    contactChannel: "LINE",
    contactInfo: "",
  });
  const [submittedId, setSubmittedId] = useState(null);
  const [preview, setPreview] = useState({ scale: "general", level: "2" });

  useEffect(() => {
    setPreview(classify(form.category, form.description));
  }, [form.category, form.description]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    const id = await onSubmit({ ...form, department: form.department || DEPARTMENT_FALLBACK });
    setSubmittedId(id);
    setForm({ category: CATEGORIES[0], description: "", department: "", complaintChannel: COMPLAINT_CHANNELS[0], anonymous: false, contactName: "", contactChannel: "LINE", contactInfo: "" });
  }

  if (submittedId) {
    return (
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 40, textAlign: "center", maxWidth: 520, margin: "40px auto" }}>
        <CheckCircle2 size={48} color="var(--teal)" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>ส่งเรื่องเรียบร้อยแล้ว</div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>กรุณาเก็บหมายเลขนี้ไว้เพื่อติดตามสถานะ</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 600, color: "var(--teal-dark)", background: "#EAF5F3", padding: "12px 20px", borderRadius: 8, display: "inline-block", letterSpacing: 1 }}>
          {submittedId}
        </div>
        <div style={{ marginTop: 24 }}>
          <button className="primary" onClick={() => setSubmittedId(null)}>แจ้งเรื่องใหม่</button>
        </div>
      </div>
    );
  }

  const previewLevel = getLevel(preview.scale, preview.level);
  const sev = SEV[previewLevel.band];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24 }}>
      <form onSubmit={handleSubmit} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>แจ้งเรื่องร้องเรียน / ข้อเสนอแนะ</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 20 }}>ทุกช่องทาง — สแกน QR, ร้องเรียน, เสนอแนะ, ชื่นชม หรือแจ้งเหตุละเมิดสิทธิ รวมมาที่จุดเดียว</div>

        <div style={{ marginBottom: 16 }}>
          <label>ประเภทเรื่อง</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c, i) => <option key={c} value={c}>{i + 1}. {c}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>หน่วยงานที่เกี่ยวข้อง (พิมพ์เองได้ถ้าไม่อยู่ในรายการ)</label>
          <input list="submit-dept-suggestions" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder={DEPARTMENT_FALLBACK} />
          <datalist id="submit-dept-suggestions">
            {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>ช่องทางร้องเรียน</label>
          <select value={form.complaintChannel} onChange={(e) => set("complaintChannel", e.target.value)}>
            {COMPLAINT_CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>รายละเอียด</label>
          <textarea rows={5} placeholder="อธิบายเหตุการณ์ที่เกิดขึ้น..." value={form.description} onChange={(e) => set("description", e.target.value)} required />
        </div>

        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={form.anonymous} onChange={(e) => set("anonymous", e.target.checked)} id="anon" />
          <label htmlFor="anon" style={{ margin: 0, fontWeight: 500, color: "var(--ink)" }}>ไม่ประสงค์ออกนาม</label>
        </div>

        {!form.anonymous && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div>
              <label>ชื่อผู้แจ้ง</label>
              <input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="ไม่บังคับ" />
            </div>
            <div>
              <label>ช่องทางแจ้งเตือน</label>
              <select value={form.contactChannel} onChange={(e) => set("contactChannel", e.target.value)}>
                <option value="LINE">LINE</option>
                <option value="SMS">SMS</option>
                <option value="โทรศัพท์">โทรศัพท์</option>
              </select>
            </div>
            <div>
              <label>เบอร์ / LINE ID</label>
              <input value={form.contactInfo} onChange={(e) => set("contactInfo", e.target.value)} placeholder="สำหรับติดตามผล" />
            </div>
          </div>
        )}

        <button type="submit" className="primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Send size={15} /> ส่งเรื่อง
        </button>
      </form>

      <div>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Smart Screening</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: sev.bg, borderRadius: 8, border: `1px solid ${sev.ring}` }}>
            <AlertTriangle size={18} color={sev.color} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: sev.color }}>ระดับ {preview.level} · {sev.label}</div>
              <div style={{ fontSize: 11.5, color: sev.color }}>ประเมินอัตโนมัติตามเกณฑ์ความเสี่ยงทั่วไป (1-5) — เจ้าหน้าที่ปรับละเอียดเป็นระดับคลินิก A-I ได้ที่ Dashboard</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 12, lineHeight: 1.6 }}>
            🔴 4-5 รุนแรง/รุนแรงมาก — ต้องทำ RCA แจ้งผู้บริหารทันที<br />
            🟠 3 ปานกลาง — ต้องทำ RCA ใช้ทีมเฉพาะแก้ไข<br />
            🟡 2 ไม่รุนแรง — ทบทวนแนวทางปฏิบัติ<br />
            🟢 1 Near miss — เฝ้าระวัง
          </div>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>ช่องทางแจ้งเรื่อง</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/images/sena-qrcode.png"
              alt="QR Code สำหรับแจ้งเรื่อง SENA CARE"
              style={{ width: 100, height: 100, borderRadius: 8, border: "1px solid var(--line)", flexShrink: 0, objectFit: "contain", background: "#fff" }}
            />
            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              ผู้รับบริการสแกน QR Code ที่จุดบริการเพื่อเข้าสู่หน้านี้โดยตรง ไม่ต้องติดตั้งแอปเพิ่มเติม
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackView({ complaints, onSatisfaction }) {
  const [query, setQuery] = useState("");
  const found = complaints.find((c) => c.id.toLowerCase() === query.trim().toLowerCase());

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <input placeholder="กรอกหมายเลขเรื่อง เช่น SENA-260701-001" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="primary" style={{ flexShrink: 0 }}>ค้นหา</button>
      </div>

      {query.trim() && !found && (
        <div style={{ textAlign: "center", color: "var(--ink-soft)", padding: 40 }}>ไม่พบหมายเลขเรื่องนี้ กรุณาตรวจสอบอีกครั้ง</div>
      )}

      {found && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 600 }}>{found.id}</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>{found.category} · {found.department}</div>
            </div>
            <SevBadge sev={found.severity} />
          </div>

          <div style={{ fontSize: 13.5, color: "var(--ink)", background: "#F7F9F8", padding: 12, borderRadius: 8, marginBottom: 20 }}>{found.description}</div>

          <Timeline current={found.status} log={found.statusLog} />

          {found.status === "closed" && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
              {found.satisfaction ? (
                <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>ขอบคุณสำหรับการให้คะแนน: {"★".repeat(found.satisfaction)}{"☆".repeat(5 - found.satisfaction)}</div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>ให้คะแนนความพึงพอใจ</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} className="ghost" onClick={() => onSatisfaction(found.id, n)} style={{ padding: "8px 12px" }}>
                        <Star size={16} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Timeline({ current, log }) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === current);
  return (
    <div>
      {STATUS_STEPS.map((s, i) => {
        const done = i <= idx;
        const entry = log.find((l) => l.status === s.key);
        return (
          <div key={s.key} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: done ? "var(--teal)" : "#E4E9E7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {done && <CheckCircle2 size={14} color="#fff" />}
              </div>
              {i < STATUS_STEPS.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 28, background: i < idx ? "var(--teal)" : "#E4E9E7" }} />}
            </div>
            <div style={{ paddingBottom: 24 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: done ? "var(--ink)" : "var(--ink-soft)" }}>{s.label}</div>
              {entry && (
                <>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 2 }}>{fmtDate(entry.at)}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{entry.note}</div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SevBadge({ sev, code }) {
  const s = SEV[sev] || SEV.green;
  return (
    <div style={{ fontSize: 11.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.ring}`, borderRadius: 20, padding: "4px 12px", whiteSpace: "nowrap" }}>
      {code ? `${code} · ${s.label}` : s.label}
    </div>
  );
}

const PIE_COLORS = { red: "#D2685C", orange: "#E3934C", yellow: "#E3AE4C", green: "#6DBF93" };

function DashboardView({ complaints, onUpdateStatus, onSetResolved, onSetSeverityLevel, onSetDepartment, onUpdateField }) {
  const [expanded, setExpanded] = useState(null);

  const stats = useMemo(() => {
    const total = complaints.length;
    const closedItems = complaints.filter((c) => c.status === "closed" || c.status === "resolved");
    const closingDays = closedItems.map((c) => {
      const start = new Date(c.createdAt);
      const end = new Date(c.statusLog[c.statusLog.length - 1].at);
      return (end - start) / (1000 * 60 * 60 * 24);
    });
    const avgClose = closingDays.length ? (closingDays.reduce((a, b) => a + b, 0) / closingDays.length) : 0;

    const rated = complaints.filter((c) => c.satisfaction);
    const avgSat = rated.length ? rated.reduce((a, c) => a + c.satisfaction, 0) / rated.length : 0;

    const seen = new Set();
    let repeats = 0;
    complaints.slice().reverse().forEach((c) => {
      const key = c.department + "|" + c.category;
      if (seen.has(key)) repeats += 1;
      seen.add(key);
    });
    const repeatRate = total ? (repeats / total) * 100 : 0;

    const bySeverity = ["red", "orange", "yellow", "green"].map((k) => ({
      name: SEV[k].label, value: complaints.filter((c) => c.severity === k).length, key: k,
    }));

    const byDept = DEPARTMENTS.map((d) => ({
      name: d.split(" ")[0], full: d, count: complaints.filter((c) => c.department === d).length,
    })).filter((d) => d.count > 0);

    const byCategory = CATEGORIES.map((c, i) => ({
      name: `${i + 1}. ${c.length > 18 ? c.slice(0, 18) + "…" : c}`, full: c,
      count: complaints.filter((x) => x.category === c).length,
    })).filter((d) => d.count > 0);

    const resolvedCount = complaints.filter((c) => c.resolved === "ได้").length;
    const unresolvedCount = complaints.filter((c) => c.resolved === "ไม่ได้").length;

    const rcaCases = complaints.filter((c) => getLevel(c.severityScale || "general", c.severityLevel || "2").requiresRCA);
    const rcaPending = rcaCases.filter((c) => !c.rca).length;
    const rcaOverdue = rcaCases.filter((c) => {
      if (c.status === "closed") return false;
      const li = getLevel(c.severityScale || "general", c.severityLevel || "2");
      return dueInfo(c.createdAt, li.correctDays).overdue;
    }).length;

    const monthMap = {};
    complaints.forEach((c) => {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = (monthMap[key] || 0) + 1;
    });
    const monthly = Object.entries(monthMap).sort().map(([k, v]) => ({ month: k, count: v }));

    return { total, avgClose, avgSat, repeatRate, bySeverity, byDept, byCategory, monthly, resolvedCount, unresolvedCount, rcaPending, rcaOverdue };
  }, [complaints]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard label="เรื่องทั้งหมด" value={stats.total} suffix="เรื่อง" />
        <StatCard label="ระยะเวลาปิดเรื่องเฉลี่ย" value={stats.avgClose.toFixed(1)} suffix="วัน" target="≤ 15 วัน" />
        <StatCard label="ความพึงพอใจเฉลี่ย" value={stats.avgSat ? stats.avgSat.toFixed(1) : "-"} suffix="/ 5" target="≥ 95%" />
        <StatCard label="เรื่องร้องเรียนซ้ำ" value={stats.repeatRate.toFixed(0)} suffix="%" target="ลดลง ≥30%" />
        <StatCard label="แก้ไขได้ / ไม่ได้" value={stats.resolvedCount} suffix={`/ ${stats.unresolvedCount}`} />
        <StatCard label="ต้องทำ RCA (เกินกำหนด)" value={stats.rcaPending} suffix={`(${stats.rcaOverdue} เกินกำหนด)`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <ChartCard title="สัดส่วนระดับความรุนแรง">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.bySeverity} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {stats.bySeverity.map((entry) => <Cell key={entry.key} fill={PIE_COLORS[entry.key]} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="จำนวนเรื่องแยกตามประเภท (5 หมวดตามระบบเดิม)">
          {stats.byCategory.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.byCategory} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E9E7" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10.5 }} width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#0E7C7B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div style={{ marginBottom: 24 }}>
        <ChartCard title="จำนวนเรื่องแยกตามหน่วยงาน">
          {stats.byDept.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.byDept}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E9E7" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#17B8A6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="แนวโน้มรายเดือน" style={{ marginBottom: 24 }}>
        {stats.monthly.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E9E7" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0E7C7B" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", fontSize: 14, fontWeight: 700 }}>รายการเรื่องร้องเรียนล่าสุด</div>
        <datalist id="dept-suggestions">
          {Array.from(new Set([...DEPARTMENTS, ...complaints.map((c) => c.department).filter(Boolean)])).map((d) => <option key={d} value={d} />)}
        </datalist>
        <datalist id="channel-suggestions">
          {Array.from(new Set([...COMPLAINT_CHANNELS, ...complaints.map((c) => c.complaintChannel).filter(Boolean)])).map((ch) => <option key={ch} value={ch} />)}
        </datalist>
        {complaints.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>ยังไม่มีเรื่องร้องเรียนในระบบ</div>
        ) : (
          complaints.map((c) => (
            <ComplaintRow key={c.id} c={c} expanded={expanded === c.id} onToggle={() => setExpanded(expanded === c.id ? null : c.id)} onUpdateStatus={onUpdateStatus} onSetResolved={onSetResolved} onSetSeverityLevel={onSetSeverityLevel} onSetDepartment={onSetDepartment} onUpdateField={onUpdateField} />
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix, target }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 600, color: "var(--teal-dark)" }}>
        {value}<span style={{ fontSize: 13, color: "var(--ink-soft)", marginLeft: 4 }}>{suffix}</span>
      </div>
      {target && <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 4 }}>เป้าหมาย {target}</div>}
    </div>
  );
}

function ChartCard({ title, children, style }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 18, ...style }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", fontSize: 13 }}>ยังไม่มีข้อมูล</div>;
}

function ComplaintRow({ c, expanded, onToggle, onUpdateStatus, onSetResolved, onSetSeverityLevel, onSetDepartment, onUpdateField }) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === c.status);
  const nextStep = STATUS_STEPS[currentIdx + 1];
  const catIdx = CATEGORIES.indexOf(c.category);
  const scale = c.severityScale || "general";
  const level = c.severityLevel || "2";
  const levelInfo = getLevel(scale, level);
  const correctionDue = dueInfo(c.createdAt, levelInfo.correctDays);
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", cursor: "pointer" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: "var(--ink-soft)", width: 130, flexShrink: 0 }}>{c.id}</div>
        <SevBadge sev={c.severity} code={level} />
        {levelInfo.requiresRCA && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#B23A2E", border: "1px solid #E0776A", borderRadius: 20, padding: "3px 8px", flexShrink: 0 }}>ต้องทำ RCA</span>
        )}
        {c.kind === "compliment" && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#2F7A52", border: "1px solid #6DBF93", borderRadius: 20, padding: "3px 8px", flexShrink: 0 }}>คำชม</span>
        )}
        <div style={{ fontSize: 13, flex: 1, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {catIdx >= 0 ? `${catIdx + 1}. ` : ""}{c.category}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.department}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-soft)", width: 46, flexShrink: 0 }}>{c.month || "-"}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, width: 74, flexShrink: 0, color: c.resolved === "ได้" ? "#2F7A52" : c.resolved === "ไม่ได้" ? "#B23A2E" : "var(--ink-soft)" }}>
          {c.resolved || "ยังไม่ระบุ"}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-dark)", width: 100, flexShrink: 0 }}>{STATUS_STEPS[currentIdx]?.label}</div>
        {expanded ? <ChevronUp size={16} color="var(--ink-soft)" /> : <ChevronDown size={16} color="var(--ink-soft)" />}
      </div>
      {expanded && (
        <div style={{ padding: "0 20px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>รายละเอียด</div>
            <div style={{ fontSize: 13, background: "#F7F9F8", padding: 12, borderRadius: 8, marginBottom: 12 }}>{c.description}</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
              ผู้แจ้ง: {c.anonymous ? "ไม่ประสงค์ออกนาม" : (c.contactName || "-")} · {c.anonymous ? "" : `${c.contactChannel} ${c.contactInfo || ""}`}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 4 }}>ประเภทเรื่อง</div>
                <select value={c.category} onChange={(e) => onUpdateField(c.id, { category: e.target.value })}>
                  {CATEGORIES.map((cat, i) => <option key={cat} value={cat}>{i + 1}. {cat}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 4 }}>หน่วยงานที่เกิดปัญหา</div>
                <input list="dept-suggestions" value={c.department || ""} onChange={(e) => onSetDepartment(c.id, e.target.value)} placeholder={DEPARTMENT_FALLBACK} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 4 }}>หน่วยงานที่เปิดตู้/รับเรื่อง</div>
                <input value={c.boxLocation || ""} onChange={(e) => onUpdateField(c.id, { boxLocation: e.target.value })} placeholder="ไม่ระบุ" />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 4 }}>ช่องทางร้องเรียน</div>
                <input list="channel-suggestions" value={c.complaintChannel || ""} onChange={(e) => onUpdateField(c.id, { complaintChannel: e.target.value })} placeholder="ไม่ระบุ" />
              </div>
            </div>

            {c.source === "legacy-import" && (
              <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8 }}>
                นำเข้าจากรายงานเดิม · ปีงบประมาณ {c.fiscalYear} — ตรวจสอบและแก้ไขข้อมูลด้านบนได้ถ้าไม่ตรง
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>อัปเดตสถานะ</div>
            {nextStep ? (
              <button className="primary" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }} onClick={() => onUpdateStatus(c.id, nextStep.key)}>
                <ArrowRight size={14} /> เปลี่ยนเป็น "{nextStep.label}"
              </button>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 }}>ปิดเรื่องเรียบร้อยแล้ว</div>
            )}

            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 4 }}>มาตราส่วน</div>
                <select value={scale} onChange={(e) => onSetSeverityLevel(c.id, e.target.value, RISK_LEVELS[e.target.value][0].code)} style={{ width: 150 }}>
                  <option value="general">ความเสี่ยงทั่วไป (1-5)</option>
                  <option value="clinical">คลินิก (A-I)</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 4 }}>ระดับ</div>
                <select value={level} onChange={(e) => onSetSeverityLevel(c.id, scale, e.target.value)} style={{ width: 100 }}>
                  {RISK_LEVELS[scale].map((l) => <option key={l.code} value={l.code}>{l.code}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 4 }}>การแก้ไข</div>
                <select value={c.resolved || ""} onChange={(e) => onSetResolved(c.id, e.target.value || null)} style={{ width: 110 }}>
                  <option value="">ยังไม่ระบุ</option>
                  <option value="ได้">ได้</option>
                  <option value="ไม่ได้">ไม่ได้</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--ink-soft)", background: "#F7F9F8", padding: 10, borderRadius: 8, marginBottom: 12, lineHeight: 1.6 }}>
              {levelInfo.meaning}
            </div>

            <div style={{ fontSize: 11.5, marginBottom: 8, color: correctionDue.overdue && c.status !== "closed" ? "#B23A2E" : "var(--ink-soft)", fontWeight: correctionDue.overdue && c.status !== "closed" ? 700 : 400 }}>
              กำหนดแก้ไขภายใน {levelInfo.correctDays === 0 ? "ทันที" : `${levelInfo.correctDays} วัน`}
              {c.status !== "closed" && (correctionDue.overdue ? ` — เลยกำหนดแล้ว ${Math.abs(correctionDue.daysLeft)} วัน` : ` — เหลือเวลา ${correctionDue.daysLeft} วัน`)}
            </div>

            <div style={{ fontSize: 11, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 4 }}>
              <Bell size={12} /> จะแจ้งเตือนผู้ร้องเรียนผ่าน {c.contactChannel || "ช่องทางที่ระบุ"} โดยอัตโนมัติ
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RCAView({ complaints, onSaveRCA }) {
  const rcaCases = complaints.filter((c) => getLevel(c.severityScale || "general", c.severityLevel || "2").requiresRCA);
  const [selected, setSelected] = useState(null);

  const current = complaints.find((c) => c.id === selected);

  if (!selected) {
    return (
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>RCA Generator</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 20, lineHeight: 1.6 }}>
          ตามเกณฑ์การบริหารความเสี่ยงโรงพยาบาลเสนา — ต้องทำ RCA เมื่อระดับความรุนแรงคลินิกเป็น G, H, I หรือระดับความเสี่ยงทั่วไปเป็น 3, 4, 5 เท่านั้น
        </div>
        {rcaCases.length === 0 ? (
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>
            ยังไม่มีเรื่องร้องเรียนที่เข้าเกณฑ์ต้องทำ RCA ในระบบ
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rcaCases.map((c) => {
              const levelInfo = getLevel(c.severityScale || "general", c.severityLevel || "2");
              const due = dueInfo(c.createdAt, levelInfo.correctDays);
              return (
                <div key={c.id} onClick={() => setSelected(c.id)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>{c.id}</div>
                      <SevBadge sev={c.severity} code={c.severityLevel} />
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.category} · {c.department}</div>
                    {c.status !== "closed" && (
                      <div style={{ fontSize: 11, marginTop: 4, color: due.overdue ? "#B23A2E" : "var(--ink-soft)", fontWeight: due.overdue ? 700 : 400 }}>
                        {due.overdue ? `เลยกำหนดแก้ไข ${Math.abs(due.daysLeft)} วัน` : `กำหนดแก้ไขอีก ${due.daysLeft} วัน`}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.rca ? "#2F7A52" : "var(--teal)", flexShrink: 0 }}>{c.rca ? "จัดทำแล้ว →" : "จัดทำ RCA →"}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return <RCAForm complaint={current} onBack={() => setSelected(null)} onSave={onSaveRCA} />;
}

function RCAForm({ complaint, onBack, onSave }) {
  const [fishbone, setFishbone] = useState(() => complaint.rca?.fishbone || Object.fromEntries(FISHBONE_CATS.map((f) => [f.key, ""])));
  const [whys, setWhys] = useState(() => complaint.rca?.whys || ["", "", "", "", ""]);
  const [corrective, setCorrective] = useState(complaint.rca?.corrective || "");
  const [preventive, setPreventive] = useState(complaint.rca?.preventive || "");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSave(complaint.id, { fishbone, whys, corrective, preventive, updatedAt: new Date().toISOString() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const levelInfo = getLevel(complaint.severityScale || "general", complaint.severityLevel || "2");
  const due = dueInfo(complaint.createdAt, levelInfo.correctDays);

  return (
    <div>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 16 }}>← กลับ</button>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 600 }}>{complaint.id}</div>
          <SevBadge sev={complaint.severity} code={complaint.severityLevel} />
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>{complaint.category} · {complaint.department}</div>
        <div style={{ fontSize: 13, marginTop: 10, background: "#F7F9F8", padding: 12, borderRadius: 8 }}>{complaint.description}</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.6 }}>
          <b style={{ color: "var(--ink)" }}>ความหมายตามเกณฑ์:</b> {levelInfo.meaning}<br />
          <b style={{ color: "var(--ink)" }}>แนวทางตามเกณฑ์:</b> {levelInfo.guidance}<br />
          <span style={{ color: complaint.status !== "closed" && due.overdue ? "#B23A2E" : "var(--ink-soft)", fontWeight: complaint.status !== "closed" && due.overdue ? 700 : 400 }}>
            กำหนดแก้ไขภายใน {levelInfo.correctDays === 0 ? "ทันที" : `${levelInfo.correctDays} วัน`}
            {complaint.status !== "closed" && (due.overdue ? ` — เลยกำหนดแล้ว ${Math.abs(due.daysLeft)} วัน` : ` — เหลือเวลา ${due.daysLeft} วัน`)}
          </span>
        </div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Fishbone Diagram</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 16 }}>ระบุสาเหตุที่เป็นไปได้ในแต่ละด้าน</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {FISHBONE_CATS.map((f) => (
            <div key={f.key}>
              <label>{f.label}</label>
              <textarea rows={2} value={fishbone[f.key]} onChange={(e) => setFishbone((s) => ({ ...s, [f.key]: e.target.value }))} placeholder="สาเหตุที่เกี่ยวข้อง..." />
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>5 Why Analysis</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 16 }}>ไล่เหตุผลทีละขั้นจนถึงสาเหตุรากเหง้า</div>
        <div style={{ display: "grid", gap: 10 }}>
          {whys.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#EAF5F3", color: "var(--teal-dark)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
              <input value={w} onChange={(e) => { const n = [...whys]; n[i] = e.target.value; setWhys(n); }} placeholder={`ทำไม...`} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 24, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label>Corrective Action (แก้ไข)</label>
          <textarea rows={3} value={corrective} onChange={(e) => setCorrective(e.target.value)} />
        </div>
        <div>
          <label>Preventive Action (ป้องกัน)</label>
          <textarea rows={3} value={preventive} onChange={(e) => setPreventive(e.target.value)} />
        </div>
      </div>

      <button className="primary" onClick={handleSave}>{saved ? "บันทึกแล้ว ✓" : "บันทึก RCA"}</button>
    </div>
  );
}

// ---------- Report: reproduces the original spreadsheet's pivot layout ----------

function buildMatrix(complaints, fiscalYear) {
  const inYear = complaints.filter((c) => c.fiscalYear === fiscalYear);
  const groups = CATEGORIES.map((cat) => {
    const items = {};
    inYear.filter((c) => c.category === cat).forEach((c) => {
      const key = c.description || "(ไม่ระบุรายละเอียด)";
      if (!items[key]) {
        items[key] = { item: key, months: Object.fromEntries(MONTH_ORDER.map((m) => [m, 0])), levels: [], resolved: { ได้: 0, ไม่ได้: 0 }, notes: [] };
      }
      items[key].months[c.month] = (items[key].months[c.month] || 0) + 1;
      items[key].levels.push(`${c.severityScale || "general"}:${c.severityLevel || "2"}`);
      if (c.resolved === "ได้") items[key].resolved.ได้ += 1;
      if (c.resolved === "ไม่ได้") items[key].resolved.ไม่ได้ += 1;
      if (c.note) items[key].notes.push(c.note);
    });
    return { category: cat, items: Object.values(items) };
  });
  const totalsByMonth = Object.fromEntries(MONTH_ORDER.map((m) => [m, inYear.filter((c) => c.month === m).length]));
  const grandTotal = inYear.length;
  return { groups, totalsByMonth, grandTotal };
}

function ReportView({ complaints }) {
  const years = useMemo(() => {
    const s = new Set(complaints.map((c) => c.fiscalYear).filter(Boolean));
    return Array.from(s).sort((a, b) => b - a);
  }, [complaints]);
  const [fiscalYear, setFiscalYear] = useState(years[0] || new Date().getFullYear() + 543);

  useEffect(() => {
    if (years.length && !years.includes(fiscalYear)) setFiscalYear(years[0]);
  }, [years]);

  const matrix = useMemo(() => buildMatrix(complaints, fiscalYear), [complaints, fiscalYear]);

  function exportCSV() {
    const header = ["ประเภทคำร้องเรียน", ...MONTH_ORDER, "รวม", "%", "ระดับความรุนแรง", "ได้", "ไม่ได้", "หมายเหตุ"];
    const rows = [header];
    matrix.groups.forEach((g, gi) => {
      rows.push([`${gi + 1}.${g.category}`, ...MONTH_ORDER.map(() => ""), "", "", "", "", "", ""]);
      g.items.forEach((it) => {
        const total = Object.values(it.months).reduce((a, b) => a + b, 0);
        const pct = matrix.grandTotal ? ((total / matrix.grandTotal) * 100).toFixed(1) : "0";
        const levelKey = it.levels.length ? mostCommon(it.levels) : null;
        const levelLabelText = levelKey ? (() => { const [sc, code] = levelKey.split(":"); return `${code} (${sc === "clinical" ? "คลินิก" : "ทั่วไป"})`; })() : "";
        rows.push([it.item, ...MONTH_ORDER.map((m) => it.months[m] || ""), total, pct, levelLabelText, it.resolved.ได้ || "", it.resolved.ไม่ได้ || "", it.notes.join("; ")]);
      });
    });
    rows.push(["รวม", ...MONTH_ORDER.map((m) => matrix.totalsByMonth[m]), matrix.grandTotal, "100", "", "", "", ""]);
    const csv = Papa.unparse(rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `คำร้องเรียน_ปีงบประมาณ_${fiscalYear}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>รายงานคำร้องเรียนประจำปี</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>รูปแบบตารางเดียวกับรายงานต้นฉบับ — แยกตามหมวด รายเดือน และสรุปรวม</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))} style={{ width: 160 }}>
            {years.length === 0 && <option>{fiscalYear}</option>}
            {years.map((y) => <option key={y} value={y}>ปีงบประมาณ {y}</option>)}
          </select>
          <button className="ghost" onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <Download size={14} /> ส่งออก CSV
          </button>
        </div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, overflow: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F7F9F8" }}>
              <th style={th}>ประเภทคำร้องเรียน</th>
              {MONTH_ORDER.map((m) => <th key={m} style={{ ...th, textAlign: "center", width: 40 }}>{m}</th>)}
              <th style={{ ...th, textAlign: "center" }}>รวม</th>
              <th style={{ ...th, textAlign: "center" }}>%</th>
              <th style={{ ...th, textAlign: "center" }}>ระดับ</th>
              <th style={{ ...th, textAlign: "center" }}>ได้</th>
              <th style={{ ...th, textAlign: "center" }}>ไม่ได้</th>
            </tr>
          </thead>
          <tbody>
            {matrix.groups.map((g, gi) => (
              <React.Fragment key={g.category}>
                <tr style={{ background: "#EAF5F3" }}>
                  <td colSpan={18} style={{ ...td, fontWeight: 700, color: "var(--teal-dark)" }}>{gi + 1}. {g.category}</td>
                </tr>
                {g.items.length === 0 && (
                  <tr><td style={{ ...td, color: "var(--ink-soft)", fontStyle: "italic" }} colSpan={18}>ยังไม่มีข้อมูลในหมวดนี้</td></tr>
                )}
                {g.items.map((it, ii) => {
                  const total = Object.values(it.months).reduce((a, b) => a + b, 0);
                  const pct = matrix.grandTotal ? ((total / matrix.grandTotal) * 100).toFixed(1) : "0.0";
                  const levelKey = it.levels.length ? mostCommon(it.levels) : null;
                  const levelParts = levelKey ? levelKey.split(":") : null;
                  const levelBadgeInfo = levelParts ? getLevel(levelParts[0], levelParts[1]) : null;
                  return (
                    <tr key={ii}>
                      <td style={td}>{it.item}</td>
                      {MONTH_ORDER.map((m) => <td key={m} style={{ ...td, textAlign: "center" }}>{it.months[m] || ""}</td>)}
                      <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>{total}</td>
                      <td style={{ ...td, textAlign: "center" }}>{pct}%</td>
                      <td style={{ ...td, textAlign: "center" }}>{levelBadgeInfo && <SevBadge sev={levelBadgeInfo.band} code={levelParts[1]} />}</td>
                      <td style={{ ...td, textAlign: "center" }}>{it.resolved.ได้ || ""}</td>
                      <td style={{ ...td, textAlign: "center" }}>{it.resolved.ไม่ได้ || ""}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            <tr style={{ background: "#F2F6F4", fontWeight: 700 }}>
              <td style={td}>รวม</td>
              {MONTH_ORDER.map((m) => <td key={m} style={{ ...td, textAlign: "center" }}>{matrix.totalsByMonth[m]}</td>)}
              <td style={{ ...td, textAlign: "center" }}>{matrix.grandTotal}</td>
              <td style={{ ...td, textAlign: "center" }}>100%</td>
              <td style={td}></td><td style={td}></td><td style={td}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "var(--ink-soft)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };
const td = { padding: "7px 10px", borderBottom: "1px solid var(--line)", color: "var(--ink)" };

function mostCommon(arr) {
  const count = {};
  arr.forEach((x) => { count[x] = (count[x] || 0) + 1; });
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}

// ---------- Import: parses the original monthly-tally spreadsheet format ----------

function parseLegacyCSV(text) {
  const parsed = Papa.parse(text, { skipEmptyLines: false });
  const rows = parsed.data;

  let fiscalYear = new Date().getFullYear() + 543;
  const yearMatch = rows.slice(0, 3).map((r) => r[0] || "").join(" ").match(/ปีงบประมาณ\s*(\d{4})/);
  if (yearMatch) fiscalYear = parseInt(yearMatch[1], 10);

  const headerIdx = rows.findIndex((r) => (r[0] || "").trim() === "ประเภทคำร้องเรียน");
  if (headerIdx === -1) throw new Error("ไม่พบหัวตารางที่ตรงกับรูปแบบรายงานเดิม (ประเภทคำร้องเรียน)");
  const monthRowIdx = headerIdx + 1;

  const records = [];
  let currentCategory = CATEGORIES[0];

  for (let i = monthRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const first = (row[0] || "").trim();
    if (!first) continue;
    if (first === "รวม") break;
    if (/^\d+\./.test(first)) {
      const label = first.replace(/^\d+\.\s*/, "");
      const match = CATEGORIES.find((c) => c === label) || CATEGORIES[Math.min(parseInt(first, 10) - 1, CATEGORIES.length - 1)] || label;
      currentCategory = match;
      continue;
    }
    const severityRaw = (row[15] || "").trim();
    const resolvedYes = (row[16] || "").trim();
    const resolvedNo = (row[17] || "").trim();
    const note = (row[18] || "").trim();

    let scale = "general";
    let level = null;
    if (/^[A-Ia-i]$/.test(severityRaw)) {
      scale = "clinical";
      level = severityRaw.toUpperCase();
    } else if (/^[1-5]$/.test(severityRaw)) {
      scale = "general";
      level = severityRaw;
    } else if (/แดง|สูง|รุนแรงมาก/.test(severityRaw)) {
      level = "4";
    } else if (/เหลือง|กลาง/.test(severityRaw)) {
      level = "2";
    } else if (/เขียว|ต่ำ|น้อย/.test(severityRaw)) {
      level = "1";
    } else {
      const guess = classify(currentCategory, first);
      scale = guess.scale;
      level = guess.level;
    }
    const band = getLevel(scale, level).band;
    const resolved = resolvedYes ? "ได้" : resolvedNo ? "ไม่ได้" : null;

    MONTH_ORDER.forEach((month, mi) => {
      const raw = (row[mi + 1] || "").trim();
      const count = parseInt(raw, 10);
      if (!count || count <= 0) return;
      for (let n = 0; n < count; n++) {
        const date = fiscalMonthToDate(fiscalYear, month);
        records.push({
          id: `LEGACY-${fiscalYear}-${records.length + 1}`,
          category: currentCategory,
          description: first,
          department: DEPARTMENT_FALLBACK,
          boxLocation: "", complaintChannel: "", kind: "complaint",
          anonymous: true,
          contactName: "", contactChannel: "", contactInfo: "",
          severity: band, severityScale: scale, severityLevel: level, fiscalYear, month, resolved, note,
          createdAt: date.toISOString(),
          status: "closed",
          statusLog: [{ status: "closed", at: date.toISOString(), note: "นำเข้าจากรายงานเดิม" }],
          satisfaction: null, rca: null, source: "legacy-import",
        });
      }
    });
  }
  return { records, fiscalYear };
}

// ---------- xlsx record-level parser: ร้องเรียน / คำชม sheets ----------
// เนื่องจากคอลัมน์รายละเอียดถูก merge และตัดคำข้ามหลายแถว ต้องจัดกลุ่มแถวก่อน:
// แถวที่มี ลำดับ หรือ วันที่ลงทะเบียน/วันที่ร้องเรียน จะเริ่มระเบียนใหม่ แถวอื่นถือเป็นส่วนต่อของรายละเอียด
// ไฟล์เดิมมักพิมพ์วันที่เป็นปี พ.ศ. ทำให้ Excel เก็บเป็นปี ค.ศ. 25xx ตรงๆ
// หรือพิมพ์ปี พ.ศ. แบบ 2 หลัก (เช่น "68") ที่ Excel ตีความเป็น ค.ศ. 19xx — ปรับกลับเป็น ค.ศ. จริงก่อนใช้งาน
function normalizeBuddhistYear(d) {
  const y = d.getFullYear();
  if (y >= 2400) d.setFullYear(y - 543);
  else if (y >= 1930 && y < 2000) d.setFullYear(y + 2500 - 1900 - 543);
  return d;
}

function excelDateToISO(v) {
  if (v instanceof Date) return normalizeBuddhistYear(new Date(v.getTime())).toISOString();
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return normalizeBuddhistYear(new Date(ms)).toISOString();
  }
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return normalizeBuddhistYear(d).toISOString();
  }
  return null;
}

function groupSheetRows(rows, dataStartIdx) {
  const groups = [];
  let cur = null;
  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i] || [];
    const seq = row[0];
    const reg = row[1];
    const cdate = row[2];
    const startsNew = (seq !== undefined && seq !== null && seq !== "") ||
      (reg !== undefined && reg !== null && reg !== "") ||
      (cdate !== undefined && cdate !== null && cdate !== "");
    if (startsNew) {
      if (cur) groups.push(cur);
      cur = { row, descLines: row[5] ? [String(row[5])] : [] };
    } else if (cur && row[5]) {
      cur.descLines.push(String(row[5]));
    }
  }
  if (cur) groups.push(cur);
  return groups;
}

function parseComplaintSheet(rows, fiscalYear) {
  // header: row0 title, row1 blank, row2/row3 = two-row header (ลำดับ, วันที่ x2, หน่วยงาน x2, รายละเอียด, ช่องทางร้องเรียน, ระดับ, การตอบกลับ)
  const headerIdx = rows.findIndex((r) => (r[0] || "").toString().trim() === "ลำดับ");
  const dataStartIdx = headerIdx === -1 ? 4 : headerIdx + 2;
  const groups = groupSheetRows(rows, dataStartIdx);
  const records = [];
  groups.forEach((g, gi) => {
    const row = g.row;
    const description = g.descLines.join(" ").trim();
    if (!description) return;
    const complaintDate = excelDateToISO(row[2]) || excelDateToISO(row[1]) || new Date().toISOString();
    const { fiscalYear: fy, month } = toFiscal(new Date(complaintDate));
    const category = suggestCategory(description);
    const severityRaw = (row[10] || "").toString().trim();
    let scale = "general", level = null;
    if (/^[A-Ia-i]$/.test(severityRaw)) { scale = "clinical"; level = severityRaw.toUpperCase(); }
    else { const g2 = classify(category, description); scale = g2.scale; level = g2.level; }
    const band = getLevel(scale, level).band;
    const note = (row[11] || "").toString().trim();
    records.push({
      id: `XLSX-C-${fy}-${gi + 1}-${Date.now().toString(36)}`,
      category, description,
      department: (row[4] || "").toString().trim() || DEPARTMENT_FALLBACK,
      boxLocation: (row[3] || "").toString().trim(),
      complaintChannel: (row[9] || "").toString().trim() || "อื่นๆ",
      kind: "complaint",
      anonymous: true,
      contactName: "", contactChannel: "", contactInfo: "",
      severity: band, severityScale: scale, severityLevel: level, fiscalYear: fy, month,
      resolved: note ? "ได้" : null, note,
      createdAt: complaintDate,
      status: note ? "closed" : "received",
      statusLog: [{ status: note ? "closed" : "received", at: complaintDate, note: note || "นำเข้าจากไฟล์ ร้องเรียน" }],
      satisfaction: null, rca: null, source: "legacy-import",
    });
  });
  return records;
}

function parseComplimentSheet(rows) {
  const headerIdx = rows.findIndex((r) => (r[0] || "").toString().trim() === "ลำดับ");
  const dataStartIdx = headerIdx === -1 ? 4 : headerIdx + 2;
  const groups = groupSheetRows(rows, dataStartIdx);
  const records = [];
  groups.forEach((g, gi) => {
    const row = g.row;
    const description = g.descLines.join(" ").trim();
    if (!description) return;
    const complaintDate = excelDateToISO(row[2]) || excelDateToISO(row[1]) || new Date().toISOString();
    const { fiscalYear: fy, month } = toFiscal(new Date(complaintDate));
    const note = (row[10] || "").toString().trim();
    records.push({
      id: `XLSX-P-${fy}-${gi + 1}-${Date.now().toString(36)}`,
      category: "ชื่นชมบริการ", description,
      department: (row[4] || "").toString().trim() || DEPARTMENT_FALLBACK,
      boxLocation: (row[3] || "").toString().trim(),
      complaintChannel: (row[9] || "").toString().trim() || "อื่นๆ",
      kind: "compliment",
      anonymous: true,
      contactName: "", contactChannel: "", contactInfo: "",
      severity: "green", severityScale: "general", severityLevel: "1", fiscalYear: fy, month,
      resolved: null, note,
      createdAt: complaintDate,
      status: "closed",
      statusLog: [{ status: "closed", at: complaintDate, note: "นำเข้าจากไฟล์ คำชม" }],
      satisfaction: null, rca: null, source: "legacy-import",
    });
  });
  return records;
}

async function parseXLSXFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const records = [];
  const sheetsFound = [];

  // ชื่อชีทไม่คงที่ในแต่ละปี (เช่น "ร้องเรียน"/"คำร้องเรียน", "คำชม"/"ชมเชย") จึงจับจากคำสำคัญแทน
  const complaintSheetName = wb.SheetNames.find((n) => n.includes("ร้องเรียน"));
  const complimentSheetName = wb.SheetNames.find((n) => n.includes("ชม") && !n.includes("ร้องเรียน"));

  if (complaintSheetName) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[complaintSheetName], { header: 1, raw: true, defval: null });
    records.push(...parseComplaintSheet(rows));
    sheetsFound.push(complaintSheetName);
  }
  if (complimentSheetName) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[complimentSheetName], { header: 1, raw: true, defval: null });
    records.push(...parseComplimentSheet(rows));
    sheetsFound.push(complimentSheetName);
  }
  if (!sheetsFound.length) {
    // fallback: treat first sheet as the aggregate "ระดับ" format via CSV conversion
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(firstSheet);
    const { records: aggRecords } = parseLegacyCSV(csv);
    records.push(...aggRecords);
    sheetsFound.push(wb.SheetNames[0]);
  }
  return { records, sheetsFound };
}

function ImportView({ onImport, existingCount }) {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [imported, setImported] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setImported(false);
    setPreview(null);

    const isXlsx = /\.xlsx?$/i.test(file.name);
    if (isXlsx) {
      setLoading(true);
      try {
        const { records, sheetsFound } = await parseXLSXFile(file);
        setPreview({ records, sheetsFound });
      } catch (err) {
        setError(err.message || "ไม่สามารถอ่านไฟล์ xlsx ได้ กรุณาตรวจสอบรูปแบบไฟล์");
      }
      setLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { records, fiscalYear } = parseLegacyCSV(ev.target.result);
        setPreview({ records, sheetsFound: [`ระดับ (ปีงบประมาณ ${fiscalYear})`] });
      } catch (err) {
        setError(err.message || "ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์");
        setPreview(null);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function confirmImport() {
    if (!preview) return;
    await onImport(preview.records);
    setImported(true);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>นำเข้าเรื่องเดิม (.xlsx หรือ .csv)</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 20, lineHeight: 1.6 }}>
        รองรับไฟล์ .xlsx ต้นฉบับที่มีแท็บ <b>ร้องเรียน</b> (ลำดับ · วันที่ลงทะเบียน/ร้องเรียน · หน่วยงานที่เปิดตู้ · หน่วยงานที่เกิดปัญหา · รายละเอียด · ช่องทางร้องเรียน · ระดับ · การตอบกลับ) และแท็บ <b>คำชม</b> โดยตรง —
        ระบบจะดึงหน่วยงาน ช่องทาง และวันที่จริงจากไฟล์ ไม่มีการเดา หากไม่มีข้อมูลหน่วยงานจะใส่เป็น "อื่นๆ" ให้แก้ไขเองภายหลัง
        หรืออัปโหลด .csv รูปแบบสรุปรายเดือน (แท็บ "ระดับ" เดิม) ก็ได้เช่นกัน · ปัจจุบันมี {existingCount} เรื่องในระบบ
      </div>

      <div style={{ background: "var(--card)", border: "1px dashed var(--line)", borderRadius: 12, padding: 32, textAlign: "center", marginBottom: 20 }}>
        <FileSpreadsheet size={32} color="var(--teal)" style={{ marginBottom: 10 }} />
        <div style={{ marginBottom: 14, fontSize: 13, color: "var(--ink-soft)" }}>{fileName || "เลือกไฟล์ .xlsx หรือ .csv"}</div>
        <label className="ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <Upload size={14} /> เลือกไฟล์
          <input type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFile} style={{ display: "none" }} />
        </label>
      </div>

      {loading && <div style={{ textAlign: "center", color: "var(--ink-soft)", padding: 20 }}>กำลังอ่านไฟล์...</div>}
      {error && <div style={{ background: "#FBE7E3", color: "#B23A2E", padding: 14, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {preview && !imported && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>พบข้อมูล {preview.records.length} รายการ</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 14 }}>จากแท็บ: {preview.sheetsFound.join(", ")} · ตัวอย่าง 5 รายการแรก</div>
          <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
            {preview.records.slice(0, 5).map((r) => (
              <div key={r.id} style={{ fontSize: 12, padding: "8px 10px", background: "#F7F9F8", borderRadius: 6, display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{r.description}</span>
                <span style={{ color: "var(--ink-soft)", flexShrink: 0 }}>{r.department} · {r.month}</span>
              </div>
            ))}
          </div>
          <button className="primary" onClick={confirmImport}>ยืนยันนำเข้าข้อมูล</button>
        </div>
      )}

      {imported && (
        <div style={{ background: "#E4F3EA", color: "#2F7A52", padding: 16, borderRadius: 8, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={18} /> นำเข้าข้อมูล {preview.records.length} รายการเรียบร้อยแล้ว ดูได้ที่ Dashboard และรายงานประจำปี
        </div>
      )}
    </div>
  );
}
