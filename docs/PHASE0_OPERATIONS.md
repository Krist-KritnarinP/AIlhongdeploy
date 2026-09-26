# Phase 0 — Operations and release checklist

สถานะ 2026-09-26: ส่วนโค้ดเตรียมไว้ใน branch `codex/phase0-production` แต่ **ยังไม่อนุญาตให้ตีความว่าเปิด production แล้ว** ผู้ใช้ขอข้ามการตั้งค่าภายนอกที่ยังไม่มีข้อมูล และให้บันทึกเป็นงานค้าง

## Environment isolation

สร้าง staging และ production เป็นคนละ database/project, API service, frontend service, JWT secret, Gemini key และ monitoring environment ห้าม staging ชี้ข้อมูลผู้ใช้ production หรือใช้สำเนาข้อมูลส่วนตัวจริงโดยไม่มีขั้นตอนที่เหมาะสม

| Variable | Development | Staging / production |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` |
| `APP_ENV` | `development` | `staging` / `production` |
| `DATABASE_URL` | ฐานข้อมูลทดสอบ | runtime role ของ environment นั้น |
| `DIRECT_URL` | migration role | ใส่เฉพาะ migration job ไม่ใส่ใน runtime |
| `FRONTEND_URL` | `http://localhost:5173` | HTTPS origin แบบตรงตัว ไม่มี path หรือ slash ท้าย |
| `JWT_SECRET` | secret ของ development | สุ่มอย่างน้อย 32 bytes แยก environment |
| `GEMINI_MODEL` | explicit model ID | model ID รุ่น stable ที่ตรวจในบัญชีแล้ว ห้าม latest/preview/experimental |
| `GEMINI_FALLBACK_MODEL` | เว้นว่างได้ | optional รุ่นรองที่ตรวจในบัญชีแล้ว |
| `AI_ENABLED` | `true` / `false` | `false` เพื่อหยุดการเรียกและการอ่าน cache จาก AI endpoint ชั่วคราว |
| `SENTRY_DSN` | เว้นว่างได้ | DSN ของ Sentry-compatible project ที่ผู้ดูแลเลือก |
| `APP_RELEASE` | เว้นว่างได้ | commit SHA ของ release |
| `REFRESH_COOKIE_SAME_SITE` | `lax` | `lax` สำหรับ frontend/API same-site; `none` เฉพาะ cross-site HTTPS |
| `TRUST_PROXY_HOPS` | `0` | จำนวน proxy ที่ตรวจสอบกับ hosting จริง |
| `VITE_API_URL` | `http://localhost:8899/api` | API HTTPS URL ลงท้าย `/api` ตั้งก่อน frontend build |

ใช้ custom subdomains ภายใต้ site เดียวกันเมื่อทำได้ เพื่อให้ refresh cookie ทำงานโดยไม่ต้องพึ่ง third-party cookies กรณี frontend/API คนละ site ต้องใช้ `SameSite=None; Secure` และตรวจ browser จริง เพราะ browser อาจบล็อก third-party cookies อยู่ดี เมื่อ refresh ใช้ไม่ได้ผู้ใช้ต้อง login ใหม่

ค่า fallback ไม่ถูกกำหนดเป็นชื่อโมเดลสมมติ ต้องตรวจ availability/สิทธิ์/ค่าใช้จ่ายในบัญชีจริงก่อนเปิดใช้ โค้ดสำรองได้เพียงหนึ่งโมเดลเมื่อ provider ตอบ 404 หรือ 503 ไม่ retry 429, authentication error หรือ timeout และทุก provider attempt ต้องผ่าน durable quota

## Migration and rollout

1. ยืนยัน backup และ restore drill ก่อนเปลี่ยนฐานข้อมูล production
2. รันใน `backend/` โดยใช้ migration credential ของ environment เป้าหมาย:

   ```sh
   npm ci
   npm run migrate:security
   npm run migrate:phase0
   npx prisma generate
   npx prisma validate
   ```

