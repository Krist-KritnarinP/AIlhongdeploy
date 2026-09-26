# Handover — 2026-09-26

## อัปเดตเอกสาร: แผน Admin — 2026-09-26

- เพิ่ม [ADMIN_PLAN.md](ADMIN_PLAN.md) บันทึกความจำเป็น หน้าที่ ขอบเขตสิทธิ์ และแผนพัฒนา Admin รุ่นแรก
- เน้นการระงับบัญชี ดูการใช้/จัดการโควตา AI ปิด AI ชั่วคราว และ audit log
- ยังไม่ได้เพิ่ม role, schema, API หรือหน้าจอ Admin; เป็นงานเอกสารเท่านั้น
- ตรวจความสอดคล้องกับ schema/auth/AI quota ปัจจุบัน ลิงก์เอกสาร และ `git diff --check`; ไม่รัน application tests ซ้ำสำหรับการเพิ่มเอกสาร

## สถานะการส่งมอบโค้ดก่อนหน้า

โปรเจกต์รวมเป็น monorepo พร้อม frontend/backend แยกโฟลเดอร์ ดู [README.md](README.md) สำหรับ setup และ deploy

เอกสารงานฉบับเต็มอยู่ที่ [frontend/HANDOVER.md](frontend/HANDOVER.md) และ [frontend/SECURITY_REVIEW.md](frontend/SECURITY_REVIEW.md) โดยหัวข้อท้ายสุดคือผลตรวจรอบล่าสุด ข้อความรุ่นเก่าถูกเก็บไว้เป็นประวัติ

การอ้างอิงโฟลเดอร์เดิมในเอกสารให้เทียบดังนี้:
- `PersonalProject_Front` → `frontend`
- `PersonalProject_API` → `backend`

แก้การรอ geocoder ทั้งชุดเป็น progressive pins พร้อม cache/dedup/cancellation; lazy-load routes; ลด blur และ animation; แก้ security ด้าน validation, ownership, password/session revocation, AI quota, error redaction และ runtime DB role

ฐานข้อมูลเดิมถูกอัปเกรดแล้วและ JWT secret ถูกหมุนเวียน ผู้ใช้เดิมต้อง login ใหม่. Secret จริงยังอยู่ใน `.env` ของต้นฉบับ ไม่รวมใน repo นี้

ตรวจแล้ว: frontend 4 tests, backend 7 tests, real database integration, production build และ Chromium desktop/mobile smoke. ยังไม่ได้ deploy hosting หรือทดสอบ live geocoder/tile latency, backup restore และ production proxy

ต้นฉบับทั้งสอง repository ยังอยู่ครบพร้อมประวัติ Git. Repo นี้เริ่มประวัติใหม่จาก snapshot ของโค้ดที่แก้แล้ว

ตรวจ fresh install จาก lockfile ใน monorepo แล้ว: unit tests ทั้ง 11 ผ่านโดยไม่ต้องใช้ secret จริง, build และ Prisma schema validate ผ่าน. Dependency installation ในเครื่องตรวจใช้ npm ci --offline --ignore-scripts จาก cache; hosting ควรใช้ npm ci ตาม README
