# SENA CARE — Next.js + Google Sheet (Service Account)

ระบบร้องเรียนของโรงพยาบาลเสนา ใช้ Google Sheet เป็นฐานข้อมูลหลัก อ่าน/เขียนผ่าน
Google Sheets API โดยตรง (ผ่าน Service Account) — credentials อยู่ฝั่งเซิร์ฟเวอร์
(Vercel Serverless Function) เท่านั้น ไม่เคยถูกส่งไปยังเบราว์เซอร์

## สถาปัตยกรรม

```
เบราว์เซอร์ (SenaCareApp.jsx)
   → fetch("/api/complaints")            ← เรียก API route ของแอปเอง
        → pages/api/complaints/*.js        ← รันบน Vercel Serverless Function
             → lib/googleSheets.js          ← ใช้ Service Account (env var)
                  → Google Sheets API v4      ← อ่าน/เขียน Sheet จริง
```

## ขั้นตอนตั้งค่า Google Cloud

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) → สร้างโปรเจกต์ใหม่ (หรือใช้โปรเจกต์เดิม)
2. เปิดใช้งาน **Google Sheets API**: APIs & Services > Library > ค้นหา "Google Sheets API" > Enable
3. สร้าง Service Account: APIs & Services > Credentials > Create Credentials > Service Account
   - ตั้งชื่อ เช่น `sena-care-backend`
   - ไม่ต้องให้สิทธิ์ระดับโปรเจกต์เพิ่มเติม (ใช้แค่การแชร์ Sheet โดยตรง)
4. เข้าไปที่ Service Account ที่สร้าง > แท็บ Keys > Add Key > Create new key > เลือก **JSON**
   - จะได้ไฟล์ `credentials.json` ดาวน์โหลดมา **ห้าม commit ไฟล์นี้ขึ้น git เด็ดขาด**

## ขั้นตอนตั้งค่า Google Sheet

1. สร้าง Google Sheet ใหม่ (หรือใช้ชีตเดิมที่มีอยู่) — ไม่ต้องสร้างแท็บ/หัวคอลัมน์เอง ระบบจะสร้างแท็บ "Complaints" พร้อมหัวตารางให้อัตโนมัติในการเรียกครั้งแรก
2. กด Share → วางอีเมลของ Service Account (ค่า `client_email` ใน credentials.json เช่น `sena-care-backend@your-project.iam.gserviceaccount.com`) → ให้สิทธิ์ **Editor**
3. คัดลอก Spreadsheet ID จาก URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

## รันในเครื่อง

```bash
npm install
cp .env.example .env.local
# เปิด .env.local แล้วกรอก GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID
# (ค่า GOOGLE_PRIVATE_KEY คัดลอกจาก credentials.json ทั้งก้อน ใส่ในเครื่องหมายคำพูด)
npm run dev
# เปิด http://localhost:3000
```

## Deploy บน Vercel