3. Migration Phase 0 เพิ่มตาราง `refresh_sessions` และ indexes เปิด RLS และเพิ่มสิทธิ์ให้ `ailhoung_runtime` หากมี role อยู่แล้ว เป็น additive/idempotent; ไม่ลบผู้ใช้หรือข้อมูลทริป
4. Database ใหม่ที่ว่างเท่านั้น: `npx prisma db push` ก่อน migrations; สร้าง runtime role ด้วย `npm run security:runtime-role` หลัง migrations ครบแล้ว ห้ามใช้ db push กับฐานข้อมูล production เดิมแบบไม่ตรวจ
5. Deploy backend ก่อน frontend ตรวจ `/health/live` และ `/health/ready`; ทดสอบ login, refresh, logout, เปลี่ยนรหัส, ส่งออกข้อมูล และลบบัญชีทดสอบ
6. ตั้ง cron ภายในระบบที่เชื่อถือได้รัน `npm run maintenance:sessions` ทุกวันด้วย runtime role เพื่อเก็บกวาด refresh session ที่หมดอายุ ไม่ต้องเปิด cleanup endpoint สาธารณะ
7. ถ้า rollback โค้ด เก็บตาราง additive ไว้ ไม่ drop ตารางระหว่าง incident; เวอร์ชันก่อนหน้าไม่อ่าน refresh sessions ผู้ใช้ที่มี access token หมดอายุต้อง login ใหม่

**ยังไม่ได้รัน migration นี้บนฐานข้อมูล Supabase จริงในรอบงานนี้** ต้องทำตาม rollout หลังจัดการ backup แล้ว

## Session behavior

- Access token อายุ 15 นาที; refresh อายุสูงสุด 7 วันแบบ absolute ไม่ยืดออกทุกครั้ง
- Refresh อยู่ใน HttpOnly cookie; ฐานข้อมูลเก็บ SHA-256 ของ token เท่านั้น และหมุน token ทุกครั้งที่ refresh
- ตรวจ Origin แบบตรงตัวใน refresh endpoint และปฏิเสธคำขอที่ไม่มี Origin
- Password change/logout เพิกถอน access และ refresh ผ่าน `tokenVersion`; ลบบัญชี cascade session/trip data
- หากนำ refresh token ที่ใช้แล้วกลับมาใช้ จะเพิกถอน session ของบัญชีนั้นทั้งหมด Browser ใช้ single-flight และ Web Locks ลดการชนกันระหว่าง tab; browser ที่ไม่มี Web Locks หรือการ retry หลัง response หายอาจต้อง login ใหม่
- Access token ยังอยู่ใน localStorage ตามโครงสร้างเดิม จึงยังต้องควบคุม XSS; HttpOnly refresh ไม่ได้แก้ความเสี่ยงนี้ทั้งหมด
- การ login จาก API client ที่ไม่ส่ง Origin ได้ access token อย่างเดียว; browser login ที่ส่ง Origin ที่อนุญาตจึงได้ refresh cookie

## Monitoring

- `GET /health/live`: process ตอบสนองได้; ไม่ยืนยัน database
- `GET /health/ready`: ตรวจ `SELECT 1`, ตอบ 503 หาก DB ใช้งานไม่ได้/ไม่ตอบภายใน 2 วินาที; cache ผล 5 วินาทีและรวมคำขอที่กำลังตรวจอยู่ ไม่ส่ง error/credentials ออกไป
- ตั้ง uptime monitor เรียก readiness ทุก 60 วินาทีและแจ้งเตือนหลังล้มเหลวต่อเนื่องตามนโยบายผู้ดูแล ตรวจช่องทางแจ้งเตือนด้วย incident จำลองใน staging
- Optional Sentry integration ปิดไว้เมื่อไม่มี DSN รายงานเฉพาะ 5xx, status/requestId/environment/release ไม่ส่ง request body, URL, token, user data, exception message, stack หรือ breadcrumbs จึงมีรายละเอียด debugging จำกัดโดยตั้งใจ
- การ init SDK และ sanitization ทดสอบในโค้ดได้ แต่ยังไม่ได้ยืนยัน delivery/alert กับบริการจริง ต้องทำ test event ก่อนเปิดใช้และกำหนด retention/access policy
- ยังไม่ได้วัด uptime 99.5% จริง ตัวเลขนี้เป็นเป้าหมาย ไม่ใช่ผลทดสอบ

## Backup and restore drill — ยังไม่ทำบนบริการจริง

- ผู้ดูแลต้องเลือก backup/PITR ตามแผน Supabase ที่ใช้งาน กำหนด RPO/RTO, retention และสิทธิ์เข้าถึงไฟล์สำรอง
- Restore ไปยัง **database/project ใหม่ที่แยกจาก production** ห้ามทับฐานข้อมูลใช้งานจริงเพื่อทดสอบ
- ตรวจจำนวนและความสัมพันธ์ของ users/trips/days/activities/AI history, ตรวจ login ของบัญชีทดสอบ และ CRUD/share revoke
- หลัง restore ต้องเพิกถอน session ที่อาจฟื้นกลับมา (เช่นเปลี่ยน JWT secretและเพิ่ม token_version ของทุก user พร้อมล้าง refresh sessions ด้วย migration/admin procedure ที่ตรวจแล้ว) ตรวจนโยบายข้อมูลที่ผู้ใช้ลบไปหลังเวลาสำรองก่อนให้บริการอีกครั้ง
- บันทึก backup timestamp, restore timestamp, เวลาที่ใช้, ผลตรวจ, ผู้รับผิดชอบ และลบสำเนาทดสอบตามนโยบาย
- การทดสอบ PostgreSQL ชั่วคราวในเครื่องยืนยัน migration/application ได้ แต่ไม่ทดแทน Supabase backup restore drill

แหล่งอ้างอิง: [Supabase backups](https://supabase.com/docs/guides/platform/backups) และ [restore to a new project](https://supabase.com/docs/guides/platform/clone-project)

## AI budget — ยังไม่ตั้งบนบัญชีจริง

- แยก project/key ระหว่าง staging และ production ตั้ง budget และผู้รับแจ้งเตือนที่ 50/80/100% ตามวงเงินที่เจ้าของระบบเลือก
- Budget แบบ alerts-only ไม่ใช่ hard spending cap และข้อมูล billing อาจมีความล่าช้า ต้องคง quota ในแอปและเตรียม `AI_ENABLED=false` สำหรับหยุดบริการ
- หากบัญชีรองรับ spend cap ให้ตรวจ coverage/ข้อจำกัดก่อนเปิด ไม่ถือว่า quota จำนวนคำขอเท่ากับเพดานค่าใช้จ่ายจริง
- ทดสอบการแจ้งเตือนและบันทึกผู้ตอบสนองก่อนเปิด public; ไม่เพิ่ม paid plan หรือวงเงินโดยอัตโนมัติ

อ้างอิง: [Google Cloud budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets)

## Legal and privacy — งานที่ผู้ใช้ขอพักไว้

- [ ] ระบุชื่อผู้ให้บริการ/ผู้ควบคุมข้อมูลและอีเมลติดต่อจริง
- [ ] จัดทำ Privacy Policy/Terms ภาษาไทยจากข้อมูลการประมวลผลจริง และตรวจข้อกำหนดที่ใช้กับธุรกิจนี้ก่อนเผยแพร่
- [ ] กำหนด retention ของ live data, logs และ backups รวมถึงการจัดการคำขอหลัง restore
- [ ] ตรวจ inventory cookies/localStorage/บริการภายนอกก่อนออกแบบ consent: authState, language, geocode cache, HttpOnly refresh, Gemini, Photon, map tile providers และ Google Fonts; ยังไม่มีการเพิ่ม analytics ในรอบนี้
- [ ] ทำ notice/consent UI ตามผลตรวจจริง ไม่แสดงปุ่มยินยอมที่ไม่มีผลต่อการโหลดบริการ
- [ ] ตรวจทะเบียน/ภาษี/เอกสารรับชำระเงินเมื่อจะเริ่มเก็บเงิน

ช่องทาง self-service ที่ทำในโค้ด: หน้าโปรไฟล์ดาวน์โหลด JSON และลบบัญชีพร้อมยืนยันรหัสผ่านปัจจุบัน การลบทำกับฐานข้อมูล live; ไม่อ้างว่าลบข้อมูลจาก backups/provider/logs สำเร็จโดยอัตโนมัติ

## Pending activation

ยังค้างโดเมน/hosting จริง, staging/production resources, Sentry/uptime destination, Supabase backup/PITR + restore drill, Gemini model availability/budget alert, เอกสารกฎหมาย และ browser cookie checks บน domain จริง ทั้งหมดต้องมีหลักฐานก่อนติ๊ก Phase 0 ว่าพร้อมเปิด public