1. Push โค้ดนี้ขึ้น GitHub repo (`.env.local` และ `credentials.json` จะไม่ถูกรวมไปด้วยเพราะอยู่ใน `.gitignore` แล้ว)
2. ไปที่ [vercel.com](https://vercel.com) → New Project → เลือก repo นี้
3. ก่อนกด Deploy ให้ไปที่ Environment Variables แล้วเพิ่ม:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` (คัดลอกทั้งก้อนจาก credentials.json รวม `\n` ด้วย)
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SHEET_TAB_NAME` (ใส่หรือไม่ใส่ก็ได้ ค่าเริ่มต้นคือ `Complaints`)
4. กด Deploy

## รับเรื่องร้องเรียนจาก Google Form แบบ real-time

ใช้ Apps Script ผูกกับ Spreadsheet ฐานข้อมูลโดยตรง (ไฟล์ `apps-script/form-trigger.gs`) —
ทำงานทันทีทุกครั้งที่มีคนตอบฟอร์ม ไม่ต้องกด sync ในเว็บ ไม่ต้องมี scheduler ภายนอก ไม่ต้องตั้งค่า env var เพิ่ม

**ขั้นตอน:**

1. สร้าง Google Form ตามคำถามที่ออกแบบไว้ (ดูหัวข้อคำถามที่แนะนำด้านล่าง)
2. เปิด Form → Responses → ไอคอน Sheets สีเขียว → **"Select existing spreadsheet"** → เลือกไฟล์ฐานข้อมูลหลัก (ไฟล์เดียวกับที่ตั้ง `GOOGLE_SHEET_ID` ไว้) — จะได้แท็บคำตอบใหม่ (เช่น "Form Responses 1") เพิ่มเข้ามาในไฟล์เดียวกับแท็บ "Complaints"
3. เปิด Spreadsheet ไฟล์นั้น (เปิดจากตัว Sheet ไม่ใช่จากฟอร์ม) → เมนู **Extensions > Apps Script**
4. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดจาก `apps-script/form-trigger.gs`
5. เลือกฟังก์ชัน `setupTrigger` จาก dropdown ด้านบน (ข้าง Run) แล้วกด Run หนึ่งครั้ง → อนุญาตสิทธิ์ตามที่ขอ
6. ทดสอบตอบฟอร์ม 1 ครั้ง แล้วเช็คว่ามีแถวใหม่ขึ้นในแท็บ "Complaints" ทันที

**หัวข้อคำถามในฟอร์มที่ระบบจับคู่อัตโนมัติ** (ปรับคำได้ ระบบจับคู่จากคำสำคัญในชื่อคำถาม ไม่ใช่ตำแหน่งคอลัมน์):
- คำถามที่มีคำว่า "หมวด" หรือ "ประเภท...เรื่อง/ปัญหา" → ประเภทเรื่อง
- คำถามที่มีคำว่า "หน่วยงาน" → หน่วยงานที่เกี่ยวข้อง
- คำถามที่มีคำว่า "รายละเอียด" → รายละเอียด (**จำเป็น** ถ้าจับคู่ไม่ได้ระบบจะข้ามแถวนั้น)
- คำถามที่ขึ้นต้นด้วย "ชื่อ" หรือมีคำว่า "ชื่อผู้แจ้ง" → ชื่อผู้แจ้ง
- คำถามที่มีคำว่า "ติดต่อกลับ" → ช่องทางติดต่อกลับ
- คำถามที่มีคำว่า "เบอร์" / "LINE" / "โทร" → เบอร์โทร/LINE ID

ถ้าตั้งคำถามด้วยคำอื่นแล้วจับคู่ไม่ตรง แก้ pattern ได้ที่ตัวแปร `HEADER_PATTERNS` ในไฟล์ `apps-script/form-trigger.gs`


## โครงสร้างไฟล์

```
pages/
  index.js                     หน้าเดียวของแอป (render SenaCareApp)
  api/complaints/index.js      GET รายการทั้งหมด, POST สร้าง/นำเข้าแบบกลุ่ม
  api/complaints/[id].js       PATCH อัปเดตเรื่องร้องเรียนตาม id
lib/googleSheets.js            เชื่อมต่อ Google Sheets API ด้วย Service Account (ฐานข้อมูลหลัก)
components/SenaCareApp.jsx     UI ทั้งหมด (แจ้งเรื่อง / ติดตาม / Dashboard / รายงาน / RCA / นำเข้าเรื่องเดิม)
apps-script/form-trigger.gs    สคริปต์ผูกกับ Spreadsheet ฐานข้อมูล รับเรื่องจาก Google Form แบบ real-time
```

## หมายเหตุด้านความปลอดภัย

- `GOOGLE_PRIVATE_KEY` และค่า credential อื่น ๆ ถูกอ่านเฉพาะใน `lib/googleSheets.js` ซึ่งรันบนเซิร์ฟเวอร์เท่านั้น (ไฟล์ใน `pages/api/`) — โค้ดฝั่ง browser (`components/SenaCareApp.jsx`) ไม่มีสิทธิ์เข้าถึงค่าพวกนี้เลย
- อย่า commit `credentials.json` หรือ `.env.local` ขึ้น git (มีอยู่ใน `.gitignore` แล้ว)
- ถ้า key รั่วไหล ให้เข้าไปที่ Google Cloud Console > Service Account > Keys แล้วลบ key เก่า สร้างใหม่ทันที
